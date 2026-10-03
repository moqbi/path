import { prisma } from "@athar/db";
import { PLUS_COINS } from "@athar/shared";
import { env } from "../env";
import { badRequest, forbidden, notFound } from "../lib/errors";
import { circleIds } from "./visibility";
import { push } from "./push";
import type { RevenueCatEvent } from "./billing";

/**
 * إهداءُ آثار+ لصديق — **بقرار المالك** (القاعدة ٢٣٤)، وبمالٍ حقيقيّ من المتجر
 * لا بالنقاط: الاشتراكُ وحده يبقى بمالٍ حقيقيّ (القاعدة ٧٣ج).
 *
 * منتجٌ يُستهلك في المتجر لكلّ مدّة، والدورةُ بابان:
 * ١. `intent` قبل نافذة الشراء: يُكتب صفٌّ «معلّق» فيه المُهدي والمُهدى إليه —
 *    حدثُ RevenueCat يقول من دفع وماذا اشترى، ولا يقول لمن.
 * ٢. `completeGift` من الحدث نفسه: يُطابَق بأحدث معلّقٍ للمُهدي بالمدّة نفسها
 *    في يومٍ، ثمّ يُمدَّد اشتراكُ المُهدى إليه. والتطبيقُ لا يُتمّ شيئاً بقوله.
 */
export const GIFT_PLANS = {
  month: { days: 30, label: "آثار+ شهر" },
  year: { days: 365, label: "آثار+ سنة" },
} as const;
export type GiftPlan = keyof typeof GIFT_PLANS;

function skuOf(plan: GiftPlan): string | undefined {
  return plan === "month" ? env.GIFT_PLUS_MONTH_SKU : env.GIFT_PLUS_YEAR_SKU;
}

/** المُدَدُ التي لها منتجٌ في المتجر — وما لا منتجَ له لا يُعرض. */
export function giftPlans() {
  return (Object.keys(GIFT_PLANS) as GiftPlan[])
    .filter((plan) => Boolean(skuOf(plan)))
    .map((plan) => ({ plan, sku: skuOf(plan)!, days: GIFT_PLANS[plan].days, label: GIFT_PLANS[plan].label }));
}

/** المدّةُ التي يبيعها هذا المنتج، أو لا شيء إن لم يكن منتجَ إهداء. */
export function giftPlanOfSku(sku: string | undefined): GiftPlan | null {
  if (!sku) return null;
  if (env.GIFT_PLUS_MONTH_SKU && sku === env.GIFT_PLUS_MONTH_SKU) return "month";
  if (env.GIFT_PLUS_YEAR_SKU && sku === env.GIFT_PLUS_YEAR_SKU) return "year";
  return null;
}

/** المعلّقُ ينتظر يوماً — شراءٌ يتأخّر أكثرَ من ذلك لا يُطابَق بطلبٍ قديم. */
const PENDING_MS = 24 * 60 * 60 * 1000;

export async function intent(giverId: string, to: string, plan: GiftPlan) {
  const sku = skuOf(plan);
  if (!sku) throw notFound("هذه المدّة غير متاحة");
  if (to === giverId) throw badRequest("الإهداءُ لصديق");

  // للأصدقاء وحدهم كبقيّة الإهداء (القاعدة ٣٩) — والحظرُ يفكّ الصداقة.
  const circle = await circleIds(giverId);
  if (!circle.includes(to)) throw forbidden("الإهداء للأصدقاء فقط");

  const row = await prisma.plusGift.create({
    data: { giverId, recipientId: to, plan, days: GIFT_PLANS[plan].days },
    select: { id: true },
  });
  return { id: row.id, sku };
}

/**
 * يُتمّ الهديةَ من حدث الشراء. والحدثُ يُكتب في `BillingEvent` في المعاملة
 * نفسها، فإعادةُ إرساله تصطدم بالقيد ولا تمنح مرّتين.
 */
export async function completeGift(
  event: RevenueCatEvent,
  giverId: string,
  plan: GiftPlan,
): Promise<{ ok: string }> {
  const eventId = event.id;
  if (!eventId) return { ok: "إهداءٌ بلا معرّف حدث — مُهمَل" };

  const pending = await prisma.plusGift.findFirst({
    where: {
      giverId,
      plan,
      status: "PENDING",
      createdAt: { gte: new Date(Date.now() - PENDING_MS) },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, recipientId: true, days: true, recipient: { select: { name: true } } },
  });

  if (!pending) {
    // دُفع ولا نعرف لمن: يُكتب الحدثُ ويُقال في السجلّ ليُعالَج بيد.
    console.log(`↷ إهداءُ آثار+ بلا طلبٍ معلّق — المُهدي ${giverId} · ${plan} · ${eventId}`);
    await prisma.billingEvent
      .create({
        data: {
          id: eventId,
          type: "NON_RENEWING_PURCHASE",
          appUserId: event.app_user_id ?? giverId,
          at: new Date(event.event_timestamp_ms ?? Date.now()),
        },
      })
      .catch(() => undefined);
    return { ok: "لا طلبَ إهداءٍ معلّق" };
  }

  const giver = await prisma.user.findUnique({ where: { id: giverId }, select: { name: true } });
  const label = GIFT_PLANS[plan].label;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.billingEvent.create({
        data: {
          id: eventId,
          type: "NON_RENEWING_PURCHASE",
          appUserId: event.app_user_id ?? giverId,
          at: new Date(event.event_timestamp_ms ?? Date.now()),
        },
      });
      await tx.plusGift.update({
        where: { id: pending.id },
        data: { status: "DONE", eventId, doneAt: new Date() },
      });

      // يُمدَّد ولا يُستبدَل — كمنح اللوحة (القاعدة ١١٥).
      const target = await tx.user.findUnique({
        where: { id: pending.recipientId },
        select: { plusUntil: true, plusCreditAt: true, isPlus: true },
      });
      const from =
        target?.isPlus && target.plusUntil && target.plusUntil.getTime() > Date.now()
          ? target.plusUntil
          : new Date();
      const first = !target?.plusCreditAt;
      await tx.user.update({
        where: { id: pending.recipientId },
        data: {
          isPlus: true,
          plusUntil: new Date(from.getTime() + pending.days * 86_400_000),
          ...(first ? { coins: { increment: PLUS_COINS }, plusCreditAt: new Date() } : null),
        },
      });

      // سطرٌ عند الطرفين كهدايا المتجر (القاعدة ٩١)، والطرفُ الآخر إشارة.
      const sent = await tx.moment.create({ data: { authorId: giverId, kind: "GIFT_SENT", text: label } });
      const got = await tx.moment.create({ data: { authorId: pending.recipientId, kind: "GIFT_GOT", text: label } });
      await tx.momentTag.createMany({
        data: [
          { momentId: sent.id, userId: pending.recipientId },
          { momentId: got.id, userId: giverId },
        ],
        skipDuplicates: true,
      });
    });
  } catch {
    return { ok: "مكرّر" };
  }

  void push({
    userId: pending.recipientId,
    kind: "GRANT",
    title: "وصلتك هدية",
    body: `${giver?.name ?? "صديقك"} أهداك ${label}`,
    path: "/me",
  });

  return { ok: `أُهدي ${label} إلى ${pending.recipient.name}` };
}
