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
  frame: { select: { spec: true, mediaId: true, frameHole: true } },
  charm: { select: { spec: true, mediaId: true } },
} as const;

const MESSAGE = {
  id: true,
  body: true,
  kind: true,
  mediaId: true,
  senderId: true,
  createdAt: true,
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
    select: { lastReadAt: true },
  });
  if (!row) throw notFound("المجموعة غير موجودة");
  return row;
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
      group: {
        select: {
          id: true,
          name: true,
          updatedAt: true,
          _count: { select: { members: true } },
          messages: { select: MESSAGE, orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
    },
    orderBy: { group: { updatedAt: "desc" } },
  });

  const groups = await Promise.all(
    seats.map(async (row) => ({
      id: row.group.id,
      name: row.group.name,
      updatedAt: row.group.updatedAt,
      members: row.group._count.members,
      last: row.group.messages[0] ?? null,
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
  await seat(userId, groupId);

  const group = await prisma.chatGroup.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      name: true,
      createdById: true,
      members: { select: { user: { select: PERSON } }, orderBy: { joinedAt: "asc" } },
    },
  });
  if (!group) throw notFound("المجموعة غير موجودة");

  const rows = await prisma.groupMessage.findMany({
    where: { groupId },
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
    members: group.members.map((row) => row.user),
    canManage: await canRunGroups(userId),
    messages: [...page].reverse(),
    nextCursor: more ? page.at(-1)?.id : undefined,
  };
}

export async function send(
  userId: string,
  groupId: string,
  input: { kind: "TEXT" | "PHOTO"; body?: string; mediaId?: string },
) {
  await seat(userId, groupId);

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
  if (message.senderId !== userId && !(await canRunGroups(userId))) {
    throw forbidden("تحذف رسائلك وحدها");
  }
  await prisma.groupMessage.delete({ where: { id: message.id } });
  if (message.mediaId) await dropMedia([message.mediaId]);
  return { ok: true, groupId: message.groupId };
}

export async function rename(userId: string, groupId: string, name: string) {
  await requireRunner(userId);
  const clean = cleanName(name);
  await guard(clean);
  await prisma.chatGroup.update({ where: { id: groupId }, data: { name: clean } });
  return { ok: true };
}

export async function addMembers(userId: string, groupId: string, ids: string[]) {
  await requireRunner(userId);
  const group = await prisma.chatGroup.findUnique({
    where: { id: groupId },
    select: { _count: { select: { members: true } } },
  });
  if (!group) throw notFound("المجموعة غير موجودة");
  const real = await realUsers(ids);
  if (group._count.members + real.length > MEMBERS_MAX) {
    throw badRequest(`الحدّ ${MEMBERS_MAX} عضواً`);
  }
  await prisma.chatGroupMember.createMany({
    data: real.map((id) => ({ groupId, userId: id })),
    skipDuplicates: true,
  });
  return { ok: true };
}

/** إخراجُ عضو: المشرف يُخرج غيره، وكلُّ عضوٍ يغادر بنفسه. */
export async function removeMember(userId: string, groupId: string, memberId: string) {
  if (memberId !== userId) await requireRunner(userId);
  else await seat(userId, groupId);
  await prisma.chatGroupMember.deleteMany({ where: { groupId, userId: memberId } });
  return { ok: true };
}

/** حذفُ المجموعة كلّها — بصور رسائلها (القاعدة ١٠٤). */
export async function remove(userId: string, groupId: string) {
  await requireRunner(userId);
  const files = await prisma.groupMessage.findMany({
    where: { groupId, mediaId: { not: null } },
    select: { mediaId: true },
  });
  await prisma.chatGroup.deleteMany({ where: { id: groupId } });
  await dropMedia(files.flatMap((row) => (row.mediaId ? [row.mediaId] : [])));
  return { ok: true };
}

/**
 * من يُضاف: **برقم العضويّة** — **بقرار المالك**، فهو ما يُقال ويُكتب (القاعدة ١٥)
 * ولا يلتبس كالأسماء. رقمٌ أو أرقامٌ يفصلها فراغٌ أو فاصلة، والأرقامُ العربيّة
 * تُحوَّل. وللمشرف وحده، فلا ينقض منعَ البحث عن الناس (القاعدة ٢٠).
 */
export async function candidates(userId: string, query: string) {
  await requireRunner(userId);
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
  const files = await prisma.groupMessage.findMany({
    where: { createdAt: { lt: cutoff }, mediaId: { not: null } },
    select: { mediaId: true },
    take: 500,
  });
  const { count } = await prisma.groupMessage.deleteMany({ where: { createdAt: { lt: cutoff } } });
  const ids = files.flatMap((row) => (row.mediaId ? [row.mediaId] : []));
  if (ids.length > 0) await dropMedia(ids);
  return count;
}
