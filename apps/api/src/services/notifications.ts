import { prisma } from "@athar/db";
import { blockedWith } from "./visibility";

export type NoteKind = "REACTION" | "COMMENT" | "TAG" | "FRIEND" | "MESSAGE" | "GIFT" | "STORE";

export type Note = {
  id: string;
  kind: NoteKind;
  at: Date;
  text: string;
  /** وجهةٌ منطقية: `moment:<id>` أو `user:<id>` أو `dm:<id>` أو `circle` أو `me`. */
  href: string;
  /**
   * من فعل. وهو **اختياريّ**: خبرُ المتجر لا صاحب له — صنفٌ جديد ليس
   * فعلَ أحدٍ بك، فيجلس في مكان الصورة رسمُ الصنف نفسه.
   */
  person?: { id: string; name: string; avatarMediaId: string | null };
  /** رسمُ صنف المتجر في خبره: صورته إن رُفعت، وإلا تدرّجه. */
  item?: { spec: string; mediaId: string | null };
  emoji?: string | null;
  reaction?: string;
  /** صورة اللحظة المعنية — تظهر مصغّرة في طرف الصف. */
  thumb?: string | null;
};

/**
 * الإشعارات تُشتقّ من الجداول القائمة ولا تُخزَّن.
 *
 * نسخةٌ من `src/lib/notifications.ts`: النسخ متعمّد ومؤقّت حتى تُسحب
 * `src/`. والفرق الوحيد أنّ `href` هنا مسارٌ منطقيّ يفهمه الموبايل
 * والويب معاً، لا مسار صفحةٍ في Next.
 *
 * جدولٌ ثالثٌ للإشعارات يعني كتابةً عند كل تفاعل وتعليق وإشارة، ثم مسحاً
 * حين تُحذف اللحظة أو الحساب. الاشتقاق يبقيها صادقة دائماً: ما تراه هو
 * ما في القاعدة الآن، لا نسخةٌ منه قديمة.
 */
/** عمرُ خبر المتجر: ثلاثة أيام كنافذة «الجديد» في عدّاد التبويب. */
const NEW_ITEM_DAYS = 3;

/**
 * خبيئةٌ قصيرة للاشتقاق.
 *
 * الاشتقاقُ ثمانيةُ استعلاماتٍ في كلّ فتحة تبويب، والتبويبُ يُفتح
 * ويُغلق ويُسحب للتحديث في دقيقة. وخمسٌ وأربعون ثانية لا يُحسّها أحد:
 * من تفاعل معك الآن يراه بعدها، ومن سحب للتحديث يراه — لأنّ السحب
 * يُبطلها.
 *
 * وفي الذاكرة لا في Redis: نسخةٌ واحدة من الخادم اليوم، وعند تعدّدها
 * تصير كلُّ نسخةٍ خبيئتَها وهذا مقبول — أسوأُ ما يقع أن يرى المستخدم
 * خبراً متأخّراً خمسَ عشرة ثانية.
 */
const CACHE_MS = 45_000;
const cache = new Map<string, { at: number; notes: Note[] }>();

/** يُنسى ما خُبّئ لصاحبه — يُنادى عند فعلٍ يغيّر ما يُشتقّ. */
export function forgetNotifications(userId: string): void {
  cache.delete(userId);
}

export async function notifications(userId: string, limit = 40): Promise<Note[]> {
  const fresh = cache.get(userId);
  if (fresh && Date.now() - fresh.at < CACHE_MS) return fresh.notes.slice(0, limit);

  const notes = await derive(userId, limit);

  // كنسٌ كسول: ما بردت خبيئتُه يُحذف عند أوّل مرورٍ بعد المئة.
  if (cache.size > 100) {
    const now = Date.now();
    for (const [key, row] of cache) if (now - row.at > CACHE_MS) cache.delete(key);
  }
  cache.set(userId, { at: Date.now(), notes });
  return notes;
}

async function derive(userId: string, limit: number): Promise<Note[]> {
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { notifyOnTag: true, notesClearedAt: true },
  });
  const dismissed = new Set(
    (await prisma.noteDismissal.findMany({ where: { userId }, select: { noteId: true } })).map(
      (row) => row.noteId,
    ),
  );
  const clearedAt = me?.notesClearedAt?.getTime() ?? 0;
  const hidden = new Set(await blockedWith(userId));

  const person = { select: { id: true, name: true, avatarMediaId: true } };

  const [reactions, comments, tags, friendships, messages, gifts, fresh] = await Promise.all([
    prisma.reaction.findMany({
      where: { moment: { authorId: userId }, userId: { not: userId } },
      select: {
        id: true,
        kind: true,
        emoji: true,
        createdAt: true,
        momentId: true,
        moment: { select: { mediaId: true } },
        user: person,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.comment.findMany({
      where: { moment: { authorId: userId }, userId: { not: userId } },
      select: {
        id: true,
        body: true,
        createdAt: true,
        momentId: true,
        moment: { select: { mediaId: true } },
        user: person,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    me?.notifyOnTag === false
      ? []
      : prisma.momentTag.findMany({
          where: { userId, moment: { authorId: { not: userId } } },
          select: {
            id: true,
            moment: { select: { id: true, createdAt: true, mediaId: true, author: person } },
          },
          orderBy: { moment: { createdAt: "desc" } },
          take: limit,
        }),
    prisma.friendship.findMany({
      where: {
        OR: [
          { requesterId: userId, status: "ACCEPTED" },
          { addresseeId: userId },
        ],
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        requesterId: true,
        requester: person,
        addressee: person,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.message.findMany({
      where: {
        senderId: { not: userId },
        readAt: null,
        conversation: { OR: [{ aId: userId }, { bId: userId }] },
      },
      select: { id: true, body: true, createdAt: true, conversationId: true, sender: person },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    // الهدايا تُشتقّ من الشراء نفسه: من دفع ومن ملك ومتى.
    prisma.purchase.findMany({
      where: { userId, giftedById: { not: null } },
      select: {
        id: true,
        createdAt: true,
        item: { select: { name: true } },
        giftedBy: person,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    /*
      جديدُ المتجر: خبرٌ لا فعل — ويُشتقّ من `createdAt` كبقيّته لا من
      جدولٍ يُكتب لكل مستخدمٍ عند كل إضافة. والمخفيُّ لا يُخبَر عنه،
      وما يُكتسب بالوقت كذلك: ليس وصولاً جديداً إلى المتجر.
    */
    prisma.storeItem.findMany({
      where: {
        hidden: false,
        earnedAfterDays: null,
        createdAt: { gt: new Date(Date.now() - NEW_ITEM_DAYS * 86_400_000) },
      },
      select: { id: true, name: true, spec: true, mediaId: true, createdAt: true, limited: true },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  const notes: Note[] = [
    ...reactions.map((row) => ({
      id: `r-${row.id}`,
      kind: "REACTION" as const,
      at: row.createdAt,
      text: `${row.user.name} تفاعل مع لحظتك`,
      href: `moment:${row.momentId}`,
      person: row.user,
      reaction: row.kind,
      emoji: row.emoji,
      thumb: row.moment.mediaId,
    })),
    ...comments.map((row) => ({
      id: `c-${row.id}`,
      kind: "COMMENT" as const,
      at: row.createdAt,
      text: `${row.user.name} علّق: ${row.body.slice(0, 40)}`,
      href: `moment:${row.momentId}`,
      person: row.user,
      thumb: row.moment.mediaId,
    })),
    ...tags.map((row) => ({
      id: `t-${row.id}`,
      kind: "TAG" as const,
      at: row.moment.createdAt,
      text: `${row.moment.author.name} أشار إليك في لحظة`,
      href: `moment:${row.moment.id}`,
      person: row.moment.author,
      thumb: row.moment.mediaId,
    })),
    ...friendships.map((row) => {
      const mine = row.requesterId === userId;
      const other = mine ? row.addressee : row.requester;
      const text =
        row.status === "ACCEPTED"
          ? mine
            ? `${other.name} قبل إضافتك`
            : `${other.name} صار في دائرتك`
          : `${other.name} يريد إضافتك`;
      return {
        id: `f-${row.id}`,
        kind: "FRIEND" as const,
        at: row.createdAt,
        text,
        href: row.status === "ACCEPTED" ? `user:${other.id}` : "circle",
        person: other,
      };
    }),
    ...gifts.flatMap((row) =>
      row.giftedBy
        ? [
            {
              id: `g-${row.id}`,
              kind: "GIFT" as const,
              at: row.createdAt,
              text: `${row.giftedBy.name} أهداك ${row.item.name}`,
              href: "me",
              person: row.giftedBy,
            },
          ]
        : [],
    ),
    ...fresh.map((row) => ({
      id: `s-${row.id}`,
      kind: "STORE" as const,
      at: row.createdAt,
      text: row.limited ? `${row.name} في المتجر — لفترة محدودة` : `${row.name} وصل المتجر`,
      href: "store",
      item: { spec: row.spec, mediaId: row.mediaId },
    })),
    ...messages.map((row) => ({
      id: `m-${row.id}`,
      kind: "MESSAGE" as const,
      at: row.createdAt,
      text: `رسالة من ${row.sender.name}: ${row.body.slice(0, 40)}`,
      href: `dm:${row.conversationId}`,
      person: row.sender,
    })),
  ];

  return notes
    // وما لا صاحب له لا يُحجب: خبرُ المتجر ليس من أحد.
    .filter((note) => !note.person || !hidden.has(note.person.id))
    // وما حذفه صاحبُه لا يعود: بالسحب واحداً، أو بـ«احذف الكل».
    .filter((note) => note.at.getTime() > clearedAt && !dismissed.has(note.id))
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, limit);
}

export async function unseenCount(userId: string): Promise<number> {
  return (await notifications(userId, 40)).filter(
    (note) => Date.now() - note.at.getTime() < 3 * 24 * 60 * 60 * 1000,
  ).length;
}

/** حذفُ إشعارٍ واحد بالسحب — يُستثنى من الاشتقاق بعدها في كل مكان. */
export async function dismiss(userId: string, noteId: string): Promise<void> {
  await prisma.noteDismissal.upsert({
    where: { userId_noteId: { userId, noteId } },
    create: { userId, noteId },
    update: {},
  });
  forgetNotifications(userId);
}

/** «احذف الكل»: ختمٌ واحد، وما حُذف قبله واحداً واحداً لم يعد يلزم. */
export async function clearAll(userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { notesClearedAt: new Date() } }),
    prisma.noteDismissal.deleteMany({ where: { userId } }),
  ]);
  forgetNotifications(userId);
}
