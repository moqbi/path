/**
 * علامة أثر.
 *
 * الرمز قمة مدوّرة بحدّ سميك مع نقطة منفصلة أعلى اليمين — تُقرأ جبلاً أو
 * شخصاً رافعاً يده. التدرّج معرّف مرة واحدة بمعرّف ثابت: تكراره في الصفحة
 * يشير إلى نفس التعريف، وهو مطابق، فلا فرق بصري.
 */
export function AthrMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="athr-mark" x1="6" y1="42" x2="42" y2="8" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F6B93B" />
          <stop offset="1" stopColor="#FF7A5A" />
        </linearGradient>
      </defs>
      <path
        d="M9 40 L21.2 15.4a3.2 3.2 0 0 1 5.7 0L33 27.6"
        stroke="url(#athr-mark)"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="36.4" cy="12.6" r="4.8" fill="url(#athr-mark)" />
    </svg>
  );
}

/** العلامة كاملة: الرمز ثم ATHR باللاتيني وأثر بالعربي تحته. */
export function AthrLockup({ size = 44 }: { size?: number }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <AthrMark size={size * 1.5} />
      <div className="flex flex-col items-center gap-1">
        <span className="latin text-ink" style={{ fontSize: size * 0.62, fontWeight: 700 }}>
          ATHR
        </span>
        <span
          className="text-ink-2"
          style={{ fontSize: size * 0.4, letterSpacing: "0.32em", fontWeight: 300 }}
        >
          أثر
        </span>
      </div>
    </div>
  );
}

/** العلامة في شريط علوي: الرمز مع الاسم اللاتيني بجانبه. */
export function AthrHeaderMark() {
  return (
    <span className="flex items-center gap-3">
      <AthrMark size={34} />
      <span className="latin" style={{ fontSize: 23, fontWeight: 700, letterSpacing: ".06em", color: "var(--color-chrome-ink)" }}>
        ATHR
      </span>
    </span>
  );
}

/**
 * علامةٌ لشاشةٍ لها اسمها الخاص (المتجر مثلاً): الرمز، ثم خطٌّ فاصل، ثم
 * اسم الشاشة — بنفس وزن `AthrHeaderMark` حتى لا يبدو رأس الشاشة أخفّ أو
 * أثقل من بقية التبويبات.
 */
export function AthrPageMark({ label }: { label: string }) {
  return (
    // ٤٠ ارتفاعاً دائماً: رأسٌ بلا زرٍّ بجانب العلامة كان يقصر عن غيره.
    <span className="flex items-center gap-3" style={{ minHeight: 40 }}>
      <AthrMark size={34} />
      <span
        aria-hidden="true"
        style={{ width: 1, height: 18, background: "var(--color-chrome-line)" }}
      />
      <span style={{ fontSize: 18, fontWeight: 700, color: "var(--color-chrome-ink)" }}>
        {label}
      </span>
    </span>
  );
}

export const TAGLINE_AR = "لحظاتك، مع ناسك.";
export const TAGLINE_EN = "Your people. Your moments. Your story.";
