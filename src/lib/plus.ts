/**
 * مُددُ منح آثار+ من اللوحة.
 *
 * قائمةٌ مغلقة لا حقلُ أيام — كمُدد الإيقاف (القاعدة ١١٦): حقلٌ حرّ
 * يقبل «٩٩٩٩» بزلّة إصبع، واشتراكٌ لسبعٍ وعشرين سنة هبةٌ لا تُسترجع.
 *
 * وهو ملفٌّ وحده لا ثابتٌ في `actions.ts`: ملفُّ `"use server"` لا
 * يُصدِّر إلا دوالَّ غير متزامنة (القاعدة ١١٧)، ويقرؤه الإجراءُ
 * ومكوّنُ العميل معاً.
 */
/**
 * رصيد الشهر الذي يُودع مع أوّل تفعيل — نفس `PLUS_COINS` في
 * `packages/shared`: الويب الحالي لا يقرأ الحزمة، والرقم واحد.
 */
export const PLUS_COINS = 1000;

export const PLUS_DAYS = [30, 90, 180, 365] as const;

export type PlusDays = (typeof PLUS_DAYS)[number];

/** ما يُكتب في القائمة — بالعربية لا برقمٍ عارٍ بجانب «يوم». */
export const PLUS_LABEL: Record<PlusDays, string> = {
  30: "شهر",
  90: "٣ أشهر",
  180: "٦ أشهر",
  365: "سنة",
};

export function isPlusDays(value: number): value is PlusDays {
  return (PLUS_DAYS as readonly number[]).includes(value);
}
