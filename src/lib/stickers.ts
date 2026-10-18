import { prisma } from "@/lib/db";

/**
 * الملصقات (القاعدة ٢٩١) — نسخةُ `services/stickers.ts` في الخادم حرفاً بحرف:
 * مشروعُ الجذر يقرأ القاعدة بنفسه.
 */

/** ما يُقال مكان الملصق حيث لا يُرسم: نسخةٌ قديمة ومقتطفُ المحادثة. */
export const STICKER_TEXT = "ملصق";

export type StickerPack = {
  id: string;
  name: string;
  /** صفرٌ = مع آثار+، وما فوقه يُشترى ويُملَك (القاعدة ٢٩٤). */
  priceCoins: number;
  owned: boolean;
  stickers: { id: string; mediaId: string }[];
};

/**
 * المجموعاتُ بملصقاتها وسعرها وملكيّتها — للجميع، فمن لا يملكها يرى القائمةَ خلف قفلها.
 * والمدفوعةُ المملوكة تُعرض لصاحبها وإن أُخفيت (القاعدة ٢٩٤).
 */
export async function stickerPacks(userId: string): Promise<StickerPack[]> {
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
  return rows.map(({ purchases, ...pack }) => ({ ...pack, owned: purchases.length > 0 }));
}

/**
 * الملصقُ لمن يحقّ له (القاعدة ٢٩٤): مجموعةٌ مع آثار+ لمشتركٍ ومن مجموعةٍ ظاهرة،
 * ومجموعةٌ مدفوعة لمن اشتراها ولو انتهى اشتراكُه أو أُخفيت بعد شرائه. الفحصُ هنا لا
 * في القفل على الشاشة: إجراءُ الخادم يُستدعى بـPOST مباشرةً.
 */
export async function assertSticker(userId: string, stickerId: string): Promise<string> {
  const [me, sticker] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { isPlus: true, plusUntil: true } }),
    prisma.sticker.findUnique({
      where: { id: stickerId },
      select: {
        id: true,
        pack: { select: { hidden: true, priceCoins: true, purchases: { where: { userId }, select: { id: true } } } },
      },
    }),
  ]);
  if (!sticker) throw new Error("الملصق غير موجود");
  const { pack } = sticker;
  // ما اشتُري يبقى لصاحبه مهما تغيّر بعده: سعرُ المجموعة أو إخفاؤها أو اشتراكُه.
  if (pack.purchases.length > 0) return sticker.id;
  if (pack.priceCoins > 0) throw new Error("اشترِ المجموعة أولاً");
  if (pack.hidden) throw new Error("الملصق غير موجود");
  // الاشتراكُ كما يقرؤه `currentUser()`: ما مضى `plusUntil` منتهٍ ولو بقي `isPlus` حتى الكنس
  // (القاعدة ١٤٩) — فتُقفل مع الإيموجي الحرّ وبقيّة المزايا في اللحظة نفسها.
  const active = me?.isPlus && (!me.plusUntil || me.plusUntil > new Date());
  if (!active) throw new Error("الملصقات لمشتركي آثار+");
  return sticker.id;
}

/**
 * شراءُ مجموعةٍ مدفوعة — نسخةُ `buyPack` في الخادم: الخصمُ بشرط «الرصيدُ يكفي» والملكيّةُ
 * في معاملةٍ واحدة، والقيدُ الفريد يمنع الدفعَ مرّتين. والمخفيّةُ لا تُشترى.
 */
export async function buyStickerPack(userId: string, packId: string): Promise<{ ok?: string; error?: string }> {
  const pack = await prisma.stickerPack.findFirst({
    // ومجموعةٌ بلا ملصقٍ لا تُشترى: لا تُعرض، فمن يشتريها يدفع بطلبٍ يكتبه بيده لا شيء.
    where: { id: packId, hidden: false, priceCoins: { gt: 0 }, stickers: { some: {} } },
    select: { id: true, name: true, priceCoins: true },
  });
  if (!pack) return { error: "المجموعة غير موجودة" };
  const owned = await prisma.stickerPurchase.findUnique({ where: { userId_packId: { userId, packId } }, select: { id: true } });
  if (owned) return { ok: `عندك ${pack.name}` };
  try {
    await prisma.$transaction(async (tx) => {
      const paid = await tx.user.updateMany({
        where: { id: userId, coins: { gte: pack.priceCoins } },
        data: { coins: { decrement: pack.priceCoins } },
      });
      if (paid.count === 0) throw new Error("رصيدك لا يكفي");
      await tx.stickerPurchase.create({ data: { userId, packId, paidCoins: pack.priceCoins } });
    });
  } catch (problem) {
    if ((problem as { code?: string }).code === "P2002") return { ok: `عندك ${pack.name}` };
    if (problem instanceof Error && problem.message === "رصيدك لا يكفي") return { error: problem.message };
    throw problem;
  }
  return { ok: `اشتريت ${pack.name}` };
}

/** الواجهةُ في الويب للمالك وممنوحي اللوحة كلّها — مقابلُ نسخة التطوير في الجوّال. */
export function canTryStickers(user: { role: string; adminScope: string }): boolean {
  return user.role === "ADMIN" || user.adminScope === "ALL";
}
