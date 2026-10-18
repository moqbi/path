import { prisma } from "@athar/db";
import { badRequest, forbidden, notFound } from "../lib/errors";

/** ما يُقال مكان الملصق حيث لا يُرسم: نسخةٌ قديمة، وتنبيهٌ على القفل، ومقتطفُ المحادثة. */
export const STICKER_TEXT = "ملصق";

/**
 * مجموعاتُ الملصقات بملصقاتها (القاعدة ٢٩١) — للجميع، فمن لا يملكها يرى القائمةَ
 * خلف قفلها. وكلُّ مجموعةٍ بسعرها وملكيّتها (القاعدة ٢٩٤): صفرٌ مع آثار+، وما فوقه
 * يُشترى بالنقاط. والمدفوعةُ المملوكة تُعرض لصاحبها وإن أُخفيت — ما دُفع ثمنه يبقى
 * (كالقاعدة ٤٤).
 */
export async function packs(userId: string) {
  const rows = await prisma.stickerPack.findMany({
    where: {
      stickers: { some: {} },
      OR: [{ hidden: false }, { purchases: { some: { userId } } }],
    },
    select: {
      id: true,
      name: true,
      priceCoins: true,
      purchases: { where: { userId }, select: { id: true } },
      stickers: { select: { id: true, mediaId: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return {
    packs: rows.map(({ purchases, ...pack }) => ({ ...pack, owned: purchases.length > 0 })),
  };
}

/**
 * الملصقُ لمن يحقّ له (القاعدة ٢٩٤): مجموعةٌ مع آثار+ لمشتركٍ ومن مجموعةٍ ظاهرة،
 * ومجموعةٌ مدفوعة لمن اشتراها — ولو انتهى اشتراكُه أو أُخفيت بعد شرائه. والفحصُ هنا
 * لا في القفل على الشاشة: الطلبُ يُرسَل بيدٍ كما يُرسَل من التطبيق.
 */
export async function assertSticker(userId: string, stickerId: string) {
  const [me, sticker] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { isPlus: true } }),
    prisma.sticker.findUnique({
      where: { id: stickerId },
      select: {
        id: true,
        pack: { select: { hidden: true, priceCoins: true, purchases: { where: { userId }, select: { id: true } } } },
      },
    }),
  ]);
  if (!sticker) throw notFound("الملصق غير موجود");
  const { pack } = sticker;
  // ما اشتُري يبقى لصاحبه مهما تغيّر بعده: سعرُ المجموعة أو إخفاؤها أو اشتراكُه.
  if (pack.purchases.length > 0) return sticker.id;
  if (pack.priceCoins > 0) throw forbidden("اشترِ المجموعة أولاً");
  if (pack.hidden) throw notFound("الملصق غير موجود");
  if (!me?.isPlus) throw forbidden("الملصقات لمشتركي آثار+");
  return sticker.id;
}

/**
 * شراءُ مجموعةٍ مدفوعة بالنقاط (القاعدة ٢٩٤): تُملَك ولا تنتهي. والخصمُ والملكيّةُ في
 * معاملةٍ واحدة، والخصمُ بشرط «الرصيدُ يكفي» في القاعدة نفسها — طلبان معاً لا يدفعان
 * مرّتين ولا يُنزلان الرصيدَ تحت الصفر. والمخفيّةُ لا تُشترى («غير موجودة» — القاعدة ٤٤).
 */
export async function buyPack(userId: string, packId: string) {
  const pack = await prisma.stickerPack.findFirst({
    where: { id: packId, hidden: false, priceCoins: { gt: 0 } },
    select: { id: true, name: true, priceCoins: true },
  });
  if (!pack) throw notFound("المجموعة غير موجودة");
  const owned = await prisma.stickerPurchase.findUnique({
    where: { userId_packId: { userId, packId } },
    select: { id: true },
  });
  if (owned) return { ok: `عندك ${pack.name}` };

  try {
    await prisma.$transaction(async (tx) => {
      const paid = await tx.user.updateMany({
        where: { id: userId, coins: { gte: pack.priceCoins } },
        data: { coins: { decrement: pack.priceCoins } },
      });
      if (paid.count === 0) throw badRequest("رصيدك لا يكفي");
      await tx.stickerPurchase.create({ data: { userId, packId, paidCoins: pack.priceCoins } });
    });
  } catch (problem) {
    // طلبٌ ثانٍ سبق إلى الصفّ: القيدُ الفريد ألغى المعاملة كلَّها فلم يُخصم شيء.
    if ((problem as { code?: string }).code === "P2002") return { ok: `عندك ${pack.name}` };
    throw problem;
  }
  return { ok: `اشتريت ${pack.name}` };
}

/** نصٌّ أو ملصق — أحدُهما لا شيء. */
export function needsContent(body: string, stickerId?: string | null) {
  if (!body && !stickerId) throw badRequest("اكتب شيئاً");
}
