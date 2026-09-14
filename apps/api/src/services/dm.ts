import { prisma } from "@athar/db";
import { MESSAGE_KEEP_DAYS, VOICE_SECONDS } from "@athar/shared";
import { badRequest, forbidden, notFound } from "../lib/errors";
import { circleIds } from "./visibility";

/**
 * المحادثات الخاصة.
 *
 * للدائرة وحدها: قبل قبول الصداقة لا محادثة. وكل قراءةٍ وكتابةٍ تمرّ
 * على `mine()` — الطرف يُثبَت من القاعدة لا من معرّفٍ في الطلب.
 */

/** الطرفان مرتّبان دائماً، فيكون للزوج صفٌّ واحد مهما بدأ المحادثة. */
export function pairKey(x: string, y: string) {
  return x < y ? { aId: x, bId: y } : { aId: y, bId: x };
}

/** طرف المحادثة كما يُعرض. */
const PERSON = {
  id: true,
  name: true,
  isPlus: true,
  lastSeenAt: true,
  avatarMediaId: true,
  frame: { select: { spec: true, mediaId: true } },
  charm: { select: { spec: true, mediaId: true } },
  tag: { select: { name: true, bg: true, fg: true } },
} as const;

const MESSAGE = {
  id: true,
  body: true,
  kind: true,
  mediaId: true,
  seconds: true,
  senderId: true,
  createdAt: true,
  deliveredAt: true,
  readAt: true,
  editedAt: true,
} as const;

/** المحادثة لا تُفتح إلا بين من قُبلت بينهما الصداقة. */
export async function open(userId: string, otherId: string) {
  if (userId === otherId) throw badRequest("لا يمكنك محادثة نفسك");

  const circle = await circleIds(userId);
  if (!circle.includes(otherId)) throw forbidden("المحادثة بعد قبول الإضافة");

  const { aId, bId } = pairKey(userId, otherId);
  const conversation = await prisma.conversation.upsert({
    where: { aId_bId: { aId, bId } },
    create: { aId, bId },
    update: {},
    select: { id: true },
  });
  return { id: conversation.id };
}

/** قائمة المحادثات وآخر رسالةٍ في كلٍّ وعدد ما لم يُقرأ. */
export async function list(userId: string) {
  const rows = await prisma.conversation.findMany({
    where: { OR: [{ aId: userId }, { bId: userId }] },
    select: {
      id: true,
      updatedAt: true,
      a: { select: PERSON },
      b: { select: PERSON },
      messages: { select: MESSAGE, orderBy: { createdAt: "desc" }, take: 1 },
      _count: {
        select: { messages: { where: { senderId: { not: userId }, readAt: null } } },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return {
    conversations: rows.map((row) => ({
      id: row.id,
      updatedAt: row.updatedAt,
      other: row.a.id === userId ? row.b : row.a,
      last: row.messages[0] ?? null,
      unseen: row._count.messages,
    })),
  };
}

/** يثبت أن المستخدم طرفٌ في المحادثة، ويردّ الطرفين. */
async function mine(userId: string, conversationId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, aId: true, bId: true },
  });
  if (!conversation) throw notFound("المحادثة غير موجودة");
  if (conversation.aId !== userId && conversation.bId !== userId) {
    // «ليست لك» تقول إنّها موجودة؛ و«غير موجودة» لا تقول شيئاً.
    throw notFound("المحادثة غير موجودة");
  }
  return conversation;
}

/** الطرف الآخر — إليه تُدفع الأحداث. */
export const otherSide = (conversation: { aId: string; bId: string }, userId: string) =>
  conversation.aId === userId ? conversation.bId : conversation.aId;

/** محادثةٌ برسائلها، بصفحاتٍ بمؤشّر: الأحدث أولاً ثم ما قبله. */
export async function thread(
  userId: string,
  conversationId: string,
  options: { cursor?: string; limit: number },
) {
  await mine(userId, conversationId);

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, a: { select: PERSON }, b: { select: PERSON } },
  });
  if (!conversation) throw notFound("المحادثة غير موجودة");

  const rows = await prisma.message.findMany({
    where: { conversationId },
    select: MESSAGE,
    orderBy: { createdAt: "desc" },
    take: options.limit + 1,
    cursor: options.cursor ? { id: options.cursor } : undefined,
    skip: options.cursor ? 1 : 0,
  });

  const more = rows.length > options.limit;
  const page = more ? rows.slice(0, options.limit) : rows;

  return {
    id: conversation.id,
    other: conversation.a.id === userId ? conversation.b : conversation.a,
    // تُقلب لتُعرض بترتيب الزمن، والمؤشّر يبقى على الأقدم في الصفحة.
    messages: [...page].reverse(),
    nextCursor: more ? page.at(-1)?.id : undefined,
  };
}

/** الملف المرفق لمرسله ومعتمدٌ وبالنوع الذي يدّعيه. */
async function ownMedia(userId: string, mediaId: string, kind: "audio" | "image") {
  const media = await prisma.media.findFirst({
    where: { id: mediaId, ownerId: userId, ready: true },
    select: { id: true, mime: true },
  });
  if (!media) throw notFound("الملف غير موجود");
  const family = kind === "audio" ? "audio/" : "image/";
  if (!media.mime.startsWith(family)) throw badRequest("صيغة غير مدعومة");
  return media.id;
}

type Sent = Awaited<ReturnType<typeof send>>;

/**
 * إرسال: نصّاً أو صوتاً أو صورة.
 *
 * والمعاملة واحدة: الرسالة وطابع المحادثة يُكتبان معاً — رسالةٌ تُكتب
 * ولا يرتفع طابع محادثتها تبقى تحت القائمة ولا يراها صاحبها.
 */
export async function send(
  userId: string,
  conversationId: string,
  input: { kind: "TEXT" | "VOICE" | "PHOTO"; body?: string; mediaId?: string; seconds?: number },
) {
  const conversation = await mine(userId, conversationId);

  let body = "";
  let mediaId: string | null = null;
  let seconds: number | null = null;

  if (input.kind === "TEXT") {
    body = (input.body ?? "").trim().slice(0, 2000);
    if (!body) throw badRequest("اكتب شيئاً");
  } else if (input.kind === "VOICE") {
    if (!input.mediaId) throw badRequest("ما وصل التسجيل");
    mediaId = await ownMedia(userId, input.mediaId, "audio");

    // الحدّ عشرون ثانية ومئةٌ وعشرون للمشترك — يُفحص هنا لأنّ الشاشة
    // ليست حدّاً، والمدّة الحقيقية قيست من الملف عند اعتماده.
    const me = await prisma.user.findUnique({
      where: { id: userId },
      select: { isPlus: true },
    });
    const cap = me?.isPlus ? VOICE_SECONDS.plus : VOICE_SECONDS.free;
    seconds = Math.round(input.seconds ?? 0);
    if (seconds < 1) throw badRequest("التسجيل قصير جداً");
    if (seconds > cap) {
      throw badRequest(
        me?.isPlus ? `الحدّ ${cap} ثانية` : `الحدّ ${cap} ثانية — ومع أثر+ ${VOICE_SECONDS.plus}`,
      );
    }
  } else {
    if (!input.mediaId) throw badRequest("ما وصلت الصورة");
    mediaId = await ownMedia(userId, input.mediaId, "image");
  }

  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: { conversationId, senderId: userId, body, kind: input.kind, mediaId, seconds },
      select: MESSAGE,
    }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    }),
  ]);

  return { message, to: otherSide(conversation, userId), conversationId };
}

/** تعديل رسالة: لصاحبها وحده، ويبقى أثر التعديل ظاهراً للطرفين. */
export async function edit(userId: string, messageId: string, body: string) {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { senderId: true, conversationId: true, body: true, kind: true },
  });
  if (!message) throw notFound("الرسالة غير موجودة");
  if (message.senderId !== userId) throw forbidden("لا تُعدَّل رسالة غيرك");
  if (message.kind !== "TEXT") throw badRequest("النصّ وحده يُعدَّل");

  const clean = body.trim().slice(0, 2000);
  if (!clean) throw badRequest("اكتب شيئاً");

  const conversation = await mine(userId, message.conversationId);
  const updated = await prisma.message.update({
    where: { id: messageId },
    data: { body: clean, editedAt: new Date() },
    select: MESSAGE,
  });
  return { message: updated, to: otherSide(conversation, userId), conversationId: conversation.id };
}

/** حذف محادثة: للطرفين — لا نصف حذفٍ يبقي نسخةً عند الآخر بلا علمه. */
export async function remove(userId: string, conversationId: string) {
  const conversation = await mine(userId, conversationId);
  await prisma.conversation.delete({ where: { id: conversationId } });
  return { ok: true, to: otherSide(conversation, userId), conversationId };
}

/** «قُرئت»: والقراءة تستلزم التسليم فيُكتبان معاً. */
export async function markRead(userId: string, conversationId: string) {
  const conversation = await mine(userId, conversationId);
  const now = new Date();
  const { count } = await prisma.message.updateMany({
    where: { conversationId, senderId: { not: userId }, readAt: null },
    data: { readAt: now, deliveredAt: now },
  });
  return { read: count, to: otherSide(conversation, userId), conversationId };
}

/** «وصلت»: كل ما لم يُسلَّم في محادثات هذا الشخص. */
export async function markDelivered(userId: string) {
  const { count } = await prisma.message.updateMany({
    where: {
      senderId: { not: userId },
      deliveredAt: null,
      conversation: { OR: [{ aId: userId }, { bId: userId }] },
    },
    data: { deliveredAt: new Date() },
  });
  return { delivered: count };
}

export async function unreadCount(userId: string) {
  const count = await prisma.message.count({
    where: {
      readAt: null,
      senderId: { not: userId },
      conversation: { OR: [{ aId: userId }, { bId: userId }] },
    },
  });
  return { unread: count };
}

/**
 * كنس ما تجاوز ثلاثين يوماً.
 *
 * حذفٌ فعليّ من القاعدة لا إخفاءٌ في الاستعلام: «لا نحتفظ بها» تعني
 * ألّا تبقى صفوفها. والمحادثة التي لم يبقَ فيها شيء تذهب معها — صفٌّ
 * فارغ يبقي اسم من حادثتَ وتاريخَه بلا سبب.
 */
export async function sweepOld(): Promise<number> {
  const cutoff = new Date(Date.now() - MESSAGE_KEEP_DAYS * 86_400_000);

  // الملفات أولاً: حذف الرسالة يُفرغ `mediaId` ويترك بكسلاتها في الدلو.
  const orphans = await prisma.message.findMany({
    where: { createdAt: { lt: cutoff }, mediaId: { not: null } },
    select: { mediaId: true },
    take: 500,
  });

  const { count } = await prisma.message.deleteMany({ where: { createdAt: { lt: cutoff } } });
  await prisma.conversation.deleteMany({
    where: { messages: { none: {} }, createdAt: { lt: cutoff } },
  });

  const ids = orphans.map((row) => row.mediaId).filter((id): id is string => !!id);
  if (ids.length > 0) {
    const { dropMedia } = await import("./media");
    await dropMedia(ids);
  }
  return count;
}

export type { Sent };
