/**
 * أيّامُ الرياض (القاعدة ٢٣٥).
 *
 * «في مثل هذا اليوم» يومٌ بتوقيت صاحبه لا بتوقيت الخادم: لحظةٌ كُتبت الساعة
 * الواحدة فجراً في الرياض هي في فرانكفورت لحظةُ الأمس. والرياضُ بلا توقيتٍ
 * صيفيّ، فالإزاحةُ ثابتة — وجمهورُ التطبيق فيها (كالوضع الهادئ في `push.ts`).
 */
const OFFSET_MS = 3 * 60 * 60 * 1000;

export type Day = { y: number; m: number; d: number };

/** اليومُ في الرياض لهذه اللحظة. */
export function riyadhDay(at = new Date()): Day {
  const shifted = new Date(at.getTime() + OFFSET_MS);
  return { y: shifted.getUTCFullYear(), m: shifted.getUTCMonth() + 1, d: shifted.getUTCDate() };
}

export function dayKey(day: Day): string {
  return `${day.y}-${String(day.m).padStart(2, "0")}-${String(day.d).padStart(2, "0")}`;
}

/** الساعةُ الآن في الرياض (٠–٢٣). */
export function riyadhHour(at = new Date()): number {
  return new Date(at.getTime() + OFFSET_MS).getUTCHours();
}

/** أوّلُ اليوم وآخرُه بالتوقيت العالميّ — لشرط `createdAt` في الاستعلام. */
export function dayRange(day: Day): { gte: Date; lt: Date } {
  const start = Date.UTC(day.y, day.m - 1, day.d) - OFFSET_MS;
  return { gte: new Date(start), lt: new Date(start + 86_400_000) };
}

/**
 * اليومُ نفسه قبل عددٍ من الأشهر — أو لا شيء إن لم يكن له مثيل: ٣١ أكتوبر
 * ليس له «قبل شهر» (لا ٣١ سبتمبر)، و٢٩ فبراير لا يعود إلا كلَّ أربع.
 * التقريبُ إلى أقرب يومٍ كان سيُري ذكرى يومٍ آخر بعنوان «في مثل هذا اليوم».
 */
export function monthsBefore(day: Day, months: number): Day | null {
  const total = day.y * 12 + (day.m - 1) - months;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  const probe = new Date(Date.UTC(y, m - 1, day.d));
  if (probe.getUTCMonth() !== m - 1) return null;
  return { y, m, d: day.d };
}

const DIGITS = "٠١٢٣٤٥٦٧٨٩";
export const ar = (n: number | string) => String(n).replace(/\d/g, (d) => DIGITS[Number(d)]);

/**
 * المدّةُ بالعربية بالمفرد والمثنى والجمع: «شهر»، «٦ أشهر»، «سنة»، «سنتين»،
 * «٣ سنوات»، «١١ سنة».
 */
export function spanText(months: number): string {
  if (months < 12) return months === 1 ? "شهر" : months === 2 ? "شهرين" : `${ar(months)} ${months <= 10 ? "أشهر" : "شهراً"}`;
  const years = Math.round(months / 12);
  if (years === 1) return "سنة";
  if (years === 2) return "سنتين";
  return `${ar(years)} ${years <= 10 ? "سنوات" : "سنة"}`;
}

/**
 * العددُ وتمييزُه: «لحظة واحدة»، «لحظتين»، «٧ لحظات»، «١٢ لحظة».
 * والفاصلُ بين عددين فاصلةٌ لا «·»: الصفرُ العربيّ نقطة، فـ«١ ·» يُقرأ «١٠».
 */
export function counted(n: number, one: string, two: string, few: string, many: string): string {
  if (n <= 1) return one;
  if (n === 2) return two;
  return `${ar(n)} ${n <= 10 ? few : many}`;
}

/** «٧ أيام»، «١٤ يوماً». */
export function daysText(days: number): string {
  if (days === 1) return "يوم";
  if (days === 2) return "يومين";
  return `${ar(days)} ${days <= 10 ? "أيام" : "يوماً"}`;
}
