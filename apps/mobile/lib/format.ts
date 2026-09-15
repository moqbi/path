const ARABIC_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

/**
 * الأرقام عربيةٌ في كل مكان.
 *
 * نسخةٌ من `src/lib/format.ts`: النصوص تظهر للمستخدم نفسه على الويب
 * والموبايل، فاختلافُ «٣» عن «3» بين الاثنين يُقرأ تطبيقين لا واحداً.
 */
export const ar = (value: number | string): string =>
  String(value).replace(/\d/g, (d) => ARABIC_DIGITS[Number(d)]);

export const coinText = (coins: number): string => `${ar(String(coins))} كوينز`;

/** الهللات إلى نصّ بالريال: 3000 → «٣٠ ر.س». لسعر الباقة والاشتراك. */
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

const WEEKDAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
export const MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

/** فاصل اليوم في الخط الزمني: «اليوم» أو «الخميس ١٤ سبتمبر». */
export function dayLabel(date: Date): string {
  const today = new Date();
  const sameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
  if (sameDay) return "اليوم";
  return `${WEEKDAYS[date.getDay()]} ${ar(date.getDate())} ${MONTHS[date.getMonth()]}`;
}

/** العدد وتمييزه: «يوم» و«يومان» و«٥ أيام» و«١٥ يوماً». */
function count(n: number, one: string, two: string, few: string, many: string): string {
  if (n <= 1) return one;
  if (n === 2) return two;
  if (n <= 10) return `${ar(n)} ${few}`;
  return `${ar(n)} ${many}`;
}

/** «لك معانا ٦ أشهر» — نفس الحساب الذي في الويب حرفاً بحرف. */
export function membership(from: string): string {
  const days = Math.max(0, Math.floor((Date.now() - new Date(from).getTime()) / 86_400_000));
  if (days < 1) return "أول يوم";
  if (days < 30) return count(days, "يوم", "يومان", "أيام", "يوماً");
  const months = Math.floor(days / 30.44);
  if (months < 12) return count(months, "شهر", "شهران", "أشهر", "شهراً");
  return count(Math.floor(days / 365.25), "سنة", "سنتان", "سنوات", "سنة");
}

export function presence(lastSeenAt: string | null | undefined): string {
  if (!lastSeenAt) return "";
  const minutes = Math.floor((Date.now() - new Date(lastSeenAt).getTime()) / 60000);
  if (minutes < 3) return "متصل الآن";
  if (minutes < 60) return `قبل ${ar(minutes)} دقيقة`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `قبل ${ar(hours)} ساعة`;
  return `قبل ${ar(Math.floor(hours / 24))} يوم`;
}
