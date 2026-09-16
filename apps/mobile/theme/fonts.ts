/**
 * خطوط آثار على الجوّال — نفس خطوط الويب حرفاً بحرف.
 *
 * كان الجوّال بلا خطٍّ أصلاً: أندرويد يرسم بـRoboto وآبل بـSF Pro، فيخرج
 * الاسمُ نفسه بثلاثة أشكال على ثلاث شاشات. والعلامةُ لا تُبنى على خطٍّ
 * يختاره الجهاز.
 *
 * **وكلُّ وزنٍ عائلةٌ مستقلّة** حين تُحمَّل بـ`useFonts`: `fontWeight`
 * لا يختار الملفّ الثقيل من عائلةٍ محمّلةٍ بهذه الطريقة — يرسم أندرويد
 * الوزنَ العادي مصطنعاً عريضاً، فيبدو النصّ ضبابياً. ولذلك يُترجَم الوزن
 * إلى اسم عائلة هنا، ويُحذف `fontWeight` من النمط (`components/type.tsx`).
 *
 * والمقاسات من القاعدة ٧: متنٌ ١٥ وارتفاع سطرٍ ١٫٧٥ — العربية تحتاج
 * تنفّساً أكبر من اللاتينية.
 */

/** المتن: IBM Plex Sans Arabic بأربعة أوزان. */
export const BODY = {
  400: "IBMPlexSansArabic_400Regular",
  500: "IBMPlexSansArabic_500Medium",
  600: "IBMPlexSansArabic_600SemiBold",
  700: "IBMPlexSansArabic_700Bold",
} as const;

/** العناوين: Tajawal — وزنان يكفيان، فالعنوان إمّا عاديّ أو ثقيل. */
export const DISPLAY = {
  400: "Tajawal_400Regular",
  700: "Tajawal_700Bold",
} as const;

/**
 * اللاتيني: Montserrat. و٧٠٠ معه لا ٥٠٠ وحده — كلمة ATHAR في الويب
 * بوزن ٧٠٠، وبـ٥٠٠ وحده تخرج العلامةُ أخفّ على الجوّال منها على الويب.
 */
export const LATIN = {
  500: "Montserrat_500Medium",
  700: "Montserrat_700Bold",
} as const;

/** وجه الخطّ المطلوب: المتن افتراضاً. */
export type Face = "body" | "display" | "latin";

/** ما يقبله `fontWeight` في React Native، مردوداً إلى رقم. */
export function weightOf(w: unknown): number {
  if (w === "bold") return 700;
  if (w === "normal" || w == null) return 400;
  const n = Number(w);
  return Number.isFinite(n) ? n : 400;
}

/**
 * اسم العائلة لوجهٍ ووزن. الوزنُ يُقرّب إلى أقرب وزنٍ موجود نزولاً ثم
 * صعوداً، فطلبُ ٣٠٠ يأخذ ٤٠٠ ولا يسقط إلى خطّ النظام.
 */
export function familyOf(face: Face, weight: unknown): string {
  const w = weightOf(weight);
  if (face === "latin") return w >= 600 ? LATIN[700] : LATIN[500];
  if (face === "display") return w >= 600 ? DISPLAY[700] : DISPLAY[400];
  if (w >= 700) return BODY[700];
  if (w >= 600) return BODY[600];
  if (w >= 500) return BODY[500];
  return BODY[400];
}

/** مقاس المتن الافتراضي وارتفاع سطره (القاعدة ٧). */
export const TEXT = { size: 15, lineHeight: 15 * 1.75 } as const;
