import { env } from "../env";
import { prisma } from "@athar/db";
import { badRequest, forbidden, notFound } from "../lib/errors";
import { circleIds } from "./visibility";

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

// ───────────────────────────── الشراء واللبس ─────────────────────────────

/** خصمُ المشترك على كل صنف. */
const PLUS_DISCOUNT = 0.2;

const priceFor = (item: { priceHalalas: number }, isPlus: boolean) =>
  isPlus ? Math.round(item.priceHalalas * (1 - PLUS_DISCOUNT)) : item.priceHalalas;

/**
 * الشراء.
 *
 * الخصم والتمليك في معاملةٍ واحدة حتى لا ينقص الرصيد بلا صنفٍ ولا يُملَك
 * صنفٌ بلا خصم. وما يُكتسب بالوقت لا يُشترى: يُنال بالبقاء لا بالمال.
 */
export async function buy(userId: string, itemId: string) {
  const [me, item] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { isPlus: true, storeCredit: true, createdAt: true },
    }),
    prisma.storeItem.findUnique({ where: { id: itemId } }),
  ]);
  if (!me) throw notFound("لا يوجد هذا الحساب");
  if (!item) throw notFound("الصنف غير موجود");
  if (item.plusOnly && !me.isPlus) throw forbidden("هذا الصنف لمشتركي أثر+");

  if (item.earnedAfterDays !== null) {
    const days = Math.floor((Date.now() - me.createdAt.getTime()) / 86_400_000);
    if (days < item.earnedAfterDays) throw badRequest("هذا الصنف يُكتسب بالوقت، لا يُشترى");
  }

  const owned = await prisma.purchase.findUnique({
    where: { userId_itemId: { userId, itemId } },
    select: { id: true },
  });
  if (owned) return { ok: "عندك هذا الصنف" };

  const price = priceFor(item, me.isPlus);
  if (me.storeCredit < price) throw badRequest("رصيدك لا يكفي");

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { storeCredit: { decrement: price } } }),
    prisma.purchase.create({ data: { userId, itemId, paidHalalas: price } }),
  ]);

  return { ok: `اشتريت ${item.name}` };
}

/**
 * الإهداء: تشتري الصنف بمالك فيملكه صاحبك.
 *
 * الشرط أن يكون في دائرتك — لا هدايا من غريب، فالهدية بابُ إزعاجٍ إن
 * فُتح للجميع. والخصم خصمُ المُهدي: هو الدافع فله سعره هو.
 *
 * وتُكتب سطراً في مخطط كلٍّ منهما كما تُكتب الصداقة: «أهديت فلاناً كذا»
 * و«وصلتك هدية من فلان». والطرف الآخر إشارةٌ لا اسمٌ محفوظ، فيبقى حيّاً
 * لو تغيّر اسمه.
 */
export async function gift(userId: string, itemId: string, toUserId: string) {
  if (toUserId === userId) throw badRequest("الإهداء لصاحبك لا لنفسك");

  const circle = await circleIds(userId);
  if (!circle.includes(toUserId)) throw forbidden("الإهداء للأصدقاء فقط");

  const [me, item, friend] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { isPlus: true, storeCredit: true } }),
    prisma.storeItem.findUnique({ where: { id: itemId } }),
    prisma.user.findUnique({ where: { id: toUserId }, select: { name: true, isPlus: true } }),
  ]);
  if (!me || !item || !friend) throw notFound("الصنف غير موجود");
  if (item.earnedAfterDays !== null) throw badRequest("هذا الصنف يُكتسب بالوقت، لا يُهدى");
  if (item.plusOnly && !friend.isPlus) throw badRequest(`${friend.name} ليس مشتركاً في أثر+`);

  const owned = await prisma.purchase.findUnique({
    where: { userId_itemId: { userId: toUserId, itemId } },
    select: { id: true },
  });
  if (owned) throw badRequest(`${friend.name} يملكه أصلاً`);

  const price = priceFor(item, me.isPlus);
  if (me.storeCredit < price) throw badRequest("رصيدك لا يكفي");

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { storeCredit: { decrement: price } } }),
    prisma.purchase.create({
      data: { userId: toUserId, itemId, paidHalalas: price, giftedById: userId },
    }),
  ]);

  const [sent, got] = await prisma.$transaction([
    prisma.moment.create({ data: { authorId: userId, kind: "GIFT_SENT", text: item.name } }),
    prisma.moment.create({ data: { authorId: toUserId, kind: "GIFT_GOT", text: item.name } }),
  ]);
  await prisma.momentTag.createMany({
    data: [
      { momentId: sent.id, userId: toUserId },
      { momentId: got.id, userId },
    ],
    skipDuplicates: true,
  });

  return { ok: `أُهديت ${item.name} إلى ${friend.name}` };
}

/** اللبس: ما لا تملكه لا تلبسه. */
export async function equip(userId: string, itemId: string) {
  const purchase = await prisma.purchase.findUnique({
    where: { userId_itemId: { userId, itemId } },
    select: { item: { select: { kind: true } } },
  });
  if (!purchase) throw forbidden("لا تملك هذا الصنف");

  const field =
    purchase.item.kind === "FRAME"
      ? { frameId: itemId }
      : purchase.item.kind === "CHARM"
        ? { charmId: itemId }
        : { backgroundId: itemId };

  await prisma.user.update({ where: { id: userId }, data: field });
  return { ok: true };
}

export async function unequip(userId: string, kind: "FRAME" | "BACKGROUND" | "CHARM") {
  await prisma.user.update({
    where: { id: userId },
    data:
      kind === "FRAME"
        ? { frameId: null }
        : kind === "CHARM"
          ? { charmId: null }
          : { backgroundId: null },
  });
  return { ok: true };
}

/**
 * تفعيلٌ بلا دفع — للتجربة وحدها.
 *
 * كان هذا الباب مفتوحاً: طلبٌ واحد يمنح صاحبه «أثر+» ورصيدَ متجرٍ
 * مجّاناً، وإجراءُ الخادم يُنادى مباشرةً فلا يحميه إخفاء الزرّ. الآن
 * يُغلق ما لم تُضبط `ALLOW_FAKE_PLUS`، والدفعُ الحقيقي يأتي من
 * المتجرين عبر حدث RevenueCat وحده (`services/billing.ts`).
 */
export async function subscribe(userId: string, plan: "MONTHLY" | "YEARLY") {
  if (!env.ALLOW_FAKE_PLUS) {
    throw forbidden("الاشتراك يتمّ من داخل التطبيق عبر App Store أو Google Play");
  }

  const days = plan === "YEARLY" ? 365 : 30;
  await prisma.user.update({
    where: { id: userId },
    data: {
      isPlus: true,
      plusUntil: new Date(Date.now() + days * 86_400_000),
      storeCredit: { increment: 3000 },
    },
  });
  return { ok: "اشتركت في أثر+" };
}

export async function cancelPlus(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { isPlus: false, plusUntil: null },
  });
  return { ok: true };
}
