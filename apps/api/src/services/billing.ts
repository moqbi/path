import { prisma } from "@athar/db";
import { PLUS_CREDIT_HALALAS, PLUS_ENTITLEMENT } from "@athar/shared";

/**
 * أثر+ من المتجرين عبر RevenueCat.
 *
 * الدفع لا يمرّ بخادمنا: يشتري المستخدم من App Store أو Google Play،
 * وRevenueCat يجمع الإيصالين ويرسل لنا حدثاً. ونحن لا نثق بما يقوله
 * التطبيق عن نفسه («اشتريتُ، فعّل لي») — الخادم لا يصدّق إلا الحدث
 * الموقّع القادم من RevenueCat.
 *
 * وهذا يمنع أيضاً ما كان قائماً: زرٌّ يفعّل الاشتراك مجّاناً بطلبٍ واحد.
 */

/** ما يعنينا من حمولة الحدث — والبقية تُتجاهل بلا خطأ. */
export type RevenueCatEvent = {
  id?: string;
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  aliases?: string[];
  entitlement_ids?: string[] | null;
  expiration_at_ms?: number | null;
  event_timestamp_ms?: number;
  environment?: string;
  store?: string;
  transferred_from?: string[];
  transferred_to?: string[];
};

/** أنواعٌ تُسقط الاشتراك فوراً مهما قال تاريخ الانتهاء. */
const ENDS_NOW = new Set(["EXPIRATION", "SUBSCRIPTION_PAUSED"]);

/** أنواعٌ تُودَع معها دورةُ رصيدٍ جديدة. */
const PAYS = new Set(["INITIAL_PURCHASE", "RENEWAL", "PRODUCT_CHANGE", "UNCANCELLATION"]);

/**
 * `app_user_id` هو معرّف المستخدم عندنا — يُضبط بـ`Purchases.logIn` في
 * التطبيق. ومن لم يُعرَّف بعد يأتي بمعرّفٍ مجهولٍ من RevenueCat يبدأ
 * بـ`$RCAnonymousID:`، فيُبحث في الأسماء البديلة عن معرّفٍ نعرفه.
 */
async function resolveUser(event: RevenueCatEvent): Promise<string | null> {
  const candidates = [
    event.app_user_id,
    event.original_app_user_id,
    ...(event.aliases ?? []),
    ...(event.transferred_to ?? []),
  ].filter((id): id is string => typeof id === "string" && !id.startsWith("$RCAnonymousID:"));

  for (const id of candidates) {
    const found = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (found) return found.id;
  }
  return null;
}

/**
 * يطبّق حدثاً واحداً.
 *
 * والحالة تُقرأ من `expiration_at_ms` لا من نوع الحدث: «ألغى» تعني
 * أوقف التجديد التلقائي ويبقى مشتركاً إلى نهاية مدّته — ومن يحذف
 * اشتراكه من الحدث نفسه يسلب الناس ما دفعوا ثمنه.
 */
export async function applyEvent(event: RevenueCatEvent): Promise<{ ok: string }> {
  const eventId = event.id;
  const type = event.type ?? "UNKNOWN";

  // فحصٌ مبكّر بلا كتابة: التسليم «مرّةً على الأقل».
  if (eventId) {
    const seen = await prisma.billingEvent.findUnique({ where: { id: eventId }, select: { id: true } });
    if (seen) return { ok: "مكرّر" };
  }

  if (type === "TEST") return { ok: "تجربة" };

  const userId = await resolveUser(event);
  if (!userId) return { ok: "لا حساب لهذا المعرّف" };

  // استحقاقٌ آخر لا يعنينا (لو أُضيف غير «plus» يوماً).
  const ids = event.entitlement_ids ?? [];
  if (ids.length > 0 && !ids.includes(PLUS_ENTITLEMENT)) return { ok: "استحقاق آخر" };

  const until = event.expiration_at_ms ? new Date(event.expiration_at_ms) : null;
  const active = !ENDS_NOW.has(type) && Boolean(until) && until!.getTime() > Date.now();

  /*
    التحويل بين حسابين: من انتقل منه الاشتراك يفقده، ومن انتقل إليه
    يأخذه. والطرف الأول يُعالَج هنا لأنه لا يصله حدثٌ خاصّ به.
  */
  const from = (event.transferred_from ?? []).filter((id) => !id.startsWith("$RCAnonymousID:"));
  if (type === "TRANSFER" && from.length > 0) {
    await prisma.user.updateMany({
      where: { id: { in: from } },
      data: { isPlus: false, plusUntil: null },
    });
  }

  await prisma.$transaction(async (tx) => {
    // الصفّ أولاً: اصطدامُ القيد يوقف المعاملة كلها، فلا يُودَع رصيدٌ مرّتين.
    if (eventId) {
      await tx.billingEvent.create({
        data: {
          id: eventId,
          type,
          appUserId: event.app_user_id ?? userId,
          at: new Date(event.event_timestamp_ms ?? Date.now()),
        },
      });
    }

    await tx.user.update({
      where: { id: userId },
      data: {
        isPlus: active,
        plusUntil: active ? until : null,
        ...(active && PAYS.has(type) ? { storeCredit: { increment: PLUS_CREDIT_HALALAS } } : null),
      },
    });
  });

  return { ok: active ? "فُعّل أثر+" : "أُوقف أثر+" };
}
