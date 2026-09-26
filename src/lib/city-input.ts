/**
 * المدينةُ كما يكتبها صاحبُها في «تعديل الملف».
 *
 * ما تغيّر بيده يُقفل فلا يكتب فوقه التحديدُ التلقائيّ (`cityLocked`)، ومن
 * أفرغ الحقل يُعيده إلى الجهاز. وما لم يتغيّر لا يُقفل: حفظُ الاسم وحده
 * لا يعني أنّه اختار مدينته.
 */
export function cityInput(raw: string, current: string | null) {
  const city = raw.trim().slice(0, 40) || null;
  if (city === current) return {};
  return { city, cityLocked: city !== null };
}
