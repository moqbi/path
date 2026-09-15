/**
 * ما التقطته الكاميرا، في طريقه إلى الشاشة التي طلبته.
 *
 * الكاميرا شاشةٌ مستقلّة تُفتح فوق شاشة النشر ثم ترجع، فلا بدّ من مكانٍ
 * تضع فيه اللقطة. والمسار لا يصلح: مسارُ ملفٍ في وسيط تنقّلٍ يظهر في
 * السجلّات ويُقطع إن طال، وشاشة النشر تحمل حالةً قائمة فلا تُستبدَل
 * بشاشةٍ جديدة بوسائط.
 *
 * ولقطةٌ واحدة تُقرأ مرّةً وتُمحى: لو بقيت لعادت الشاشة إليها بعد أن
 * نشرها صاحبها — ورأى صورةً التقطها قبل قليل تعود بلا سبب.
 */
export type Shot = {
  uri: string;
  mime: string;
  width: number;
  height: number;
  video: boolean;
  /** مدّة الفيديو بالثواني — صفرٌ للصورة. */
  seconds: number;
};

let pending: Shot | null = null;

export function keepShot(shot: Shot): void {
  pending = shot;
}

export function takeShot(): Shot | null {
  const shot = pending;
  pending = null;
  return shot;
}
