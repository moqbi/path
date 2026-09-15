import { Hono } from "hono";
import { timingSafeEqual } from "node:crypto";
import { env } from "../../env";
import { unauthorized } from "../../lib/errors";
import { applyEvent, type RevenueCatEvent } from "../../services/billing";

/**
 * بابُ RevenueCat.
 *
 * خارج `requireAuth` عمداً: المُنادي خادمُ RevenueCat لا مستخدم، فلا
 * توكن معه. وحارسُه ترويسةُ `Authorization` تُضبط في لوحتهم وتُقارن
 * هنا بوقتٍ ثابت — المقارنة العادية تُسرّب طول ما طابق حرفاً حرفاً.
 *
 * وبلا سرٍّ مضبوط يُغلق الباب: خادمٌ نُشر ونُسي مفتاحُه أسوأ من باب
 * مقفل، فمن يعرف العنوان يمنح نفسه اشتراكاً.
 */
const matches = (given: string, expected: string): boolean => {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};

export const webhookRoutes = new Hono().post("/revenuecat", async (c) => {
  const secret = env.REVENUECAT_WEBHOOK_SECRET;
  if (!secret) throw unauthorized("باب الفوترة غير مضبوط");

  const header = c.req.header("authorization") ?? "";
  if (!matches(header, secret)) throw unauthorized("ترويسة غير صحيحة");

  const body = (await c.req.json().catch(() => null)) as { event?: RevenueCatEvent } | null;
  if (!body?.event) return c.json({ ok: "لا حدث" });

  /*
    ويُردّ ٢٠٠ لكل حمولةٍ فُهمت — حتى لو لم يكن لها أثر عندنا: كل ردٍّ
    آخر يُعدّ فشلاً فيعيد RevenueCat إرسالها خمس مرات ثم يتوقّف.
  */
  const result = await applyEvent(body.event);
  return c.json(result);
});
