/**
 * بوّابةٌ زمنيّة في الذاكرة: «افعلْ هذا مرّةً كل مدّة».
 *
 * تُستعمل لما يُكتب كثيراً ولا يضرّ تأخّرُه: ختمُ الحضور، وما شابهه.
 * وعند تعدّد نسخ الخادم تصير كلُّ نسخةٍ بوّابتَها — وهذا مقبولٌ هنا:
 * غايتُها تخفيفُ الكتابة لا ضمانُ المرّة الواحدة.
 *
 * والمفاتيحُ تُكنَس كسولاً: ما انتهت مدّتُه يُحذف عند أوّل مرورٍ بعدها،
 * فلا خيطَ تنظيفٍ يعمل في الفراغ.
 */
const gates = new Map<string, number>();

export function passed(key: string, everyMs: number, now = Date.now()): boolean {
  const until = gates.get(key);
  if (until && until > now) return false;

  // كنسٌ خفيف: عند كلّ مئة مفتاح نمسح ما انتهى.
  if (gates.size > 100) {
    for (const [k, v] of gates) if (v <= now) gates.delete(k);
  }

  gates.set(key, now + everyMs);
  return true;
}
