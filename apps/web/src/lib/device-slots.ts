/**
 * صورُ «الأجهزة المدعومة» في الموقع (القاعدة ٤٧٥): كلُّ شاشةٍ في إطارها تُبدَّل من اللوحة.
 * يقرؤها مكوّنُ العميل في اللوحة والصفحةُ معاً، فتجلس وحدها بلا `prisma` (القاعدة ١١٢).
 * وبلا صورةٍ مرفوعة تبقى لقطاتُ `public/shots` كما رسمها الكود.
 */
export const DEVICE_SLOTS = [
  { key: "device.iphone", label: "آيفون قائماً", hint: "لقطةٌ طوليّة من الجوّال — ١١٧٠×٢٥٣٢ مثلاً" },
  { key: "device.iphone.land", label: "آيفون مُداراً", hint: "لقطةٌ عرضيّة — القائمة واللوحة معاً" },
  { key: "device.ipad", label: "آيباد", hint: "لقطةٌ عرضيّة بنسبة ٤:٣" },
  { key: "device.fold.open", label: "القابل للطيّ مفتوحاً", hint: "لقطةٌ عرضيّة بنسبة ٤:٣ تقريباً" },
  { key: "device.fold.closed", label: "القابل للطيّ مطويّاً", hint: "لقطةٌ طوليّة أعرض من الجوّال (نحو ٢:٣)" },
] as const;

export type DeviceKey = (typeof DEVICE_SLOTS)[number]["key"];
