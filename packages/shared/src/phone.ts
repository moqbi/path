import { z } from "zod";

/**
 * رقمُ الجوال بصيغةٍ واحدة (E.164) — القاعدة ٢٩٧. نسخةٌ واحدة يقرؤها الخادمُ
 * والجوّالُ معاً: جهاتُ الاتصال تُطبَّع على الجهاز وتُجزَّأ ثمّ تُطابَق على الخادم
 * بتجزئة الرقم المؤكَّد، فأيُّ اختلافٍ في التطبيع بين الطرفين رقمٌ لا يُطابَق أبداً.
 *
 * والرقمُ المحلّيّ بلا رمز دولةٍ سعوديٌّ: «05…» و«5…» → ‎+9665…، وجمهورُ التطبيق
 * فيها. وما بدأ بـ«00» دوليٌّ كـ«+». والأرقامُ العربيّة-الهنديّة تُقرأ.
 * ويردّ `null` لما لا يكون رقماً (أقصر من ثمانية أو أطول من خمسة عشر).
 */
export function normalizePhone(raw: string, country = "966"): string | null {
  const latin = raw.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
  const plus = latin.trim().startsWith("+");
  let digits = latin.replace(/\D/g, "");
  if (!digits) return null;
  if (plus) {
    // كما كُتب.
  } else if (digits.startsWith("00")) {
    digits = digits.slice(2);
  } else if (digits.startsWith(country)) {
    // «9665…» بلا «+».
  } else if (digits.startsWith("0")) {
    digits = country + digits.slice(1);
  } else if (country === "966" && /^5\d{8}$/.test(digits)) {
    digits = country + digits;
  } else {
    return null;
  }
  // «+966 05…» يُكتب أحياناً بصفر بعد رمز الدولة.
  if (digits.startsWith("9660")) digits = "966" + digits.slice(4);
  if (digits.length < 8 || digits.length > 15) return null;
  return `+${digits}`;
}

/** يُعرض الرقمُ مخفيّاً إلّا آخرَه: ‎+966 5•• ••• 12. */
export function maskPhone(e164: string): string {
  return `${e164.slice(0, 4)} ${e164.slice(4, 5)}•• ••• ${e164.slice(-2)}`;
}

/** رمزُ هويّة Firebase بعد تأكيد الرقم هناك — الرقمُ يُقرأ منه على الخادم. */
export const phoneFirebaseInput = z.object({ idToken: z.string().min(100).max(4096) });

/** حدُّ ما يُرفع في المرّة: دفترٌ بألفي رقم يكفي الناس، وما فوقه يُقطع. */
export const CONTACTS_MAX = 2000;
/** جهاتُ الاتصال تُرفع **مجزَّأةً** (sha256 بالسداسيّ لـ E.164) — لا أرقاماً ولا أسماء. */
export const contactsInput = z.object({
  hashes: z.array(z.string().regex(/^[0-9a-f]{64}$/)).max(CONTACTS_MAX),
});
