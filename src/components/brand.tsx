/**
 * علامة آثار.
 *
 * الرمز صورةٌ لا رسمٌ في الكود (`public/athr-mark.png`): قمّةٌ بشريطٍ
 * مطويّ ونقطةٌ أعلى اليمين، بتدرّجها وظلالها كما رسمها المالك — ولا
 * يُقلّدها `stroke` في SVG. واستبدال الملف يغيّرها في التطبيق كله بلا
 * لمس الكود، كرسوم التفاعلات وقوس النشر.
 *
 * والخلفية شفّافة، فتُقرأ على الورق الفاتح وعلى الشريط الداكن سواء.
 */
export function AthrMark({ size = 32 }: { size?: number }) {
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src="/athr-mark.png"
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      style={{ width: size, height: size, objectFit: "contain", display: "block" }}
    />
  );
}

/** العلامة كاملة: الرمز ثم ATHAR باللاتيني وأثر بالعربي تحته. */
export function AthrLockup({ size = 44 }: { size?: number }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <AthrMark size={size * 1.5} />
      <div className="flex flex-col items-center gap-1">
        <span className="latin text-ink" style={{ fontSize: size * 0.62, fontWeight: 700 }}>
          ATHAR
        </span>
        <span
          className="text-ink-2"
          style={{ fontSize: size * 0.4, letterSpacing: "0.32em", fontWeight: 300 }}
        >
          آثار
        </span>
      </div>
    </div>
  );
}

/** العلامة في شريط علوي: الرمز مع الاسم اللاتيني بجانبه. */
export function AthrHeaderMark() {
  return (
    <span className="flex items-center gap-3">
      <AthrMark size={44} />
      <span className="latin" style={{ fontSize: 23, fontWeight: 700, letterSpacing: ".06em", color: "var(--color-chrome-ink)" }}>
        ATHAR
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
    <span className="flex items-center gap-3" style={{ minHeight: 44 }}>
      <AthrMark size={44} />
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
