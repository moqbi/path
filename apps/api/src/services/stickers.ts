import { prisma } from "@athar/db";
import { badRequest, forbidden, notFound } from "../lib/errors";
import { circleIds } from "./visibility";

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
      // لـ«وصل حديثاً» في المتجر: مجموعةٌ جديدة خبرٌ كالصنف الجديد.
      createdAt: true,
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
    // ومجموعةٌ بلا ملصقٍ لا تُشترى: لا تُعرض، فمن يشتريها يدفع بطلبٍ يكتبه بيده لا شيء.
    where: { id: packId, hidden: false, priceCoins: { gt: 0 }, stickers: { some: {} } },
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

/** ما يملكه الصديقُ من المجموعات المدفوعة — لنافذة الإهداء («عنده»)، وللأصدقاء وحدهم. */
export async function friendPacks(userId: string, toUserId: string) {
  const circle = await circleIds(userId);
  if (!circle.includes(toUserId)) throw forbidden("الإهداء للأصدقاء فقط");
  const rows = await prisma.stickerPurchase.findMany({ where: { userId: toUserId }, select: { packId: true } });
  return { owned: rows.map((row) => row.packId) };
}

/**
 * إهداءُ مجموعةٍ مدفوعة (القاعدة ٢٩٨) — **بقرار المالك**: كإهداء الصنف (القاعدة ٣٩)
 * للأصدقاء وحدهم، والخصمُ من المُهدي بسعرها هو بلا خصم آثار+ (القاعدة ٢٩٤)، والملكيّةُ
 * للمُهدى إليه تبقى ولا تنتهي. وما مع آثار+ لا يُهدى: يُفتح بالاشتراك لا بالشراء. والخصمُ
 * بشرط «الرصيدُ يكفي» والملكيّةُ في معاملةٍ واحدة، والقيدُ الفريد يردّ هديّتين معاً.
 */
export async function giftPack(userId: string, packId: string, toUserId: string) {
  if (toUserId === userId) throw badRequest("الإهداء لصاحبك لا لنفسك");
  const circle = await circleIds(userId);
  if (!circle.includes(toUserId)) throw forbidden("الإهداء للأصدقاء فقط");

  const [pack, friend] = await Promise.all([
    prisma.stickerPack.findFirst({
      where: { id: packId, hidden: false, stickers: { some: {} } },
      select: { id: true, name: true, priceCoins: true },
    }),
    prisma.user.findUnique({ where: { id: toUserId }, select: { name: true } }),
  ]);
  if (!pack || !friend) throw notFound("المجموعة غير موجودة");
  if (pack.priceCoins <= 0) throw badRequest("هذه المجموعة مع آثار+ — لا تُهدى");
  const owned = await prisma.stickerPurchase.findUnique({
    where: { userId_packId: { userId: toUserId, packId } },
    select: { id: true },
  });
  if (owned) throw badRequest(`${friend.name} يملكها أصلاً`);

  try {
    await prisma.$transaction(async (tx) => {
      const paid = await tx.user.updateMany({
        where: { id: userId, coins: { gte: pack.priceCoins } },
        data: { coins: { decrement: pack.priceCoins } },
      });
      if (paid.count === 0) throw badRequest("رصيدك لا يكفي");
      await tx.stickerPurchase.create({
        data: { userId: toUserId, packId, paidCoins: pack.priceCoins, giftedById: userId },
      });
    });
  } catch (problem) {
    if ((problem as { code?: string }).code === "P2002") throw badRequest(`${friend.name} يملكها أصلاً`);
    throw problem;
  }

  // سطرٌ عند الطرفين كهدايا المتجر (القاعدة ٩١)، والطرفُ الآخر إشارة.
  const label = `ملصقات ${pack.name}`;
  const [sent, got] = await prisma.$transaction([
    prisma.moment.create({ data: { authorId: userId, kind: "GIFT_SENT", text: label } }),
    prisma.moment.create({ data: { authorId: toUserId, kind: "GIFT_GOT", text: label } }),
  ]);
  await prisma.momentTag.createMany({
    data: [
      { momentId: sent.id, userId: toUserId },
      { momentId: got.id, userId },
    ],
    skipDuplicates: true,
  });

  return { ok: `أُهديت ${label} إلى ${friend.name}` };
}

/** نصٌّ أو ملصق — أحدُهما لا شيء. */
export function needsContent(body: string, stickerId?: string | null) {
  if (!body && !stickerId) throw badRequest("اكتب شيئاً");
}
