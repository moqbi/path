import "server-only";
import { prisma } from "@/lib/db";
import { circleIds } from "@/lib/circle";

/** الطرفان مرتّبان دائماً، فيكون للزوج صفٌّ واحد مهما بدأ المحادثة. */
export function pairKey(x: string, y: string): { aId: string; bId: string } {
  return x < y ? { aId: x, bId: y } : { aId: y, bId: x };
}

/** المحادثة لا تُفتح إلا بين من قُبلت بينهما الصداقة. */
export async function openConversation(me: string, other: string): Promise<string> {
  if (me === other) throw new Error("لا يمكنك محادثة نفسك");

  const circle = await circleIds(me);
  if (!circle.includes(other)) throw new Error("المحادثة للأصدقاء فقط");

  const { aId, bId } = pairKey(me, other);
  const conversation = await prisma.conversation.upsert({
    where: { aId_bId: { aId, bId } },
    create: { aId, bId },
    update: {},
    select: { id: true },
  });
  return conversation.id;
}

/** طرف المحادثة: صورته ووسمه — نفس ما يُعرض في بقية الشاشات. */
const PERSON = {
  id: true,
  name: true,
  isPlus: true,
  lastSeenAt: true,
  avatarMediaId: true,
  frame: { select: { spec: true } },
  tag: { select: { name: true, bg: true, fg: true } },
} as const;

export async function conversationsFor(userId: string) {
  const rows = await prisma.conversation.findMany({
    where: { OR: [{ aId: userId }, { bId: userId }] },
    select: {
      id: true,
      updatedAt: true,
      a: { select: PERSON },
      b: { select: PERSON },
      messages: {
        select: {
          body: true,
          createdAt: true,
          senderId: true,
          deliveredAt: true,
          readAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      _count: {
        select: { messages: { where: { senderId: { not: userId }, readAt: null } } },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return rows.map((row) => {
    const other = row.a.id === userId ? row.b : row.a;
    const last = row.messages[0] ?? null;
    return {
      id: row.id,
      other,
      last,
      unread: row._count.messages > 0,
      // الشارة تقول كم رسالة تنتظر، لا «فيه جديد» وحدها.
      unseen: row._count.messages,
    };
  });
}

/** يتحقق أن المستخدم طرف في المحادثة قبل أي قراءة أو كتابة. */
export async function conversationFor(userId: string, conversationId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      a: { select: PERSON },
      b: { select: PERSON },
      messages: {
        select: {
          id: true,
          body: true,
          senderId: true,
          createdAt: true,
          deliveredAt: true,
          readAt: true,
          editedAt: true,
        },
        orderBy: { createdAt: "asc" },
        take: 200,
      },
    },
  });
  if (!conversation) return null;
  if (conversation.a.id !== userId && conversation.b.id !== userId) return null;

  return {
    ...conversation,
    other: conversation.a.id === userId ? conversation.b : conversation.a,
  };
}

/**
 * التسليم: حضورُ المستلم على الشاشة هو دليل الوصول — لا خادم دائم بيننا
 * يخبرنا أنّ الرسالة نزلت جهازه. تُستدعى مع ختم الحضور ومع فتح المحادثات.
 */
export async function deliverTo(userId: string): Promise<void> {
  try {
    await prisma.message.updateMany({
      where: {
        senderId: { not: userId },
        deliveredAt: null,
        conversation: { OR: [{ aId: userId }, { bId: userId }] },
      },
      data: { deliveredAt: new Date() },
    });
  } catch {}
}

export async function unreadCount(userId: string): Promise<number> {
  return prisma.message.count({
    where: {
      readAt: null,
      senderId: { not: userId },
      conversation: { OR: [{ aId: userId }, { bId: userId }] },
    },
  });
}
