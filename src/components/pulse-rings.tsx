/**
 * دوائرُ تنبض حول صورةٍ فيها قصّةٌ أو نوتٌ لم تُشاهَد (القاعدة ٣٢٠) — **بقرار المالك**،
 * بدل الحلقة والنقطة، ونسخةُ `PulseRing` في الجوّال: ثلاثُ حلقاتٍ تتّسع من حافّة
 * الصورة وتبهت متتاليةً. تُوضع قبل الصورة داخل حاويةٍ `relative` فتُرسم خلفها.
 */
export function PulseRings() {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0">
      {[0, 600, 1200].map((delay) => (
        <span
          key={delay}
          className="pulse-ring absolute rounded-full"
          style={{ inset: -3, border: "2.5px solid var(--color-clay)", animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  );
}
