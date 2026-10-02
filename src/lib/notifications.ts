import "server-only";
import { prisma } from "@/lib/db";
import { blockedWith } from "@/lib/visibility";

export type NoteKind = "REACTION" | "COMMENT" | "TAG" | "FRIEND" | "MESSAGE" | "GIFT" | "STORE";

export type Note = {
  id: string;
  kind: NoteKind;
  at: Date;
  text: string;
  href: string;
  /**
   * من فعل. وهو **اختياريّ**: خبرُ المتجر لا صاحب له — صنفٌ جديد
   * ليس فعلَ أحدٍ بك، فيجلس في مكان الصورة رسمُ الصنف نفسه.
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
 * جدولٌ ثالثٌ للإشعارات يعني كتابةً عند كل تفاعل وتعليق وإشارة، ثم مسحاً
 * حين تُحذف اللحظة أو الحساب. الاشتقاق يبقيها صادقة دائماً: ما تراه هو
 * ما في القاعدة الآن، لا نسخةٌ منه قديمة.
 */
/** عمرُ خبر المتجر: ثلاثة أيام كنافذة «الجديد» في عدّاد التبويب. */
const NEW_ITEM_DAYS = 3;
/**
 * عمرُ الإشعار ١٥ يوماً — **بقرار المالك**: ما مضى عليه أكثرُ يختفي من كل
 * مكانٍ وحده. ولأنّها تُشتقّ (القاعدة ٢٥) فلا صفَّ يُمحى: شرطٌ في الاشتقاق
 * نفسه في الخادم والويب، فلا يعود بتحديثٍ ولا يبقى في مكانٍ دون آخر.
 */
const NOTE_DAYS = 15;

export async function notifications(userId: string, limit = 40): Promise<Note[]> {
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { notifyOnTag: true, notesClearedAt: true, createdAt: true },
  });
  // ما حذفه صاحبُه في التطبيق لا يعود هنا (الحذفُ «من كل مكان»).
  const dismissed = new Set(
    (await prisma.noteDismissal.findMany({ where: { userId }, select: { noteId: true } })).map(
      (row) => row.noteId,
    ),
  );
  const hidden = new Set(await blockedWith(userId));

  const person = { select: { id: true, name: true, avatarMediaId: true } };

  const [reactions, comments, tags, friendships, messages, gifts, fresh, grants] = await Promise.all([
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
      جديدُ المتجر: خبرٌ لا فعل.

      ويُشتقّ من `createdAt` كبقية الإشعارات (القاعدة ٢٥) لا من جدولٍ
      يُكتب لكل مستخدمٍ عند كل إضافة — مئة صنفٍ في ألف حساب مئةُ ألف
      صفّ لخبرٍ عمرُه ثلاثة أيام. والمخفيُّ لا يُخبَر عنه، وما يُكتسب
      بالوقت كذلك: ليس وصولاً جديداً إلى المتجر.
    */
    prisma.storeItem.findMany({
      where: {
        hidden: false,
        earnedAfterDays: null,
        /*
          ولا ما سبق الحساب: من سجّل اليوم لم يفُته شيء، وخبرُ صنفٍ رُفع قبل
          وجوده لا يُقرأ «جديداً» عنده.
        */
        createdAt: {
          gt: new Date(
            Math.max(Date.now() - NEW_ITEM_DAYS * 86_400_000, me?.createdAt.getTime() ?? 0),
          ),
        },
      },
      select: { id: true, name: true, spec: true, mediaId: true, createdAt: true, limited: true },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    // نقاطٌ منحتها الإدارة (القاعدة ١٩٨) — خبرٌ من التطبيق لا من صديق.
    prisma.coinGrant.findMany({
      where: { userId },
      select: { id: true, coins: true, note: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const notes: Note[] = [
    ...reactions.map((row) => ({
      id: `r-${row.id}`,
      kind: "REACTION" as const,
      at: row.createdAt,
      text: `${row.user.name} تفاعل مع لحظتك`,
      href: `/m/${row.momentId}`,
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
      href: `/m/${row.momentId}`,
      person: row.user,
      thumb: row.moment.mediaId,
    })),
    ...tags.map((row) => ({
      id: `t-${row.id}`,
      kind: "TAG" as const,
      at: row.moment.createdAt,
      text: `${row.moment.author.name} أشار إليك في لحظة`,
      href: `/m/${row.moment.id}`,
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
        href: row.status === "ACCEPTED" ? `/u/${other.id}` : "/circle",
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
              href: "/me",
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
      href: "/store",
      item: { spec: row.spec, mediaId: row.mediaId },
    })),
    ...grants.map((row) => ({
      // `k-` لا `c-`: الأخيرةُ للتعليقات.
      id: `k-${row.id}`,
      kind: "STORE" as const,
      at: row.createdAt,
      text: grantText(row.coins, row.note),
      href: "/store",
    })),
    ...messages.map((row) => ({
      id: `m-${row.id}`,
      kind: "MESSAGE" as const,
      at: row.createdAt,
      text: `رسالة من ${row.sender.name}: ${row.body.slice(0, 40)}`,
      href: `/messages/${row.conversationId}`,
      person: row.sender,
    })),
  ];

  return notes
    // وما لا صاحب له لا يُحجب: خبرُ المتجر ليس من أحد.
    .filter((note) => !note.person || !hidden.has(note.person.id))
    .filter(
      (note) =>
        note.at.getTime() >
          Math.max(me?.notesClearedAt?.getTime() ?? 0, Date.now() - NOTE_DAYS * 86_400_000) &&
        !dismissed.has(note.id),
    )
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, limit);
}

export async function unseenCount(userId: string): Promise<number> {
  return (await notifications(userId, 40)).filter(
    (note) => Date.now() - note.at.getTime() < 3 * 24 * 60 * 60 * 1000,
  ).length;
}

/** «لأنك تستحق! تمّ منحك ٥٠٠ نقطة من قبل الإدارة» — بنصّ المالك (القاعدة ١٩٨). */
export function grantText(coins: number, note: string | null): string {
  const n = coins.toLocaleString("ar-SA");
  return `لأنك تستحق! تمّ منحك ${n} نقطة من قبل الإدارة${note ? ` — ${note}` : ""}`;
}
