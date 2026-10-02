import { asset } from "@/lib/base";
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
      src={asset("/athr-mark.png")}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      style={{ width: size, height: size, objectFit: "contain", display: "block" }}
    />
  );
}

/**
 * الاسم اللاتينيّ كلمتين لا كلمةً واحدة.
 *
 * «ATHAR» هي الاسم، و«Moments» لاحقتُه: أصغرُ منها وبلون العلامة، تجلس
 * على خطّ قاعدتها لا في وسطها. وكلمتان بمقاسٍ ولونٍ واحد تُقرآن اسماً
 * من مقطعين متساويين، والثانية ليست كذلك.
 *
 * و`dir="ltr"` لازمةٌ لا زينة: المستند `rtl`، فصفٌّ تحته يرصّ من
 * اليمين — وكانت تُقرأ «Moments ATHAR».
 *
 * و`items-baseline` لا `items-center`: كلمةٌ صغيرة في وسط كلمةٍ كبيرة
 * تطفو فوق خطّها، والعين تقرأ سطرين لا سطراً.
 */
export function AthrWordmark({
  size = 24,
  color,
  accent = "var(--color-clay)",
}: {
  size?: number;
  color?: string;
  accent?: string;
}) {
  return (
    <span dir="ltr" className="latin flex items-baseline whitespace-nowrap">
      <span style={{ fontSize: size, fontWeight: 700, color, lineHeight: 1 }}>ATHAR</span>
      <span
        style={{
          fontSize: size * 0.54,
          fontWeight: 500,
          color: accent,
          marginInlineStart: size * 0.14,
          lineHeight: 1,
        }}
      >
        Moments
      </span>
    </span>
  );
}

/**
 * العلامة كاملة: الرمز، ثم الاسم الكامل باللاتيني، ثم بالعربي تحته.
 *
 * الاسم الكامل «ATHAR Moments» / «آثار مومنتس» هو ما يُكتب في المتجرين
 * وفي كل موضعٍ يعرّف المنتج. و«ATHAR» وحدها تبقى في الرؤوس الضيّقة
 * (`AthrHeaderMark`): شريطٌ علويّ لا يتّسع لاسمٍ من كلمتين، والرمز
 * بجانبها يقول البقيّة.
 */
export function AthrLockup({ size = 44 }: { size?: number }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <AthrMark size={size * 1.5} />
      <div className="flex flex-col items-center gap-1">
        <AthrWordmark size={size * 0.56} color="var(--color-ink)" />
        <span
          className="text-ink-2"
          style={{ fontSize: size * 0.32, letterSpacing: "0.2em", fontWeight: 300 }}
        >
          آثار مومنتس
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
