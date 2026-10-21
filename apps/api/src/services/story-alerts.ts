import { prisma } from "@athar/db";
import { forbidden } from "../lib/errors";
import { blockedWith, circleIds } from "./visibility";
import { storyVisibleTo } from "./stories";
import { noteVisibleTo } from "./notes";
import { push } from "./push";

/**
 * «نبّهني إذا نزّل قصة أو نوت» (القاعدة ٣١٩) — **بقرار المالك**: يضعه صاحبُه على صديقٍ
 * بعينه من ملفّه، فيصله جرسٌ حين ينشر ذلك الصديقُ قصّةً أو نوتاً. صفٌّ لكلّ اختيارٍ لا
 * مفتاحٌ عامّ: من لا يريد أن يُوقَظ لكلّ قصّةٍ في دائرته يختار من يهمّه.
 */
export async function alertOf(userId: string, friendId: string) {
  const row = await prisma.storyAlert.findUnique({
    where: { userId_friendId: { userId, friendId } },
    select: { userId: true },
  });
  return { on: Boolean(row) };
}

export async function setAlert(userId: string, friendId: string, on: boolean) {
  if (!on) {
    await prisma.storyAlert.deleteMany({ where: { userId, friendId } });
    return { on: false };
  }
  // للأصدقاء وحدهم: تنبيهٌ بقصص من لا تراه بابُ استكشافٍ (القاعدة ٢).
  if (!(await circleIds(userId)).includes(friendId)) throw forbidden("للأصدقاء وحدهم");
  await prisma.storyAlert.upsert({
    where: { userId_friendId: { userId, friendId } },
    create: { userId, friendId },
    update: {},
  });
  return { on: true };
}

/**
 * الجرسُ بعد النشر — لمن فعّله **ويرى ما نُشر**: قصّةٌ خاصّةٌ أو نوتٌ لتصنيفٍ لا يُنبَّه
 * بها من لم تُوجَّه إليه، ومن خرج من الدائرة أو حُجب لا يُنبَّه. لا يُنتظر ولا يُفشل النشر.
 */
export async function announce(authorId: string, what: "story" | "note", id: string): Promise<void> {
  try {
    const watchers = await prisma.storyAlert.findMany({ where: { friendId: authorId }, select: { userId: true } });
    if (watchers.length === 0) return;
    const author = await prisma.user.findUnique({ where: { id: authorId }, select: { name: true } });
    if (!author) return;

    for (const { userId } of watchers) {
      const [circle, blocked, visible] = await Promise.all([
        circleIds(userId),
        blockedWith(userId),
        what === "story"
          ? prisma.story.count({ where: { id, ...storyVisibleTo(userId) } })
          : prisma.statusNote.count({ where: { id, ...noteVisibleTo(userId) } }),
      ]);
      if (!circle.includes(authorId) || blocked.includes(authorId) || visible === 0) continue;
      void push({
        userId,
        kind: "STORY",
        title: what === "story" ? `${author.name} نزّل قصة` : `${author.name} نزّل نوت`,
        body: what === "story" ? "شاهدها قبل ما تختفي" : "شوف وش كتب",
        path: what === "story" ? `/stories/${authorId}` : `/notes/${id}`,
      });
    }
  } catch (error) {
    console.error("[story-alerts]", error);
  }
}
