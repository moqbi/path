/**
 * نطاقُ الموقع من البيئة لا من الكود (القاعدة ١٠٥).
 *
 * والفراغُ ليس عطلاً: ما يحتاج رابطاً مطلقاً يقول إنّه لا يستطيع،
 * ولا يُكتب نطاقٌ في ملفٍّ يُنسى بعد أن يُحسم.
 */
export const SITE_URL: string = (
  process.env.SITE_URL ??
  process.env.NEXT_PUBLIC_SITE_URL ??
  ""
).replace(/\/+$/, "");
