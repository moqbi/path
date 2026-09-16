/** أرقام عربية-هندية، لأن الواجهة كلها بالعربي. */
const ARABIC_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

export function ar(value: number | string): string {
  return String(value).replace(/\d/g, (d) => ARABIC_DIGITS[Number(d)]);
}

/**
 * النقاط إلى نصّ: 500 → «٥٠٠ نقطة».
 *
 * عملة المتجر الوحيدة، فلا كسور فيها ولا هللات. والصيغة عربية: العدد
 * يُميَّز بالجمع من ثلاثةٍ إلى عشرة وبالمفرد فيما فوقها — «٥ نقاط»
 * و«٥٠٠ نقطة»، لا «٥٠٠ نقاط».
 */
export function coinText(coins: number): string {
  const unit =
    coins === 1 ? "نقطة" : coins === 2 ? "نقطتان" : coins >= 3 && coins <= 10 ? "نقاط" : "نقطة";
  if (coins === 1 || coins === 2) return unit;
  return `${ar(String(coins))} ${unit}`;
}

/** الهللات إلى نصّ بالريال: 3000 → «٣٠ ر.س». لسعر الباقة والاشتراك. */
export function riyals(halalas: number): string {
  const whole = halalas / 100;
  const text = Number.isInteger(whole) ? String(whole) : whole.toFixed(2);
  return `${ar(text)} ر.س`;
}

export function timeOfDay(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const suffix = hours < 12 ? "ص" : "م";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${ar(hour12)}:${ar(String(minutes).padStart(2, "0"))} ${suffix}`;
}

const MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];
const WEEKDAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export function dayLabel(date: Date): string {
  const today = new Date();
  const sameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
  if (sameDay) return "اليوم";

  return `${WEEKDAYS[date.getDay()]} ${ar(date.getDate())} ${MONTHS[date.getMonth()]}`;
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

/** «لين ١٢:٠٠» أو «انتهى» لحضور مؤقت. */
export function until(expiresAt: Date): string {
  if (expiresAt.getTime() <= Date.now()) return "انتهى";
  return `لين ${timeOfDay(expiresAt)}`;
}

/**
 * متى ينتهي إيقافٌ مؤقّت — بتاريخه كاملاً لا بمدّةٍ نسبيّة.
 *
 * و`relative()` لا تصلح: هي لما مضى، فتردّ «الآن» لكل تاريخٍ في
 * المستقبل — فيُقرأ إيقافُ ثلاثة أيام «ينتهي الآن». وهذا ما ظهر فعلاً
 * في اللوحة.
 *
 * والتقويم ميلاديّ بالعربية كبقية التطبيق (`dayLabel`): `ar-SA` وحدها
 * تُخرجه هجرياً («٨ ربيع الآخر ١٤٤٨») — وشاشةٌ تخلط التقويمين تُقرأ
 * تاريخين لا واحداً. و`-u-ca-gregory` تحسمه.
 */
export function untilDay(date: Date): string {
  return `${dayLabel(date)} ${timeOfDay(date)}`;
}

export function initial(name: string): string {
  return name.trim().charAt(0) || "؟";
}

/** «متصل الآن» أو «آخر ظهور …» — من ختم آخر فتح. */
export function presence(lastSeenAt: Date | null | undefined): string {
  if (!lastSeenAt) return "";
  const minutes = Math.floor((Date.now() - lastSeenAt.getTime()) / 60000);
  if (minutes < 3) return "متصل الآن";
  if (minutes < 60) return `آخر ظهور قبل ${ar(minutes)} دقيقة`;

  const today = new Date();
  const sameDay =
    lastSeenAt.getFullYear() === today.getFullYear() &&
    lastSeenAt.getMonth() === today.getMonth() &&
    lastSeenAt.getDate() === today.getDate();
  if (sameDay) return `آخر ظهور اليوم ${timeOfDay(lastSeenAt)}`;

  const hours = Math.floor(minutes / 60);
  if (hours < 48) return "آخر ظهور أمس";
  return `آخر ظهور ${dayLabel(lastSeenAt)}`;
}

/**
 * طول العضوية بلسانٍ عربي: «١٢ يوماً»، «شهران»، «٣ سنوات».
 *
 * العربية تعدّ المفرد والمثنى والجمع بصيغٍ مختلفة، ورقمٌ عارٍ بجانب
 * «شهر» يُقرأ ركيكاً. والوحدة تكبر مع الوقت: الأيام تُقال أياماً حتى
 * يتمّ الشهر، ثم شهوراً حتى تتمّ السنة.
 */
export function membership(from: Date): string {
  const days = Math.max(0, Math.floor((Date.now() - from.getTime()) / 86_400_000));
  if (days < 1) return "أول يوم";
  if (days < 30) return count(days, "يوم", "يومان", "أيام", "يوماً");
  const months = Math.floor(days / 30.44);
  if (months < 12) return count(months, "شهر", "شهران", "أشهر", "شهراً");
  return count(Math.floor(days / 365.25), "سنة", "سنتان", "سنوات", "سنة");
}

function count(n: number, one: string, two: string, few: string, many: string): string {
  if (n <= 1) return one;
  if (n === 2) return two;
  if (n <= 10) return `${ar(n)} ${few}`;
  return `${ar(n)} ${many}`;
}
