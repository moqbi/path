/** أرقام عربية-هندية، لأن الواجهة كلها بالعربي. */
const ARABIC_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

export function ar(value: number | string): string {
  return String(value).replace(/\d/g, (d) => ARABIC_DIGITS[Number(d)]);
}

/** الهللات إلى نص بالريال: 1500 → «١٥ ر.س». */
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
