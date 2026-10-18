/**
 * الدولُ التي تُضاف لها مناسباتٌ وطنيّة (القاعدة ٢٩٢) — رمزٌ واسمٌ عربيّ وما يكتبه
 * الجهازُ أو نوميناتيم بعد الفاصلة في `lastCity` (القاعدة ٢٨٦). و`ALL` لما يعمّ
 * الجميع: الأعيادُ وأوّلُ رمضان ورأسُ السنة الهجريّة.
 */
export const COUNTRIES = [
  { code: "SA", name: "السعودية", aliases: ["المملكة العربية السعودية", "السعودية"] },
  { code: "AE", name: "الإمارات", aliases: ["الإمارات العربية المتحدة", "الإمارات", "دولة الإمارات العربية المتحدة"] },
  { code: "KW", name: "الكويت", aliases: ["الكويت", "دولة الكويت"] },
  { code: "QA", name: "قطر", aliases: ["قطر", "دولة قطر"] },
  { code: "BH", name: "البحرين", aliases: ["البحرين", "مملكة البحرين"] },
  { code: "OM", name: "عُمان", aliases: ["عمان", "عُمان", "سلطنة عمان", "سلطنة عُمان"] },
  { code: "EG", name: "مصر", aliases: ["مصر", "جمهورية مصر العربية"] },
  { code: "JO", name: "الأردن", aliases: ["الأردن", "المملكة الأردنية الهاشمية"] },
] as const;

export type CountryCode = (typeof COUNTRIES)[number]["code"];
export const ALL_COUNTRIES = "ALL";

/** طيُّ ما تختلف كتابتُه: الهمزات والتاء المربوطة والياء والتشكيل والتطويل وحالةُ الحرف. */
const fold = (text: string) =>
  text
    .normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/** أسماءُ الدولة كما تكتبها آبل ونوميناتيم بلغاتٍ أخرى — جوّالٌ بالإنجليزيّة يكتب «Saudi Arabia». */
const LATIN: Record<CountryCode, string[]> = {
  SA: ["saudi arabia", "kingdom of saudi arabia", "ksa"],
  AE: ["united arab emirates", "uae"],
  KW: ["kuwait"],
  QA: ["qatar"],
  BH: ["bahrain"],
  OM: ["oman"],
  EG: ["egypt"],
  JO: ["jordan"],
};

/**
 * دولةُ صاحب الحساب لمناسبات التقويم (القاعدة ٢٩٢) — **من رمزها أوّلاً**
 * (`lastCountry`: ما قرأه الجهازُ آخرَ مرّة بحرفين)، فالاسمُ يُكتب بأكثر من صيغة
 * ولغة، وكان اسمٌ لا يطابق القائمةَ حرفاً بحرف يُسقط المناسباتِ الوطنيّة كلَّها.
 * وبلا رمزٍ بعدُ (حسابٌ لم يفتح التطبيقَ منذ حُفظ) يُقرأ الاسمُ بعد الفاصلة
 * مطويّاً، وبلا فاصلةٍ هو داخل المملكة. ودولةٌ ليست في القائمة `null` — تبقى لها
 * المناسباتُ العامّة وحدها.
 */
export function countryOf(lastCity: string | null | undefined, lastCountry?: string | null): CountryCode | null {
  const code = lastCountry?.trim().toUpperCase();
  if (code && /^[A-Z]{2}$/.test(code)) return COUNTRIES.find((country) => country.code === code)?.code ?? null;
  if (!lastCity) return "SA";
  const at = lastCity.lastIndexOf("،");
  if (at < 0) return "SA";
  const name = fold(lastCity.slice(at + 1));
  return (
    COUNTRIES.find(
      (country) =>
        (country.aliases as readonly string[]).some((alias) => fold(alias) === name) ||
        LATIN[country.code].includes(name),
    )?.code ?? null
  );
}
