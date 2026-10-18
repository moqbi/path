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

/**
 * دولةُ صاحب الحساب من آخر مدينةٍ قرأها جهازُه: داخل المملكة تُكتب المدينةُ بلا
 * دولة فهي `SA`، وخارجها الدولةُ بعد الفاصلة. ودولةٌ لا نعرفها `null` — تبقى لها
 * المناسباتُ العامّة وحدها.
 */
export function countryOf(lastCity: string | null | undefined): CountryCode | null {
  if (!lastCity) return "SA";
  const at = lastCity.lastIndexOf("،");
  if (at < 0) return "SA";
  const name = lastCity.slice(at + 1).trim();
  return COUNTRIES.find((country) => (country.aliases as readonly string[]).includes(name))?.code ?? null;
}
