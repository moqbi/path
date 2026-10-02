import { prisma } from "@athar/db";

/** تبديلاتٌ متتالية في ساعةٍ لحظةٌ واحدة: الأخيرةُ تحلّ محلّ ما قبلها. */
const MERGE_MINUTES = 60;

/**
 * «غيّر صورته» — سطرُ حدثٍ يُكتب حين يبدّل صاحبُه صورةَ عرضه (القاعدة ٢١٤).
 *
 * **حدثٌ بلا صورة** — **بقرار المالك**، كـ«أصبح صديق فلان» و«وصلتك هدية»: الخبرُ
 * أنّه غيّرها، والصورةُ الجديدة ظاهرةٌ أصلاً بجانب السطر وفي كل مكان.
 *
 * ومن جرّب خمس صورٍ في دقائق لا يملأ خطَّ دائرته بخمسة أسطر: ما سبقها في
 * الساعة نفسها يُحذف. ولا يرمي: لحظةٌ لم تُكتب لا تُفشل تبديلَ صورة.
 */
export async function announceAvatar(userId: string): Promise<void> {
  try {
    await prisma.moment.deleteMany({
      where: {
        authorId: userId,
        kind: "AVATAR_CHANGED",
        createdAt: { gt: new Date(Date.now() - MERGE_MINUTES * 60_000) },
      },
    });
    await prisma.moment.create({ data: { authorId: userId, kind: "AVATAR_CHANGED" } });
  } catch (problem) {
    console.error("[avatar-moment]", problem instanceof Error ? problem.message : problem);
  }
}
