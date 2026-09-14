const ARABIC_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

/**
 * الأرقام عربيةٌ في كل مكان.
 *
 * نسخةٌ من `src/lib/format.ts`: النصوص تظهر للمستخدم نفسه على الويب
 * والموبايل، فاختلافُ «٣» عن «3» بين الاثنين يُقرأ تطبيقين لا واحداً.
 */
export const ar = (value: number | string): string =>
  String(value).replace(/\d/g, (d) => ARABIC_DIGITS[Number(d)]);

export const riyals = (halalas: number): string => {
  const whole = halalas / 100;
  return `${ar(Number.isInteger(whole) ? String(whole) : whole.toFixed(2))} ر.س`;
};

export function timeOfDay(date: Date): string {
  const hours = date.getHours();
  const suffix = hours < 12 ? "ص" : "م";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${ar(hour12)}:${ar(String(date.getMinutes()).padStart(2, "0"))} ${suffix}`;
}

export function relative(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "الآن";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `قبل ${ar(minutes)} دقيقة`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `قبل ${ar(hours)} ساعة`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "أمس";
  return `قبل ${ar(days)} يوم`;
}

export const initial = (name: string): string => name.trim().charAt(0) || "؟";

export function presence(lastSeenAt: string | null | undefined): string {
  if (!lastSeenAt) return "";
  const minutes = Math.floor((Date.now() - new Date(lastSeenAt).getTime()) / 60000);
  if (minutes < 3) return "متصل الآن";
  if (minutes < 60) return `قبل ${ar(minutes)} دقيقة`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `قبل ${ar(hours)} ساعة`;
  return `قبل ${ar(Math.floor(hours / 24))} يوم`;
}

/** «لك معانا» — المدّة منذ الانضمام، بأكبر وحدةٍ تصدُق. */
export function withUs(since: string): string {
  const days = Math.floor((Date.now() - new Date(since).getTime()) / 86_400_000);
  if (days < 30) return `${ar(Math.max(1, days))} يوم`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${ar(months)} شهر`;
  return `${ar(Math.floor(months / 12))} سنة`;
}
