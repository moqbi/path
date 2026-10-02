import type { Context } from "hono";

/**
 * أنواعُ اللحظات التي لا يعرفها جوّالٌ قديم (القاعدة ٢٢٦).
 *
 * النسخةُ المنشورة ترسم ما لا تعرفه بطاقةً فارغة — «غيّر صورته» عند أوّل
 * صورة عرضٍ لحسابٍ جديد كانت قالباً أبيض بزرّ تفاعلٍ وحده. ونسخةٌ في المتجر
 * لا تُصحَّح إلا بتحديثٍ يُنزّله صاحبُها، فالخادمُ يحجبها عمّن لا يقول إنّه
 * يعرفها. والجوّالُ يقول ذلك في `x-moment-kinds`: كلُّ نوعٍ جديدٍ يرفع الرقم
 * ويُضاف هنا بدرجته.
 */
const SINCE: Record<string, number> = {
  AVATAR_CHANGED: 2,
  COINS_GRANTED: 2,
};

export function unknownKinds(c: Context) {
  const level = Number(c.req.header("x-moment-kinds") ?? 1) || 1;
  return Object.entries(SINCE)
    .filter(([, since]) => level < since)
    .map(([kind]) => kind);
}
