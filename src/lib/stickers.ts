import { prisma } from "@/lib/db";

/**
 * الملصقات (القاعدة ٢٩١) — نسخةُ `services/stickers.ts` في الخادم حرفاً بحرف:
 * مشروعُ الجذر يقرأ القاعدة بنفسه.
 */

/** ما يُقال مكان الملصق حيث لا يُرسم: نسخةٌ قديمة ومقتطفُ المحادثة. */
export const STICKER_TEXT = "ملصق";

export type StickerPack = { id: string; name: string; stickers: { id: string; mediaId: string }[] };

/** المجموعاتُ الظاهرة بملصقاتها — للجميع، فغيرُ المشترك يرى القائمةَ خلف قفلها. */
export async function stickerPacks(): Promise<StickerPack[]> {
  return prisma.stickerPack.findMany({
    where: { hidden: false, stickers: { some: {} } },
    select: {
      id: true,
      name: true,
      stickers: { select: { id: true, mediaId: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

/**
 * الملصقُ لمشتركي آثار+ وحدهم، ومن مجموعةٍ ظاهرة — الفحصُ هنا لا في القفل على
 * الشاشة: إجراءُ الخادم يُستدعى بـPOST مباشرةً.
 */
export async function assertSticker(userId: string, stickerId: string): Promise<string> {
  const [me, sticker] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { isPlus: true, plusUntil: true } }),
    prisma.sticker.findFirst({ where: { id: stickerId, pack: { hidden: false } }, select: { id: true } }),
  ]);
  // الاشتراكُ كما يقرؤه `currentUser()`: ما مضى `plusUntil` منتهٍ ولو بقي `isPlus` حتى الكنس
  // (القاعدة ١٤٩) — فتُقفل الملصقاتُ مع الإيموجي الحرّ وبقيّة المزايا في اللحظة نفسها.
  const active = me?.isPlus && (!me.plusUntil || me.plusUntil > new Date());
  if (!active) throw new Error("الملصقات لمشتركي آثار+");
  if (!sticker) throw new Error("الملصق غير موجود");
  return sticker.id;
}

/** الواجهةُ في الويب للمالك وممنوحي اللوحة كلّها — مقابلُ نسخة التطوير في الجوّال. */
export function canTryStickers(user: { role: string; adminScope: string }): boolean {
  return user.role === "ADMIN" || user.adminScope === "ALL";
}
