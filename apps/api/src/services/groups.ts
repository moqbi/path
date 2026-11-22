import { prisma } from "@athar/db";
import { MESSAGE_KEEP_DAYS } from "@athar/shared";
import { push } from "./push";
import { dropMedia } from "./media";
import { guard } from "../lib/moderation";
import { badRequest, forbidden, notFound } from "../lib/errors";

/**
 * المحادثات الجماعيّة (القاعدة ٢١٥).
 *
 * **ينشئها المشرف وحده** (`canRunGroups`: المالك أو ممنوحُ اللوحة كلّها)
 * ويسمّيها ويختار أعضاءها — لجمع المختبرين ومن في حكمهم. والأعضاء يكتبون
 * كلُّهم، ولا يُضاف أحدٌ نفسَه: لا مجموعةَ تُكتشف ولا رابطَ يُفتح بها
 * (القاعدة ٢). والعضويّةُ هي الصلاحية: كلُّ قراءةٍ وكتابةٍ تمرّ على
 * `seat()` من القاعدة، و«غير موجودة» لمن ليس فيها (القاعدة ٢٣ب).
 */

export const NAME_MAX = 60;
const MEMBERS_MAX = 150;

const PERSON = {
  id: true,
  name: true,
  memberNo: true,
  isPlus: true,
  tag: { select: { name: true, bg: true, fg: true } },
  avatarMediaId: true,
  frame: { select: { spec: true, mediaId: true, frameHole: true, fit: true } },
  charm: { select: { spec: true, mediaId: true, fit: true } },
} as const;

const MESSAGE = {
  id: true,
  body: true,
  kind: true,
  mediaId: true,
  senderId: true,
  createdAt: true,
  system: true,
  editedAt: true,
  sender: { select: PERSON },
} as const;

/** المشرف الذي يملك أن ينشئ ويدير: المالك، أو ممنوحُ اللوحة كلّها. */
export async function canRunGroups(userId: string): Promise<boolean> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, adminScope: true },
  });
  return row?.role === "ADMIN" || row?.adminScope === "ALL";
}

async function requireRunner(userId: string) {
  if (!(await canRunGroups(userId))) throw forbidden("هذا للمشرف");
}

/** يثبت العضويّة من القاعدة — «غير موجودة» لمن ليس فيها. */
async function seat(userId: string, groupId: string) {
  const row = await prisma.chatGroupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { lastReadAt: true, joinedAt: true, muted: true },
  });
  if (!row) throw notFound("المجموعة غير موجودة");
  return row;
}

/**
 * رتبُ المجموعة (القاعدة ٤٧٥) — **بقرار المالك**: مشرفُ الموقع ٤، ومالكُها (مُنشئُها) ٣،
 * والمديرُ ٢، والمشرفُ ١، والعضوُ ٠. ولا يمسّ أحدٌ من هو في رتبته أو فوقه: المالكُ على الكلّ،
 * والمديرُ على المشرفين والأعضاء، والمشرفُ على الأعضاء. و−١ لمن ليس فيها.
 */
export type Rank = -1 | 0 | 1 | 2 | 3 | 4;
export type RoleName = "OWNER" | "ADMIN" | "MODERATOR" | "MEMBER";
const ROLE_RANK = { ADMIN: 2, MODERATOR: 1, MEMBER: 0 } as const;

async function rankIn(groupId: string, userId: string): Promise<Rank> {
  const [group, member, staff] = await Promise.all([
    prisma.chatGroup.findUnique({ where: { id: groupId }, select: { createdById: true } }),
    prisma.chatGroupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
      select: { role: true },
    }),
    canRunGroups(userId),
  ]);
  if (!group) throw notFound("المجموعة غير موجودة");
  if (staff) return 4;
  if (!member) return -1;
  if (group.createdById === userId) return 3;
  return ROLE_RANK[member.role];
}

/** الفاعلُ فوق الهدف وفي الرتبة المطلوبة — وإلّا «ليس لك». */
async function above(actorId: string, groupId: string, targetId: string, least: Rank) {
  const [actor, target] = await Promise.all([rankIn(groupId, actorId), rankIn(groupId, targetId)]);
  if (actor < 0) throw notFound("المجموعة غير موجودة");
  if (target < 0) throw notFound("ليس عضواً في المجموعة");
  if (actor < least || actor <= target) throw forbidden("ليس لك هذا على هذا العضو");
  return { actor, target };
}

async function requireRank(userId: string, groupId: string, least: Rank) {
  const rank = await rankIn(groupId, userId);
  if (rank < 0) throw notFound("المجموعة غير موجودة");
  if (rank < least) throw forbidden(least >= 3 ? "هذا لمالك المجموعة" : "هذا لمديري المجموعة");
  return rank;
}

function cleanName(name: string) {
  const clean = name.trim().replace(/\s+/g, " ").slice(0, NAME_MAX);
  if (!clean) throw badRequest("سمِّ المجموعة");
  return clean;
}

/** المعرّفاتُ الموجودة فعلاً — معرّفٌ مختلَق لا يُكتب عضواً. */
async function realUsers(ids: string[]) {
  const unique = [...new Set(ids)].slice(0, MEMBERS_MAX);
  const rows = await prisma.user.findMany({ where: { id: { in: unique } }, select: { id: true } });
  return rows.map((row) => row.id);
}

export async function create(userId: string, input: { name: string; memberIds: string[] }) {
  await requireRunner(userId);
  const name = cleanName(input.name);
  await guard(name);
  const ids = await realUsers([userId, ...input.memberIds]);
  if (ids.length < 2) throw badRequest("أضف عضواً واحداً على الأقل");

  const group = await prisma.chatGroup.create({
    data: {
      name,
      createdById: userId,
      members: { create: ids.map((id) => ({ userId: id })) },
    },
    select: { id: true },
  });
  return group;
}

/** مجموعاتي: الاسم، وآخر رسالة، وكم لم يُقرأ — كقائمة المحادثات. */
export async function list(userId: string) {
  const seats = await prisma.chatGroupMember.findMany({
    where: { userId },
    select: {
      lastReadAt: true,
      joinedAt: true,
      group: {
        select: {
          id: true,
          name: true,
          photoMediaId: true,
          updatedAt: true,
          _count: { select: { members: true } },
        },
      },
    },
    orderBy: { group: { updatedAt: "desc" } },
  });

  const groups = await Promise.all(
    seats.map(async (row) => ({
      id: row.group.id,
      name: row.group.name,
      photoMediaId: row.group.photoMediaId,
      updatedAt: row.group.updatedAt,
      members: row.group._count.members,
      // ما قبل الانضمام ليس له (القاعدة ٢٤٢) — ولا آخرُ رسالةٍ منه في القائمة.
      last: await prisma.groupMessage.findFirst({
        where: { groupId: row.group.id, createdAt: { gte: row.joinedAt } },
        select: MESSAGE,
        orderBy: { createdAt: "desc" },
      }),
      unseen: await prisma.groupMessage.count({
        where: { groupId: row.group.id, senderId: { not: userId }, createdAt: { gt: row.lastReadAt } },
      }),
    })),
  );
  return { groups };
}

/** ما لم يُقرأ في المجموعات كلّها — يُجمع إلى شارة المحادثات. */
export async function unreadCount(userId: string): Promise<number> {
  const seats = await prisma.chatGroupMember.findMany({
    where: { userId },
    select: { groupId: true, lastReadAt: true },
  });
  const counts = await Promise.all(
    seats.map((row) =>
      prisma.groupMessage.count({
        where: { groupId: row.groupId, senderId: { not: userId }, createdAt: { gt: row.lastReadAt } },
      }),
    ),
  );
  return counts.reduce((sum, n) => sum + n, 0);
}

/** المجموعةُ بأعضائها ورسائلها، بصفحاتٍ بمؤشّر كالمحادثة. */
export async function thread(
  userId: string,
  groupId: string,
  options: { cursor?: string; limit: number },
) {
  const { joinedAt } = await seat(userId, groupId);

  const group = await prisma.chatGroup.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      name: true,
      photoMediaId: true,
      createdById: true,
      members: { select: { role: true, muted: true, user: { select: PERSON } }, orderBy: { joinedAt: "asc" } },
    },
  });
  if (!group) throw notFound("المجموعة غير موجودة");
  const rank = await rankIn(groupId, userId);

  // العضوُ الجديد يقرأ من يوم انضمامه لا أرشيفَ ما قبله (القاعدة ٢٤٢).
  const rows = await prisma.groupMessage.findMany({
    where: { groupId, createdAt: { gte: joinedAt } },
    select: MESSAGE,
    orderBy: { createdAt: "desc" },
    take: options.limit + 1,
    cursor: options.cursor ? { id: options.cursor } : undefined,
    skip: options.cursor ? 1 : 0,
  });
  const more = rows.length > options.limit;
  const page = more ? rows.slice(0, options.limit) : rows;

  return {
    id: group.id,
    name: group.name,
    photoMediaId: group.photoMediaId,
    // الرتبةُ والكتمُ مع كلّ عضو (القاعدة ٤٧٥) — والجوّالُ القديم يقرأ الشخصَ وحده.
    members: group.members.map((row) => ({
      ...row.user,
      role: (row.user.id === group.createdById ? "OWNER" : row.role) as RoleName,
      muted: row.muted,
    })),
    ownerId: group.createdById,
    myRank: rank,
    canManage: rank >= 2,
    messages: [...page].reverse(),
    nextCursor: more ? page.at(-1)?.id : undefined,
  };
}

export async function send(
  userId: string,
  groupId: string,
  input: { kind: "TEXT" | "PHOTO"; body?: string; mediaId?: string },
) {
  const mine = await seat(userId, groupId);
  if (mine.muted) throw forbidden("أنت مكتوم في هذه المجموعة");

  let body = "";
  let mediaId: string | null = null;
  if (input.kind === "TEXT") {
    body = (input.body ?? "").trim().slice(0, 2000);
    if (!body) throw badRequest("اكتب شيئاً");
    await guard(body);
  } else {
    if (!input.mediaId) throw badRequest("ما وصلت الصورة");
    const media = await prisma.media.findFirst({
      where: { id: input.mediaId, ownerId: userId, ready: true },
      select: { id: true, mime: true },
    });
    if (!media) throw notFound("الملف غير موجود");
    if (!media.mime.startsWith("image/")) throw badRequest("صيغة غير مدعومة");
    mediaId = media.id;
  }

  const [message, group] = await prisma.$transaction([
    prisma.groupMessage.create({
      data: { groupId, senderId: userId, body, kind: input.kind, mediaId },
      select: MESSAGE,
    }),
    prisma.chatGroup.update({
      where: { id: groupId },
      data: { updatedAt: new Date() },
      select: { name: true, members: { select: { userId: true } } },
    }),
    // ما كتبه المرسل مقروءٌ عنده.
    prisma.chatGroupMember.update({
      where: { groupId_userId: { groupId, userId } },
      data: { lastReadAt: new Date() },
      select: { userId: true },
    }),
  ]);

  // الجرسُ لكل عضوٍ غير المرسل — لا يُنتظر، وفشلُه لا يُلغي الرسالة.
  const preview = message.kind === "PHOTO" ? "📷 صورة" : message.body.slice(0, 120);
  for (const member of group.members) {
    if (member.userId === userId) continue;
    void push({
      userId: member.userId,
      kind: "DM",
      title: group.name,
      body: `${message.sender.name}: ${preview}`,
      path: `/group/${groupId}`,
    });
  }

  return { message, to: group.members.map((row) => row.userId) };
}

export async function markRead(userId: string, groupId: string) {
  await seat(userId, groupId);
  await prisma.chatGroupMember.update({
    where: { groupId_userId: { groupId, userId } },
    data: { lastReadAt: new Date() },
  });
  return { ok: true };
}

/** حذفُ رسالة: لمرسلها، وللمشرف على أيّ رسالة. وصورتُها تذهب معها. */
export async function removeMessage(userId: string, messageId: string) {
  const message = await prisma.groupMessage.findUnique({
    where: { id: messageId },
    select: { id: true, groupId: true, senderId: true, mediaId: true },
  });
  if (!message) throw notFound("الرسالة غير موجودة");
  await seat(userId, message.groupId);
  // رسالتُك، أو رسالةُ من دونك وأنت مشرفٌ فما فوق (القاعدة ٤٧٥).
  if (message.senderId !== userId) {
    const [actor, sender] = await Promise.all([rankIn(message.groupId, userId), rankIn(message.groupId, message.senderId)]);
    if (actor < 1 || actor <= sender) throw forbidden("تحذف رسائلك وحدها");
  }
  await prisma.groupMessage.delete({ where: { id: message.id } });
  if (message.mediaId) await dropMedia([message.mediaId]);
  return { ok: true, groupId: message.groupId };
}

/** تعديلُ رسالة: لكاتبها وحده ونصّاً لا سطرَ حدث، و«عُدّلت» يبقى (القاعدة ٣٥). */
export async function edit(userId: string, messageId: string, body: string) {
  const message = await prisma.groupMessage.findUnique({
    where: { id: messageId },
    select: { id: true, groupId: true, senderId: true, kind: true, system: true },
  });
  if (!message) throw notFound("الرسالة غير موجودة");
  const mine = await seat(userId, message.groupId);
  if (message.senderId !== userId || message.system) throw forbidden("تعدّل رسائلك وحدها");
  if (message.kind !== "TEXT") throw badRequest("النصّ وحده يُعدَّل");
  if (mine.muted) throw forbidden("أنت مكتوم في هذه المجموعة");
  const clean = body.trim().slice(0, 2000);
  if (!clean) throw badRequest("اكتب شيئاً");
  await guard(clean);
  const updated = await prisma.groupMessage.update({
    where: { id: messageId },
    data: { body: clean, editedAt: new Date() },
    select: MESSAGE,
  });
  return { message: updated, groupId: message.groupId };
}

/**
 * رتبةُ العضو (القاعدة ٤٧٥): المالكُ يجعل مديراً أو مشرفاً أو يُعيده عضواً، والمديرُ يجعل
 * مشرفاً أو يُعيده — كلٌّ على من دونه وحده. ويُكتب سطرُ حدثٍ يقرؤه الجميع.
 */
export async function setRole(userId: string, groupId: string, memberId: string, role: "ADMIN" | "MODERATOR" | "MEMBER") {
  const { actor } = await above(userId, groupId, memberId, 2);
  if (role === "ADMIN" && actor < 3) throw forbidden("المديرُ يعيّنه المالك");
  await prisma.chatGroupMember.update({ where: { groupId_userId: { groupId, userId: memberId } }, data: { role } });
  await eventLines(userId, groupId, [memberId], role === "MEMBER" ? "demoted" : role === "ADMIN" ? "admin" : "moderator");
  return { ok: true };
}

/** الكتم: من دونك لا يكتب حتى يُرفع — المشرفُ فما فوق (القاعدة ٤٧٥). */
export async function setMuted(userId: string, groupId: string, memberId: string, muted: boolean) {
  await above(userId, groupId, memberId, 1);
  await prisma.chatGroupMember.update({ where: { groupId_userId: { groupId, userId: memberId } }, data: { muted } });
  await eventLines(userId, groupId, [memberId], muted ? "muted" : "unmuted");
  return { ok: true };
}

export async function rename(userId: string, groupId: string, name: string) {
  await requireRank(userId, groupId, 2);
  const clean = cleanName(name);
  await guard(clean);
  await prisma.chatGroup.update({ where: { id: groupId }, data: { name: clean } });
  return { ok: true };
}

/**
 * صورةُ المجموعة (القاعدة ٢٤١) — للمشرف وحده كالاسم. ملفٌّ رفعه هو وجاهز وصورةٌ لا
 * غيرُها، والسابقةُ تذهب ببكسلاتها (القاعدة ١٠٤). و`null` يُزيلها.
 */
export async function setPhoto(userId: string, groupId: string, mediaId: string | null) {
  await requireRank(userId, groupId, 2);
  const group = await prisma.chatGroup.findUnique({ where: { id: groupId }, select: { photoMediaId: true } });
  if (!group) throw notFound("المجموعة غير موجودة");
  if (mediaId) {
    const media = await prisma.media.findFirst({
      where: { id: mediaId, ownerId: userId, ready: true },
      select: { mime: true },
    });
    if (!media) throw notFound("الملف غير موجود");
    if (!media.mime.startsWith("image/")) throw badRequest("صيغة غير مدعومة");
  }
  if (group.photoMediaId === mediaId) return { photoMediaId: mediaId };
  await prisma.chatGroup.update({ where: { id: groupId }, data: { photoMediaId: mediaId } });
  if (group.photoMediaId) await dropMedia([group.photoMediaId]);
  return { photoMediaId: mediaId };
}

export async function addMembers(userId: string, groupId: string, ids: string[]) {
  await requireRank(userId, groupId, 2);
  const group = await prisma.chatGroup.findUnique({
    where: { id: groupId },
    select: { _count: { select: { members: true } } },
  });
  if (!group) throw notFound("المجموعة غير موجودة");
  const real = await realUsers(ids);
  if (group._count.members + real.length > MEMBERS_MAX) {
    throw badRequest(`الحدّ ${MEMBERS_MAX} عضواً`);
  }
  const present = new Set(
    (
      await prisma.chatGroupMember.findMany({
        where: { groupId, userId: { in: real } },
        select: { userId: true },
      })
    ).map((row) => row.userId),
  );
  const fresh = real.filter((id) => !present.has(id));
  await prisma.chatGroupMember.createMany({
    data: fresh.map((id) => ({ groupId, userId: id })),
    skipDuplicates: true,
  });
  // بعد الانضمام لا قبله: العضوُ الجديد يقرأ من يوم انضمامه (القاعدة ٢٤٢)،
  // وسطرُ إضافته أوّلُ ما يراه.
  await eventLines(userId, groupId, fresh, "added");
  return { ok: true };
}

/**
 * سطورُ أحداث المجموعة (القاعدة ٢٦٤): «فلان أضاف فلان»، «فلان أزال فلان من
 * المجموعة»، «فلان غادر المجموعة». تُكتب نصّاً كاملاً فيقرؤها الجوّالُ القديم
 * رسالةً عاديّة لا فراغاً، والجديدُ يرسمها سطراً في الوسط (`system`).
 */
async function eventLines(
  actorId: string,
  groupId: string,
  targetIds: string[],
  what: "added" | "removed" | "left" | "admin" | "moderator" | "demoted" | "muted" | "unmuted",
) {
  if (targetIds.length === 0) return;
  const people = await prisma.user.findMany({
    where: { id: { in: [actorId, ...targetIds] } },
    select: { id: true, name: true },
  });
  const name = new Map(people.map((row) => [row.id, row.name]));
  const actor = name.get(actorId) ?? "المشرف";
  await prisma.groupMessage.createMany({
    data: targetIds.map((id) => ({
      groupId,
      senderId: actorId,
      system: true,
      body: lineOf(what, actor, name.get(id) ?? "عضواً"),
    })),
  });
  await prisma.chatGroup.update({ where: { id: groupId }, data: { updatedAt: new Date() } });
}

function lineOf(what: string, actor: string, target: string): string {
  switch (what) {
    case "left":
      return `${actor} غادر المجموعة`;
    case "added":
      return `${actor} أضاف ${target}`;
    case "admin":
      return `${actor} جعل ${target} مديراً`;
    case "moderator":
      return `${actor} جعل ${target} مشرفاً`;
    case "demoted":
      return `${actor} أعاد ${target} عضواً`;
    case "muted":
      return `${actor} كتم ${target}`;
    case "unmuted":
      return `${actor} رفع الكتم عن ${target}`;
    default:
      return `${actor} أزال ${target} من المجموعة`;
  }
}

/** إخراجُ عضو: من فوقه بالرتبة (المشرفُ فما فوق)، وكلُّ عضوٍ يغادر بنفسه (القاعدة ٤٧٥). */
export async function removeMember(userId: string, groupId: string, memberId: string) {
  if (memberId !== userId) await above(userId, groupId, memberId, 1);
  else await seat(userId, groupId);
  const gone = await prisma.chatGroupMember.deleteMany({ where: { groupId, userId: memberId } });
  if (gone.count > 0) {
    await eventLines(userId, groupId, [memberId], memberId === userId ? "left" : "removed");
  }
  return { ok: true };
}

/** حذفُ المجموعة كلّها — بصور رسائلها (القاعدة ١٠٤). */
export async function remove(userId: string, groupId: string) {
  await requireRank(userId, groupId, 3);
  const files = await prisma.groupMessage.findMany({
    where: { groupId, mediaId: { not: null } },
    select: { mediaId: true },
  });
  const photo = await prisma.chatGroup.findUnique({ where: { id: groupId }, select: { photoMediaId: true } });
  await prisma.chatGroup.deleteMany({ where: { id: groupId } });
  await dropMedia([
    ...files.flatMap((row) => (row.mediaId ? [row.mediaId] : [])),
    ...(photo?.photoMediaId ? [photo.photoMediaId] : []),
  ]);
  return { ok: true };
}

/**
 * من يُضاف: **برقم العضويّة** — **بقرار المالك**، فهو ما يُقال ويُكتب (القاعدة ١٥)
 * ولا يلتبس كالأسماء. رقمٌ أو أرقامٌ يفصلها فراغٌ أو فاصلة، والأرقامُ العربيّة
 * تُحوَّل. وللمشرف وحده، فلا ينقض منعَ البحث عن الناس (القاعدة ٢٠).
 */
export async function candidates(userId: string, query: string) {
  // مشرفُ الموقع، أو مالكُ مجموعةٍ أو مديرُها — من يملك أن يُضيف (القاعدة ٤٧٥).
  if (!(await canRunGroups(userId))) {
    const manages = await prisma.chatGroupMember.count({
      where: { userId, OR: [{ role: "ADMIN" }, { group: { createdById: userId } }] },
    });
    if (manages === 0) throw forbidden("هذا للمشرف");
  }
  const latin = query.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  const numbers = [...new Set(latin.split(/[\s,،]+/).filter((part) => /^\d{1,9}$/.test(part)).map(Number))].slice(0, 50);
  if (numbers.length === 0) return { people: [], missing: [] };
  const rows = await prisma.user.findMany({
    where: { memberNo: { in: numbers } },
    select: PERSON,
    orderBy: { memberNo: "asc" },
  });
  const found = new Set(rows.map((row) => row.memberNo));
  return {
    people: rows.filter((row) => row.id !== userId),
    // ما لا حسابَ له يُقال رقماً رقماً، فلا يظنّ المشرفُ أنّه أُضيف.
    missing: numbers.filter((n) => !found.has(n)),
  };
}

/** الكنسُ كالمحادثات: ثلاثون يوماً (القاعدة ٨٣) — والمجموعةُ تبقى. */
export async function sweepOld(): Promise<number> {
  const cutoff = new Date(Date.now() - MESSAGE_KEEP_DAYS * 86_400_000);
  // ما جُمعت ملفّاتُه وحده وما بلا ملفّ — لا يبقى ملفٌّ بلا رسالة (القاعدة ٤٢٤).
  const files = await prisma.groupMessage.findMany({
    where: { createdAt: { lt: cutoff }, mediaId: { not: null } },
    select: { id: true, mediaId: true },
    take: 500,
  });
  const withFiles = await prisma.groupMessage.deleteMany({ where: { id: { in: files.map((row) => row.id) } } });
  const bare = await prisma.groupMessage.deleteMany({ where: { createdAt: { lt: cutoff }, mediaId: null } });
  const count = withFiles.count + bare.count;
  const ids = files.flatMap((row) => (row.mediaId ? [row.mediaId] : []));
  if (ids.length > 0) await dropMedia(ids);
  return count;
}
