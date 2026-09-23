import { prisma } from "@athar/db";
import { badRequest, notFound } from "../lib/errors";
import { forgetWords } from "../lib/moderation";
import { dropMedia } from "./media";

/**
 * البلاغات: بابٌ للمستخدم، وبابٌ للمشرف.
 *
 * شرط متجر آبل أن يكون الإبلاغ على **كل** منشور لا على الحساب وحده،
 * ولذلك الهدف أربعةٌ: لحظة، وقصة، ورسالة، وشخص.
 *
 * والمراجعة يدويّة: لا يُحذف محتوى ببلاغٍ واحد — وإلا صار الإبلاغ
 * سلاحاً يُسكت به الناس بعضهم. المشرف يقرأ ويقرّر.
 */
export type Target = "MOMENT" | "STORY" | "MESSAGE" | "USER";

const REASONS = ["SPAM", "HATE", "SEXUAL", "VIOLENCE", "SELF_HARM", "OTHER"] as const;
export type Reason = (typeof REASONS)[number];

/** صاحب المحتوى ومتنه وقت البلاغ — المحتوى قد يُحذف قبل أن يُقرأ. */
async function subject(target: Target, targetId: string) {
  if (target === "MOMENT") {
    const row = await prisma.moment.findUnique({
      where: { id: targetId },
      select: { authorId: true, text: true, placeName: true, musicTitle: true },
    });
    if (!row) return null;
    return { ownerId: row.authorId, snippet: row.text ?? row.placeName ?? row.musicTitle ?? null };
  }

  if (target === "STORY") {
    const row = await prisma.story.findUnique({
      where: { id: targetId },
      select: { authorId: true },
    });
    return row ? { ownerId: row.authorId, snippet: null } : null;
  }

  if (target === "MESSAGE") {
    const row = await prisma.message.findUnique({
      where: { id: targetId },
      select: { senderId: true, body: true },
    });
    return row ? { ownerId: row.senderId, snippet: row.body || null } : null;
  }

  const row = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true } });
  return row ? { ownerId: row.id, snippet: null } : null;
}

export async function open(
  reporterId: string,
  input: { target: Target; targetId: string; reason: Reason; note?: string },
) {
  const found = await subject(input.target, input.targetId);
  if (!found) throw notFound("ما عاد موجوداً");
  if (found.ownerId === reporterId) throw badRequest("هذا منك أنت");

  /*
    بلاغٌ واحد لكل شيء من كل شخص.

    تكرارُه لا يُسرّع المراجعة ويُغرق اللوحة، والقيد في القاعدة لا في
    الشاشة — فالتكرار يُبتلع ويُردّ «وصلنا بلاغك».
  */
  await prisma.report.upsert({
    where: {
      reporterId_target_targetId: {
        reporterId,
        target: input.target,
        targetId: input.targetId,
      },
    },
    update: { reason: input.reason, note: input.note?.trim() || null },
    create: {
      target: input.target,
      targetId: input.targetId,
      reporterId,
      reportedId: found.ownerId,
      reason: input.reason,
      note: input.note?.trim() || null,
      snippet: found.snippet?.slice(0, 500) ?? null,
    },
  });

  return { ok: "وصلنا بلاغك. نقرأه ونتصرّف." };
}

// ───────────────────────────── اللوحة ─────────────────────────────

export async function list(state: "OPEN" | "KEPT" | "REMOVED" = "OPEN") {
  const rows = await prisma.report.findMany({
    where: { state },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      target: true,
      targetId: true,
      reason: true,
      note: true,
      snippet: true,
      state: true,
      createdAt: true,
      reporter: { select: { id: true, name: true, memberNo: true } },
      reported: { select: { id: true, name: true, memberNo: true } },
    },
  });
  return { reports: rows };
}

/**
 * قرار المشرف: يُبقي أو يحذف.
 *
 * والحذف يحذف المحتوى نفسه لا البلاغ: البلاغ سجلٌّ يبقى ليُعرف من
 * يتكرّر عليه، والمحتوى يذهب بتفاعلاته وتعليقاته كما يذهب حين يحذفه
 * صاحبه.
 */
export async function decide(
  adminId: string,
  reportId: string,
  verdict: "KEPT" | "REMOVED",
) {
  const report = await prisma.report.findUnique({ where: { id: reportId } });
  if (!report) throw notFound("البلاغ غير موجود");

  if (verdict === "REMOVED") {
    if (report.target === "MOMENT") {
      await prisma.moment.deleteMany({ where: { id: report.targetId } });
    } else if (report.target === "STORY") {
      await prisma.story.deleteMany({ where: { id: report.targetId } });
    } else if (report.target === "MESSAGE") {
      await prisma.message.deleteMany({ where: { id: report.targetId } });
    }
  }

  await prisma.report.update({
    where: { id: reportId },
    data: { state: verdict, handledAt: new Date(), handledBy: adminId },
  });

  return { ok: verdict === "REMOVED" ? "حُذف المحتوى" : "أُبقي المحتوى" };
}

export async function words() {
  const rows = await prisma.bannedWord.findMany({ orderBy: { createdAt: "desc" } });
  return { words: rows };
}

export async function addWord(word: string, hard: boolean, note?: string) {
  const clean = word.trim();
  if (clean.length < 2) throw badRequest("اكتب الكلمة");

  const row = await prisma.bannedWord.upsert({
    where: { word: clean },
    update: { hard, note: note?.trim() || null },
    create: { word: clean, hard, note: note?.trim() || null },
  });
  forgetWords();
  return { word: row };
}

export async function dropWord(id: string) {
  await prisma.bannedWord.deleteMany({ where: { id } });
  forgetWords();
  return { ok: true };
}

// ─────────────────────── الإشراف على المحتوى ───────────────────────

/**
 * حذفُ لحظةٍ بيد مشرف — لا بيد صاحبها.
 *
 * البلاغ يصل على منشور، فلا بدّ من بابٍ يفتحه المشرف ليتأكّد ثم يحذف.
 * والحذف يذهب بتفاعلاته وتعليقاته بـ`Cascade` كما يذهب حين يحذفه صاحبه
 * (القاعدة ٦١)، وبصورته معه (القاعدة ٨٤) — علاقةُ الصورة `SetNull`،
 * فحذفُ اللحظة وحدها يترك بكسلاتها في السحابة بلا شيءٍ يدلّ عليها
 * (القاعدة ١٠٤).
 *
 * وكلُّ حذفٍ يُختم في `ModerationLog`: سلطةٌ بلا أثرٍ مكتوب لا يُسأل
 * عنها أحد، ومن مُنح الصلاحية يُعرف ما فعل بها.
 */
export async function removeMoment(adminId: string, momentId: string) {
  const moment = await prisma.moment.findUnique({
    where: { id: momentId },
    select: { id: true, authorId: true, text: true, mediaId: true },
  });
  if (!moment) throw notFound("اللحظة غير موجودة");

  await prisma.moderationLog.create({
    data: {
      adminId,
      action: "MOMENT_REMOVED",
      targetId: moment.id,
      ownerId: moment.authorId,
      snippet: moment.text?.slice(0, 200) ?? null,
    },
  });

  await prisma.moment.delete({ where: { id: moment.id } });
  if (moment.mediaId) await dropMedia([moment.mediaId]);

  return { ok: "حُذفت اللحظة" };
}

/**
 * حذفُ تعليقٍ مسيء بيد المشرف — بابُ `removeMoment` نفسُه للتعليق.
 *
 * صاحبُ التعليق يحذفه من `/v1/comments/:id` ولا يُوسَّع ذلك الباب ليقبل
 * غيره (القاعدة ١١٤): بابٌ للصاحب وبابٌ للمشرف، وهذا خلف
 * `requireModerator` ومعه سجلّ.
 */
export async function removeComment(adminId: string, commentId: string) {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { id: true, userId: true, body: true },
  });
  if (!comment) throw notFound("التعليق غير موجود");

  await prisma.moderationLog.create({
    data: {
      adminId,
      action: "COMMENT_REMOVED",
      targetId: comment.id,
      ownerId: comment.userId,
      snippet: comment.body.slice(0, 200),
    },
  });

  await prisma.comment.delete({ where: { id: comment.id } });
  return { ok: "حُذف التعليق" };
}

/** سجلّ ما فعله المشرفون — يقرؤه المالك في اللوحة. */
export async function logs(limit = 100) {
  const rows = await prisma.moderationLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      action: true,
      targetId: true,
      snippet: true,
      createdAt: true,
      admin: { select: { id: true, name: true, memberNo: true } },
      owner: { select: { id: true, name: true, memberNo: true } },
    },
  });
  return { logs: rows };
}
