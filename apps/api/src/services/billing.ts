import { prisma } from "@athar/db";
import { PLUS_CREDIT_HALALAS, PLUS_ENTITLEMENT } from "@athar/shared";
import { env } from "../env";

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

/** الدورة التي يُودَع فيها رصيد أثر+ — شهرٌ، مهما كانت مدّة الفاتورة. */
const CREDIT_DAYS = 30;

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

  /*
    شراءٌ تجريبيّ لا يفتح اشتراكاً في الإنتاج.

    المشروع الواحد في RevenueCat يجمع المتجر التجريبي والمتجرين
    الحقيقيين، فحدثٌ من `TEST_STORE` أو بيئةِ `SANDBOX` يصل بنفس الترويسة
    إلى نفس الباب. وقبولُه في الإنتاج يعني أنّ نسخةً تجريبية تفتح أثر+
    لحسابٍ حقيقيّ بضغطةٍ في نافذةٍ وهمية.

    وفي التطوير يُقبل — وإلا لم يُختبر المسار أصلاً قبل أن يوجد حساب آبل.
  */
  const sandbox = event.environment === "SANDBOX" || event.store === "TEST_STORE";
  if (sandbox && !env.ALLOW_SANDBOX_BILLING) {
    console.log(`↷ حدث فوترةٍ تجريبيّ مُهمَل (${type})`);
    return { ok: "حدثٌ تجريبيّ — مُهمَل في الإنتاج" };
  }

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

    /*
      أوّل إيداعٍ يجري هنا، وما بعده يجري مع الكنس الدوريّ
      (`dripPlusCredit`): الوعد «٣٠ ر.س شهرياً» لا «مع كل فاتورة» —
      ومن اشترك سنوياً يفوتر مرّةً واحدة، فربطُ الرصيد بالفاتورة كان
      يعطيه دفعةً واحدة بدل اثنتي عشرة.
    */
    const row = await tx.user.findUnique({
      where: { id: userId },
      select: { plusCreditAt: true },
    });
    const first = active && !row?.plusCreditAt;

    await tx.user.update({
      where: { id: userId },
      data: {
        isPlus: active,
        plusUntil: active ? until : null,
        ...(first ? { storeCredit: { increment: PLUS_CREDIT_HALALAS }, plusCreditAt: new Date() } : null),
        // ومن أُوقف يُنسى ختمُه، فيبدأ عند عودته دورةً جديدة لا يكملها.
        ...(active ? null : { plusCreditAt: null }),
      },
    });
  });

  return { ok: active ? "فُعّل أثر+" : "أُوقف أثر+" };
}


/**
 * يودع دورة الرصيد لمن استحقّها.
 *
 * يجري مع الكنس الدوريّ لا بمهمّةٍ مجدولة على خادمٍ لا نملكه، وبدفعاتٍ
 * محدودة كي لا يطول الطلب. والختم يتقدّم شهراً لا يُضبط على اللحظة:
 * خادمٌ نام يومين يُعطي صاحبه ما فاته لا يبتلعه.
 */
export async function dripPlusCredit(limit = 200): Promise<number> {
  const due = new Date(Date.now() - CREDIT_DAYS * 86_400_000);

  const rows = await prisma.user.findMany({
    where: {
      isPlus: true,
      plusUntil: { gt: new Date() },
      plusCreditAt: { lt: due },
    },
    select: { id: true, plusCreditAt: true },
    take: limit,
  });

  for (const row of rows) {
    const next = new Date((row.plusCreditAt?.getTime() ?? Date.now()) + CREDIT_DAYS * 86_400_000);
    await prisma.user.update({
      where: { id: row.id },
      data: { storeCredit: { increment: PLUS_CREDIT_HALALAS }, plusCreditAt: next },
    });
  }

  if (rows.length > 0) console.log(`↑ أُودع رصيد أثر+ لـ${rows.length}`);
  return rows.length;
}

/** ومن انتهى اشتراكه يُنسى ختمُه، فيبدأ عند عودته دورةً جديدة. */
export async function forgetCycle(userId: string): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { plusCreditAt: null } });
}
