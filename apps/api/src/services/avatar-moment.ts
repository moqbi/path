import { prisma } from "@athar/db";
import { copyMedia, dropMedia } from "./media";

/** تبديلاتٌ متتالية في ساعةٍ لحظةٌ واحدة: الأخيرةُ تحلّ محلّ ما قبلها. */
const MERGE_MINUTES = 60;

/**
 * «غيّر صورته» — لحظةٌ تُكتب حين يبدّل صاحبُها صورةَ عرضه (القاعدة ٢١٤).
 *
 * والصورةُ في اللحظة **نسخةٌ** لا إشارةٌ إلى صورة العرض: حذفُ اللحظة يحذف
 * صورتها (القاعدة ٨٤)، وتبديلُ الصورة يحذف القديمة (`setPicture`) — فإشارةٌ
 * واحدة كانت ستُذهب بأحدهما مع الآخر. والنسخةُ تقول أيضاً أيَّ صورةٍ لبس
 * يومها، لا ما يلبسه الآن.
 *
 * ومن جرّب خمس صورٍ في دقائق لا يملأ خطَّ دائرته بخمس لحظات: ما سبقها في
 * الساعة نفسها يُحذف ببكسلاته. ولا يرمي: لحظةٌ لم تُكتب لا تُفشل تبديلَ صورة.
 */
export async function announceAvatar(userId: string, mediaId: string): Promise<void> {
  try {
    const recent = await prisma.moment.findMany({
      where: {
        authorId: userId,
        kind: "AVATAR_CHANGED",
        createdAt: { gt: new Date(Date.now() - MERGE_MINUTES * 60_000) },
      },
      select: { id: true, mediaId: true },
    });
    if (recent.length > 0) {
      await prisma.moment.deleteMany({ where: { id: { in: recent.map((row) => row.id) } } });
      await dropMedia(recent.flatMap((row) => (row.mediaId ? [row.mediaId] : [])));
    }

    const copy = await copyMedia(mediaId, userId).catch(() => null);
    await prisma.moment.create({
      data: { authorId: userId, kind: "AVATAR_CHANGED", mediaId: copy?.id ?? null },
    });
  } catch (problem) {
    console.error("[avatar-moment]", problem instanceof Error ? problem.message : problem);
  }
}
