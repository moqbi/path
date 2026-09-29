import "server-only";
import { headers } from "next/headers";

/**
 * حدُّ المحاولات لأبواب الموقع المفتوحة بلا جلسة: دخول اللوحة، وحذف الحساب
 * بكلمة المرور، ورسائل «تواصل معنا» والوظائف وفريق التجربة.
 *
 * بلا حدٍّ كان كلٌّ منها **عرّافاً لكلمة المرور** يُسأل بلا نهاية — حذفُ
 * الحساب يقول «صحيحة» أو «غير صحيحة» لأيّ بريد — وكانت الرسائل تُملأ
 * بمرفقاتٍ من بريدٍ جديدٍ في كل مرّة، ومع كلٍّ منها رسالةٌ إلى صندوق الدعم.
 *
 * **في الذاكرة لا في القاعدة**: خادمٌ واحد خلف Caddy، والعدّاد يضيع مع
 * إعادة التشغيل — ثمنٌ مقبول لحارسٍ غايتُه أن يُبطئ المحاولة لا أن يؤرّخها.
 * ولو صار الموقع أكثر من عملية يُنقل إلى Redis.
 */
const buckets = new Map<string, number[]>();

function sweep(now: number) {
  if (buckets.size < 5_000) return;
  for (const [key, hits] of buckets) {
    if (!hits.length || now - hits[hits.length - 1] > 24 * 3600_000) buckets.delete(key);
  }
}

/** يسجّل محاولةً ويردّ `false` إن تجاوز المفتاحُ حدَّه في النافذة. */
export function hit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  sweep(now);
  const recent = (buckets.get(key) ?? []).filter((at) => now - at < windowMs);
  recent.push(now);
  buckets.set(key, recent);
  return recent.length <= limit;
}

/** يمسح عدّاد مفتاح — بعد دخولٍ ناجح، فلا يُحسب خطأُ الأمس على اليوم. */
export function clear(key: string) {
  buckets.delete(key);
}

/**
 * عنوانُ الزائر. خلف Cloudflare يصل Caddy عنوانُ حافّتها لا الزائر، فيُقرأ
 * `CF-Connecting-IP` أوّلاً؛ وبلاه أوّلُ `X-Forwarded-For` — وCaddy يكتبه
 * بنفسه لمن لا يثق به فلا يُزوَّر من الخارج.
 */
export async function clientIp(): Promise<string> {
  const list = await headers();
  return (
    list.get("cf-connecting-ip")?.trim() ||
    list.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    list.get("x-real-ip")?.trim() ||
    "local"
  );
}

export const TOO_MANY = "محاولاتٌ كثيرة — انتظر قليلاً ثمّ أعد";
