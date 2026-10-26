import { prisma } from "@athar/db";
import { STATUS_COMMENT_MAX } from "@athar/shared";
import { guard } from "../lib/moderation";
import { badRequest, notFound, tooMany } from "../lib/errors";
import { visibleAuthors } from "./visibility";
import { storyVisibleTo } from "./stories";
import { noteVisibleTo } from "./notes";
import { push } from "./push";

/**
 * التفاعلاتُ والتعليقاتُ تطفو على القصّة والنوت (القاعدة ٣٤٤) — **بقرار المالك**، كساوندكلاود:
 * من يفتحها يرى ما تفاعل به الناسُ وما كتبوه يطير على الشاشة. **بلا أسماء** — الوجهُ نوعٌ
 * والتعليقُ نصٌّ، ولا يُرسل معرّفُ أحدٍ لأحد ولا لصاحبها. والكاتبُ محفوظٌ في الصفّ للحذف
 * والبلاغ وحدهما. ومن يرى القصّة أو النوت وحده يقرأ ويكتب («غير موجودة» لغيره — القاعدة ٢٣ب).
 */

type Target = { kind: "story" | "note"; id: string };

const GONE = { story: "القصة غير موجودة", note: "النوت غير موجودة" } as const;

/** ما عُلّق عليه لمن يراه وحده — بشروط قراءته نفسها. */
async function reach(userId: string, target: Target) {
  const now = new Date();
  const row =
    target.kind === "story"
      ? await prisma.story.findFirst({
          where: { id: target.id, expiresAt: { gt: now }, ...storyVisibleTo(userId) },
          select: { authorId: true },
        })
      : await prisma.statusNote.findFirst({
          where: { id: target.id, expiresAt: { gt: now }, ...noteVisibleTo(userId) },
          select: { authorId: true },
        });
  if (!row) throw notFound(GONE[target.kind]);
  if (row.authorId !== userId && !(await visibleAuthors(userId)).includes(row.authorId)) {
    throw notFound(GONE[target.kind]);
  }
  return row.authorId;
}

const on = (target: Target) => (target.kind === "story" ? { storyId: target.id } : { noteId: target.id });

/** ما يطفو: تفاعلاتٌ بأنواعها وتعليقاتٌ بنصوصها — بلا أسماء. */
export async function floats(userId: string, target: Target) {
  const owner = await reach(userId, target);
  const [reactions, comments] = await Promise.all([
    target.kind === "story"
      ? prisma.storyView.findMany({
          where: { storyId: target.id, reaction: { not: null } },
          select: { reaction: true, reactedAt: true, userId: true },
          orderBy: { reactedAt: "desc" },
          take: 60,
        })
      : prisma.noteView.findMany({
          where: { noteId: target.id, reaction: { not: null } },
          select: { reaction: true, reactedAt: true, userId: true },
          orderBy: { reactedAt: "desc" },
          take: 60,
        }),
    prisma.statusComment.findMany({
      where: on(target),
      select: { id: true, body: true, createdAt: true, userId: true },
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
  ]);
  return {
    // وتفاعلُ القارئ نفسه يطير له أيضاً — **بقرار المالك**: كان يُحذف فلا يرى صديقٌ تفاعل
    // شيئاً يطير، فقُرئ أنّ الطيرانَ لصاحبها وحده.
    reactions: reactions.map((row) => ({ kind: row.reaction!, at: row.reactedAt })),
    comments: comments.reverse().map((row) => ({
      id: row.id,
      body: row.body,
      at: row.createdAt,
      mine: row.userId === userId,
      // صاحبُ القصّة يحذف ما كُتب على قصّته، والكاتبُ ما كتبه.
      canDelete: row.userId === userId || owner === userId,
    })),
  };
}

/** تعليقٌ يطفو — سطرٌ قصير يمرّ بقائمة الكلمات، ومحدودٌ لكلّ حساب. */
export async function comment(userId: string, target: Target, raw: string) {
  const body = raw.trim().replace(/\s+/g, " ");
  if (!body) throw badRequest("اكتب شيئاً");
  if (body.length > STATUS_COMMENT_MAX) throw badRequest(`التعليق ${STATUS_COMMENT_MAX} حرفاً على الأكثر`);
  const owner = await reach(userId, target);
  // عشرةٌ على الشيء الواحد في ساعة: تعليقٌ بلا اسمٍ لا يصير سيلاً على قصّة أحد.
  const recent = await prisma.statusComment.count({
    where: { userId, ...on(target), createdAt: { gt: new Date(Date.now() - 3_600_000) } },
  });
  if (recent >= 10) throw tooMany("كفاية تعليقات على هذي — جرّب بعد شوي");
  await guard(body);
  const row = await prisma.statusComment.create({
    data: { userId, body, ...on(target) },
    select: { id: true, body: true, createdAt: true },
  });
  if (owner !== userId) {
    // الجرسُ بلا اسمٍ كالتعليق نفسه.
    void push({
      userId: owner,
      kind: "COMMENT",
      title: target.kind === "story" ? "تعليق جديد على قصتك" : "تعليق جديد على نوتك",
      body,
      path: target.kind === "story" ? `/stories/${owner}` : "/circle",
    });
  }
  return { id: row.id, body: row.body, at: row.createdAt, mine: true, canDelete: true };
}

/** يحذفه كاتبُه أو صاحبُ ما عُلّق عليه. */
export async function removeComment(userId: string, commentId: string) {
  const row = await prisma.statusComment.findUnique({
    where: { id: commentId },
    select: { userId: true, story: { select: { authorId: true } }, note: { select: { authorId: true } } },
  });
  const owner = row?.story?.authorId ?? row?.note?.authorId;
  if (!row || (row.userId !== userId && owner !== userId)) throw notFound("التعليق غير موجود");
  await prisma.statusComment.delete({ where: { id: commentId } });
  return { ok: true };
}
