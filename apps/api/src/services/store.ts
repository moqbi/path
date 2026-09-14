import { prisma } from "@athar/db";

/**
 * المتجر كما يُعرض: تصنيفاتٌ ثم صفوف.
 *
 * «المميز» ليس تصنيفاً بل واجهة تُشتقّ من الأصناف نفسها — فما يُضاف من
 * اللوحة يظهر بلا نشر نسخة.
 */
const ITEM = {
  id: true,
  kind: true,
  name: true,
  priceHalalas: true,
  spec: true,
  mediaId: true,
  plusOnly: true,
  earnedAfterDays: true,
  limited: true,
  categoryId: true,
  palette: true,
  createdAt: true,
} as const;

const FRESH = 3;

export async function storefront(userId: string) {
  const [categories, items, purchases, user] = await Promise.all([
    prisma.storeCategory.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.storeItem.findMany({ orderBy: { sortOrder: "asc" }, select: ITEM }),
    prisma.purchase.findMany({ where: { userId }, select: { itemId: true } }),
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        storeCredit: true,
        isPlus: true,
        createdAt: true,
        frameId: true,
        backgroundId: true,
        charmId: true,
      },
    }),
  ]);

  const owned = purchases.map((row) => row.itemId);
  const fresh = [...items].sort((a, b) => +b.createdAt - +a.createdAt).slice(0, FRESH);
  const themes = items.filter(
    (item) => (item.kind === "THEME" || item.kind === "BACKGROUND") && !item.limited,
  );
  const limited = items.filter((item) => item.limited);

  return {
    categories,
    items,
    owned,
    rows: { fresh, themes, limited },
    credit: user?.storeCredit ?? 0,
    isPlus: user?.isPlus ?? false,
    daysHere: user ? Math.floor((Date.now() - +user.createdAt) / 86_400_000) : 0,
    equipped: { frame: user?.frameId, theme: user?.backgroundId, charm: user?.charmId },
  };
}

/** ما يملكه صاحب الحساب — منه تُلبَس الإكسسوارات. */
export async function myItems(userId: string) {
  const rows = await prisma.purchase.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      createdAt: true,
      item: { select: ITEM },
      giftedBy: { select: { id: true, name: true } },
    },
  });
  return rows;
}
