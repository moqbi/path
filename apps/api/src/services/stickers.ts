import { prisma } from "@athar/db";
import { badRequest, forbidden, notFound } from "../lib/errors";

/** ما يُقال مكان الملصق حيث لا يُرسم: نسخةٌ قديمة، وتنبيهٌ على القفل، ومقتطفُ المحادثة. */
export const STICKER_TEXT = "ملصق";

/**
 * مجموعاتُ الملصقات الظاهرة بملصقاتها (القاعدة ٢٩١) — للجميع، فغيرُ المشترك يرى
 * القائمةَ خلف قفلها، والإرسالُ وحده يُفحص.
 */
export async function packs() {
  const rows = await prisma.stickerPack.findMany({
    where: { hidden: false, stickers: { some: {} } },
    select: {
      id: true,
      name: true,
      stickers: { select: { id: true, mediaId: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return { packs: rows };
}

/**
 * الملصقُ لمشتركي آثار+ وحدهم، ومن مجموعةٍ ظاهرة — والفحصُ هنا لا في القفل على
 * الشاشة: الطلبُ يُرسَل بيدٍ كما يُرسَل من التطبيق.
 */
export async function assertSticker(userId: string, stickerId: string) {
  const [me, sticker] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { isPlus: true } }),
    prisma.sticker.findFirst({ where: { id: stickerId, pack: { hidden: false } }, select: { id: true } }),
  ]);
  if (!me?.isPlus) throw forbidden("الملصقات لمشتركي آثار+");
  if (!sticker) throw notFound("الملصق غير موجود");
  return sticker.id;
}

/** نصٌّ أو ملصق — أحدُهما لا شيء. */
export function needsContent(body: string, stickerId?: string | null) {
  if (!body && !stickerId) throw badRequest("اكتب شيئاً");
}
