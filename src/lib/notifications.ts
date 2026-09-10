import "server-only";
import { prisma } from "@/lib/db";
import { blockedWith } from "@/lib/visibility";

export type NoteKind = "REACTION" | "COMMENT" | "TAG" | "FRIEND" | "MESSAGE";

export type Note = {
  id: string;
  kind: NoteKind;
  at: Date;
  text: string;
  href: string;
  person: { id: string; name: string; avatarMediaId: string | null };
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
export async function notifications(userId: string, limit = 40): Promise<Note[]> {
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { notifyOnTag: true },
  });
  const hidden = new Set(await blockedWith(userId));

  const person = { select: { id: true, name: true, avatarMediaId: true } };

  const [reactions, comments, tags, friendships, messages] = await Promise.all([
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
    .filter((note) => !hidden.has(note.person.id))
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, limit);
}

export async function unseenCount(userId: string): Promise<number> {
  return (await notifications(userId, 40)).filter(
    (note) => Date.now() - note.at.getTime() < 3 * 24 * 60 * 60 * 1000,
  ).length;
}
