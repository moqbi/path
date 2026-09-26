import { env } from "../env";
import { prisma } from "@athar/db";
import { endPlus } from "./plus";
import { PLUS_COINS } from "@athar/shared";
import { badRequest, forbidden, notFound } from "../lib/errors";
import { circleIds } from "./visibility";
import { wearItemCover } from "./media";

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
  priceCoins: true,
  spec: true,
  mediaId: true,
  /** فراغُ الإطار الأوسط: الوجه يجلس فيه لا في مربّع الرسم. */
  frameHole: true,
  plusOnly: true,
  earnedAfterDays: true,
  limited: true,
  categoryId: true,
  collectionId: true,
  palette: true,
  createdAt: true,
  // مُدَدُ الشراء — بلا مُددٍ يُشترى مرّةً ويبقى.
  plans: { select: { id: true, days: true, priceCoins: true }, orderBy: { days: "asc" } },
  /*
    ما تحمله الحزمة: بطاقتُها ترسمه وتعدّه، فما يُشترى يُرى قبل شرائه
    (القاعدة ٦ تمنع الصناديق العشوائية).
  */
  holds: {
    where: { item: { hidden: false } },
    select: {
      item: { select: { id: true, name: true, kind: true, spec: true, mediaId: true } },
    },
  },
} as const;

const FRESH = 3;

/**
 * ما يُعدّ مملوكاً الآن: مِلكٌ دائم، أو مدّةٌ لم تنقضِ.
 *
 * المدّةُ المنقضية تبقى صفّاً (منه يُمدَّد إن اشتُري ثانيةً) ولا تُعدّ
 * مِلكاً في أيّ مكان — المتجرُ والإكسسوارات واللبسُ والإهداء.
 */
export const ACTIVE = () => ({ OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] });

export async function storefront(userId: string) {
  const [categories, collections, items, purchases, user] = await Promise.all([
    prisma.storeCategory.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.storeCollection.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, kind: true },
    }),
    // والمخفيّ لا يُعرض: يُرفع ويُنزل بلا حذفٍ يُضيع ما اشتراه أحد.
    prisma.storeItem.findMany({ where: { hidden: false }, orderBy: { sortOrder: "asc" }, select: ITEM }),
    prisma.purchase.findMany({ where: { userId, ...ACTIVE() }, select: { itemId: true, expiresAt: true } }),
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        coins: true,
        isPlus: true,
        createdAt: true,
        frameId: true,
        backgroundId: true,
        charmId: true,
      },
    }),
  ]);

  const owned = purchases.map((row) => row.itemId);
  // متى ينتهي ما اشتُري بمدّة — لبطاقته: «ينتهي بعد ٣ أيام» و«مدّد».
  const expires = Object.fromEntries(
    purchases.filter((row) => row.expiresAt).map((row) => [row.itemId, row.expiresAt!.toISOString()]),
  );
  const fresh = [...items].sort((a, b) => +b.createdAt - +a.createdAt).slice(0, FRESH);
  const themes = items.filter(
    (item) => (item.kind === "THEME" || item.kind === "BACKGROUND") && !item.limited,
  );
  const limited = items.filter((item) => item.limited);
  // والحزم صفٌّ بنفسها: ما جُمع في باقةٍ واحدة لا يُقرأ بين الأصناف المفردة.
  const bundles = items.filter((item) => item.kind === "BUNDLE" && !item.limited);
  // والتمائمُ والإطاراتُ صفّان في «المميز» — **بقرار المالك**.
  const charms = items.filter((item) => item.kind === "CHARM" && !item.limited);
  const frames = items.filter((item) => item.kind === "FRAME" && !item.limited);

  return {
    categories,
    collections,
    items,
    owned,
    expires,
    rows: { fresh, charms, frames, themes, bundles, limited },
    coins: user?.coins ?? 0,
    isPlus: user?.isPlus ?? false,
    daysHere: user ? Math.floor((Date.now() - +user.createdAt) / 86_400_000) : 0,
    equipped: { frame: user?.frameId, theme: user?.backgroundId, charm: user?.charmId },
  };
}

/** ما يملكه صاحب الحساب — منه تُلبَس الإكسسوارات. */
export async function myItems(userId: string) {
  const rows = await prisma.purchase.findMany({
    where: { userId, ...ACTIVE() },
    orderBy: { createdAt: "desc" },
    select: {
      createdAt: true,
      expiresAt: true,
      item: { select: ITEM },
      giftedBy: { select: { id: true, name: true } },
    },
  });
  return rows;
}

// ───────────────────────────── الشراء واللبس ─────────────────────────────

/** خصمُ المشترك على كل صنف. */
const PLUS_DISCOUNT = 0.2;

const priceFor = (item: { priceCoins: number }, isPlus: boolean) =>
  isPlus ? Math.round(item.priceCoins * (1 - PLUS_DISCOUNT)) : item.priceCoins;

/**
 * الشراء.
 *
 * الخصم والتمليك في معاملةٍ واحدة حتى لا ينقص الرصيد بلا صنفٍ ولا يُملَك
 * صنفٌ بلا خصم. وما يُكتسب بالوقت لا يُشترى: يُنال بالبقاء لا بالمال.
 */
/**
 * ما تحمله الحزمة من أصناف — فارغةٌ لما ليس حزمة.
 *
 * والمخفيُّ منها يُتجاوَز: صنفٌ أُنزل من المتجر لا يُملَّك بشراء حزمةٍ
 * قديمة تحمله.
 */
async function bundleContents(bundleId: string) {
  const rows = await prisma.bundleItem.findMany({
    where: { bundleId, item: { hidden: false } },
    select: { item: { select: { id: true, coverMediaId: true } } },
  });
  return rows.map((row) => row.item);
}

/**
 * المدّةُ والسعر لصنفٍ يُشترى — **بقرار المالك**: الصنفُ المملوك للأبد لا
 * يُشترى ثانيةً، والمتجرُ الذي لا يعود إليه أحد يموت. فللصنف مُدَدٌ بأسعار
 * («يوم بـ٢٥، خمسة أيام بـ٥٠، شهر بـ١٥٠»)، وما انتهت مدّتُه يُنزع ويُشترى
 * ثانيةً. وصنفٌ بلا مُدد يبقى كما كان: يُشترى مرّةً ويبقى.
 */
async function termsFor(
  item: { id: string; priceCoins: number },
  planId: string | undefined,
): Promise<{ days: number | null; list: number }> {
  const plans = await prisma.storeItemPlan.findMany({ where: { itemId: item.id } });
  if (plans.length === 0) return { days: null, list: item.priceCoins };
  const plan = plans.find((one) => one.id === planId);
  if (!plan) throw badRequest("اختر المدّة");
  return { days: plan.days, list: plan.priceCoins };
}

/** نهايةُ المدّة الجديدة: تُمدَّد من حيث تنتهي الحاليّة لا من الآن. */
function extend(current: Date | null | undefined, days: number): Date {
  const from = current && current.getTime() > Date.now() ? current.getTime() : Date.now();
  return new Date(from + days * 86_400_000);
}

export async function buy(userId: string, itemId: string, planId?: string) {
  const [me, item] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { isPlus: true, coins: true, createdAt: true },
    }),
    prisma.storeItem.findUnique({ where: { id: itemId } }),
  ]);
  if (!me) throw notFound("لا يوجد هذا الحساب");
  if (!item) throw notFound("الصنف غير موجود");
  // والمخفيّ لا يُشترى ولو عُرف معرّفه، و«غير موجود» لا «مخفيّ».
  if (item.hidden) throw notFound("الصنف غير موجود");
  if (item.plusOnly && !me.isPlus) throw forbidden("هذا الصنف لمشتركي آثار+");

  if (item.earnedAfterDays !== null) {
    const days = Math.floor((Date.now() - me.createdAt.getTime()) / 86_400_000);
    if (days < item.earnedAfterDays) throw badRequest("هذا الصنف يُكتسب بالوقت، لا يُشترى");
  }

  const terms = await termsFor(item, planId);
  const current = await prisma.purchase.findUnique({
    where: { userId_itemId: { userId, itemId } },
    select: { id: true, expiresAt: true },
  });
  // مِلكٌ دائمٌ لا يُشترى ثانيةً؛ والمدّةُ تُمدَّد.
  if (current && current.expiresAt === null) return { ok: "عندك هذا الصنف" };
  if (current && terms.days === null && current.expiresAt && current.expiresAt > new Date()) {
    return { ok: "عندك هذا الصنف" };
  }

  const price = priceFor({ priceCoins: terms.list }, me.isPlus);
  if (me.coins < price) throw badRequest("رصيدك لا يكفي");
  const expiresAt = terms.days === null ? null : extend(current?.expiresAt, terms.days);

  /*
    الحزمة صنفٌ لا يُلبَس: شراؤها يملّك ما بداخلها دفعةً واحدة، وما
    يملكه المشتري منها أصلاً يُتجاوَز بلا خصمٍ ثانٍ. وسعرُها سعرُها هي
    لا مجموعَ ما فيها — وهذا مكسبُ من يشتريها.
  */
  const inside = await bundleContents(itemId);
  const already = new Set(
    inside.length
      ? (
          await prisma.purchase.findMany({
            where: { userId, itemId: { in: inside.map((one) => one.id) } },
            select: { itemId: true },
          })
        ).map((row) => row.itemId)
      : [],
  );

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { coins: { decrement: price } } }),
    prisma.purchase.upsert({
      where: { userId_itemId: { userId, itemId } },
      create: { userId, itemId, paidCoins: price, expiresAt },
      update: { paidCoins: price, expiresAt, giftedById: null },
    }),
    // وما بداخلها بثمنٍ صفر: ثمنُه دُفع في الحزمة، والصفّ ملكيّةٌ لا فاتورة.
    ...inside
      .filter((one) => !already.has(one.id))
      .map((one) => prisma.purchase.create({ data: { userId, itemId: one.id, paidCoins: 0 } })),
  ]);

  // وغلافُ الثيم يُلبَس معه — خارج المعاملة: النسخ قد يمرّ بالسحابة.
  await wearItemCover(item.coverMediaId, userId);
  for (const one of inside) {
    if (!already.has(one.id)) await wearItemCover(one.coverMediaId, userId);
  }

  return { ok: `اشتريت ${item.name}`, expiresAt };
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
export async function gift(userId: string, itemId: string, toUserId: string, planId?: string) {
  if (toUserId === userId) throw badRequest("الإهداء لصاحبك لا لنفسك");

  const circle = await circleIds(userId);
  if (!circle.includes(toUserId)) throw forbidden("الإهداء للأصدقاء فقط");

  const [me, item, friend] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { isPlus: true, coins: true } }),
    prisma.storeItem.findUnique({ where: { id: itemId } }),
    prisma.user.findUnique({ where: { id: toUserId }, select: { name: true, isPlus: true } }),
  ]);
  if (!me || !item || !friend || item.hidden) throw notFound("الصنف غير موجود");
  if (item.earnedAfterDays !== null) throw badRequest("هذا الصنف يُكتسب بالوقت، لا يُهدى");
  if (item.plusOnly && !friend.isPlus) throw badRequest(`${friend.name} ليس مشتركاً في آثار+`);

  const terms = await termsFor(item, planId);
  const owned = await prisma.purchase.findUnique({
    where: { userId_itemId: { userId: toUserId, itemId } },
    select: { id: true, expiresAt: true },
  });
  // ما يملكه للأبد لا يُهدى؛ وما يملكه بمدّةٍ تُهدى له مدّةٌ تُضاف إليها.
  if (owned && (owned.expiresAt === null || terms.days === null) && (!owned.expiresAt || owned.expiresAt > new Date())) {
    throw badRequest(`${friend.name} يملكه أصلاً`);
  }

  const price = priceFor({ priceCoins: terms.list }, me.isPlus);
  if (me.coins < price) throw badRequest("رصيدك لا يكفي");
  const expiresAt = terms.days === null ? null : extend(owned?.expiresAt, terms.days);

  // وحزمةٌ تُهدى تُملّك المُهدى إليه ما بداخلها كذلك.
  const giftInside = await bundleContents(itemId);
  const hasAlready = new Set(
    giftInside.length
      ? (
          await prisma.purchase.findMany({
            where: { userId: toUserId, itemId: { in: giftInside.map((one) => one.id) } },
            select: { itemId: true },
          })
        ).map((row) => row.itemId)
      : [],
  );

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { coins: { decrement: price } } }),
    prisma.purchase.upsert({
      where: { userId_itemId: { userId: toUserId, itemId } },
      create: { userId: toUserId, itemId, paidCoins: price, giftedById: userId, expiresAt },
      update: { paidCoins: price, giftedById: userId, expiresAt },
    }),
    ...giftInside
      .filter((one) => !hasAlready.has(one.id))
      .map((one) =>
        prisma.purchase.create({
          data: { userId: toUserId, itemId: one.id, paidCoins: 0, giftedById: userId },
        }),
      ),
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
    select: { expiresAt: true, item: { select: { kind: true } } },
  });
  if (!purchase) throw forbidden("لا تملك هذا الصنف");
  if (purchase.expiresAt && purchase.expiresAt <= new Date()) throw forbidden("انتهت مدّة هذا الصنف");

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
 * كان هذا الباب مفتوحاً: طلبٌ واحد يمنح صاحبه «آثار+» ورصيدَ متجرٍ
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
      coins: { increment: PLUS_COINS },
    },
  });
  return { ok: "اشتركت في آثار+" };
}

export async function cancelPlus(userId: string) {
  await prisma.user.update({ where: { id: userId }, data: { plusUntil: null } });
  // كلُّ ما يخصّ الاشتراك ينتهي معه في مكانٍ واحد (`services/plus.ts`).
  await endPlus(userId);
  return { ok: true };
}


/**
 * باقات النقاط المعروضة.
 *
 * ما لم يُربط بمنتجٍ في المتجرين (`sku` فارغ) لا يُعرض: باقةٌ تُضغط ولا
 * تفتح نافذة شراء تُقرأ عطلاً. والسعر بالهللات للعرض وحده — ما يُخصم
 * فعلاً يقرّره المتجر بعملة المشتري.
 */
export async function coinPacks() {
  const packs = await prisma.coinPack.findMany({
    where: { hidden: false, NOT: { sku: "" } },
    orderBy: [{ sortOrder: "asc" }, { coins: "asc" }],
    select: { id: true, name: true, coins: true, priceHalalas: true, sku: true },
  });
  return { packs };
}

/**
 * ما انتهت مدّتُه يُنزع ممّن يلبسه — مع كنس الخادم كل خمس دقائق.
 *
 * يُقرأ ما انتهى في آخر أسبوع وحده: ما قبله نُزع في كنسٍ سابق، ولا
 * يُعاد المرور على صفوفٍ لا تنتهي.
 */
export async function expireRentals(): Promise<number> {
  const now = new Date();
  const rows = await prisma.purchase.findMany({
    where: { expiresAt: { lte: now, gt: new Date(now.getTime() - 7 * 86_400_000) } },
    select: { userId: true, itemId: true },
    take: 1000,
  });
  let stripped = 0;
  for (const row of rows) {
    const [a, b, c] = await prisma.$transaction([
      prisma.user.updateMany({ where: { id: row.userId, frameId: row.itemId }, data: { frameId: null } }),
      prisma.user.updateMany({ where: { id: row.userId, charmId: row.itemId }, data: { charmId: null } }),
      prisma.user.updateMany({ where: { id: row.userId, backgroundId: row.itemId }, data: { backgroundId: null } }),
    ]);
    stripped += a.count + b.count + c.count;
  }
  if (stripped > 0) console.log(`↓ نُزع ${stripped} صنفاً انتهت مدّته`);
  return stripped;
}
