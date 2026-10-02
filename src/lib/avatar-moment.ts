import "server-only";
import { prisma } from "@/lib/db";
import { copyMedia, dropMedia } from "@/lib/media";

/** تبديلاتٌ متتالية في ساعةٍ لحظةٌ واحدة: الأخيرةُ تحلّ محلّ ما قبلها. */
const MERGE_MINUTES = 60;

/**
 * «غيّر صورته» — نسخةُ الويب من `apps/api/src/services/avatar-moment.ts`
 * (القاعدة ٢١٤). الصورةُ نسخةٌ لا إشارة: `Moment.mediaId` فريد، وحذفُ اللحظة
 * يحذف صورتها. ولا يرمي: لحظةٌ لم تُكتب لا تُفشل تبديلَ صورة.
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
