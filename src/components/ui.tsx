import Link from "next/link";
import { initial } from "@/lib/format";
import { SparkIcon } from "@/components/icons";
import { AthrPageMark } from "@/components/brand";
import { BackButton, BackSwipe } from "@/components/nav";

/**
 * خلفية الحرف تُشتق من الاسم لا تُخزَّن، فتبقى ثابتة لكل شخص بلا عمود إضافي
 * ولا رفع صور في النموذج الأولي.
 */
const TINTS = ["#f3e3cd", "#e8ddd0", "#f0e0d6", "#e4e0d4", "#f2e7d9", "#e9dcd2"];

function tintFor(name: string): string {
  let sum = 0;
  for (const ch of name) sum += ch.codePointAt(0) ?? 0;
  return TINTS[sum % TINTS.length];
}

/**
 * التميمة: شعارٌ صغير يجلس أسفل يسار صورة العرض أينما ظهرت الصورة.
 * صورةٌ إن رُفعت، وتدرّجٌ إن لم تُرفع — كبقية أصناف المتجر.
 */
export type Charm = { spec: string; mediaId: string | null } | null | undefined;

/**
 * الإطار الملبوس: صورةٌ إن رُفعت، وتدرّجٌ إن لم تُرفع — كالتميمة وكبقية
 * أصناف المتجر.
 *
 * ويُمرَّر **كاملاً** لا `spec` وحده: كان `Avatar` يقبل `frameSpec`
 * فقط، فصورةُ الإطار المرفوعة تُهمَل بلا خطأٍ يظهر ويُرسم التدرّج
 * مكانها — في المتجر وعلى الوجه معاً. والنوعُ يمنع تكرارها: من يمرّر
 * `spec` وحده لا يُترجَم أصلاً.
 */
export type Frame = { spec: string; mediaId: string | null } | null | undefined;

/**
 * خلفية صنف المتجر: صورته إن رُفعت، وإلا قيمة `spec` كما هي.
 *
 * إمّا المختصر وإمّا المفصّل، لا الاثنان في كائنٍ واحد — خلطهما يجعل React
 * يحذّر ويترك بقايا الخلفية السابقة بعد إعادة الرسم.
 */
export function itemPaint(
  item: { spec: string; mediaId?: string | null },
  fit: "cover" | "contain" = "cover",
) {
  return item.mediaId
    ? {
        backgroundImage: `url(/api/media/${item.mediaId})`,
        backgroundSize: fit,
        backgroundPosition: "center" as const,
        backgroundRepeat: "no-repeat" as const,
      }
    : { background: item.spec };
}

/**
 * كم ينحسر الوجه داخل الإطار المصوَّر.
 *
 * سبعةٌ في المئة من القطر: تكفي ليجلس الإطار على حافّة الصورة فيُقرآن
 * شيئاً واحداً، ولا تُصغّر الوجه حتى يضيع.
 */
const FRAME_INSET = 0.07;

export function Avatar({
  name,
  size = 40,
  frame,
  mediaId,
  charm,
}: {
  name: string;
  size?: number;
  frame?: Frame;
  mediaId?: string | null;
  charm?: Charm;
}) {
  const inner = (
    <div
      className="flex items-center justify-center overflow-hidden rounded-full bg-cover bg-center font-semibold"
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: mediaId ? undefined : tintFor(name),
        backgroundImage: mediaId ? `url(/api/media/${mediaId})` : undefined,
        backgroundSize: mediaId ? "cover" : undefined,
        backgroundPosition: mediaId ? "center" : undefined,
        // الحرف على تدرّج فاتح دائماً، فحبره ثابت لا يتبع الوضع —
        // في الليل كان `--color-ink` أبيض على قرصٍ فاتح فاختفى الحرف.
        color: "#14212b",
        fontSize: size * 0.36,
      }}
    >
      {mediaId ? "" : initial(name)}
    </div>
  );

  // التميمة تُعلَّق على الحاوية لا على الصورة، فلا يقصّها الإطار.
  const badge = charm ? <CharmBadge charm={charm} size={size} /> : null;

  if (!frame) {
    return (
      <div style={{ width: size, height: size }} className="relative shrink-0 rounded-full">
        {inner}
        {badge}
      </div>
    );
  }

  /*
     **الإطار المصوَّر يُرسم فوق الصورة لا تحتها.**

     كان يُدهن خلفيةً للحاوية والصورةُ فوقه بحشوةٍ صغيرة، فلا يُرى منه
     إلا خيطٌ عند الحافة — وزخرفتُه (سعفُ النخيل، حبّاتُ الذهب) تختفي
     خلف الوجه. وإطارٌ نصفُه خلف الصورة ليس إطاراً.

     فصارت صورتُه طبقةً فوق الصورة: الوجه يجلس أصغر قليلاً
     (`FRAME_INSET`) والإطار يعلوه بـ`contain` فيُرى كاملاً بحافّتيه —
     الخارجية والداخلية — كما رُسم.

     والتدرّج يبقى تحتها حلقةً بالحشوة: تدرّجٌ فوق الوجه يحجبه، فهو
     لونٌ مصمت لا رسمٌ بشفافية.
  */
  const painted = Boolean(frame.mediaId);
  const pad = painted ? size * FRAME_INSET : Math.max(2, size * 0.045);

  return (
    <div
      className="relative shrink-0 rounded-full"
      style={{
        width: size,
        height: size,
        ...(painted ? null : itemPaint(frame)),
        padding: pad,
      }}
    >
      {inner}

      {painted ? (
        <span
          aria-hidden="true"
          data-frame="1"
          className="pointer-events-none absolute inset-0 block"
          style={{
            backgroundImage: `url(/api/media/${frame.mediaId})`,
            backgroundSize: "contain",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        />
      ) : null}

      {badge}
    </div>
  );
}

/**
 * حجمُ التميمة نسبةً من قطر الصورة.
 *
 * ونصفُ القطر تقريباً لا ثلثاه: التميمة شعارٌ يتدلّى من الصورة لا
 * قرصٌ يزاحمها. و٠٫٦٨ كانت تُقرأ مقبولةً مع رسمٍ صغيرٍ في وسط لوحته،
 * فإذا رُفعت تميمةٌ يملأ رسمُها لوحتَها — هلالٌ من حافةٍ إلى حافة —
 * خرجت أكبر من الوجه نفسه. والنسبةُ واحدةٌ مهما كان الرسم، فما يُرفع
 * كبيراً يصغر في مكانه.
 */
const CHARM_RATIO = 0.5;

function CharmBadge({ charm, size }: { charm: NonNullable<Charm>; size: number }) {
  /*
   * قرابة ثلثي الصورة، حرّةً بلا إطار: التميمة شعارٌ يتدلّى من حافة
   * الصورة — قصُّها في قرصٍ صغير بحلقةٍ حوله كان يخنقها ويُخفي رسمها،
   * و٠٫٥٢ من قبل بقيت تُقرأ صغيرة بجانب الصورة الأكبر.
   * ولذلك `contain`: الشعار يُرى كاملاً، لا مقصوصاً ليملأ مربّعاً.
   */
  const badge = Math.round(size * CHARM_RATIO);
  if (badge < 12) return null;

  const paint = charm.mediaId
    ? {
        backgroundImage: `url(/api/media/${charm.mediaId})`,
        backgroundSize: "contain" as const,
        backgroundPosition: "center" as const,
        backgroundRepeat: "no-repeat" as const,
      }
    : { background: charm.spec };

  return (
    <span
      aria-hidden="true"
      data-charm="1"
      className="pointer-events-none absolute"
      style={{
        width: badge,
        height: badge,
        // مركزها على حافة الدائرة تماماً: نصفها داخل الصورة ونصفها خارجها.
        bottom: -badge * 0.26,
        left: -badge * 0.26,
        // ظلٌّ خفيف يفصلها عن الصورة تحتها بلا حلقةٍ تحيط بها.
        filter: "drop-shadow(0 2px 4px rgba(14,26,36,.35))",
        ...paint,
      }}
    />
  );
}

/** التدرّج الافتراضي للغلاف حين لا صورة ولا خلفية مشتراة. */
export const DEFAULT_COVER = "linear-gradient(140deg,#f2e6d5,#e8cdb4 45%,#c9a68f)";

/**
 * طبقة الغلاف: صورته وحدها.
 *
 * كان تحته قناعُ ذوبانٍ ودرعٌ داكن يعمّ ارتفاعه — والاثنان يُقرآن على
 * غلافٍ فاتح لطخةً رماديةً أسفل الصورة، لا ذوباناً. أُلغيا بطلب
 * المالك، فالغلاف ينتهي بحافّةٍ نظيفة.
 *
 * وما يُكتب فوقه يحمل ظلّه بنفسه (`textShadow` في رأس الخط الزمني):
 * إعتامُ الغلاف كلّه ليُقرأ سطران فوقه ثمنٌ تدفعه الصورة كلّها.
 *
 * وتُستعمل في الخط الزمني والملف الشخصي وملف الصديق بلا اختلاف —
 * فالغلاف يُرى واحداً في كل مكان.
 */
export function CoverLayer({
  mediaId,
  spec,
  y = 50,
}: {
  mediaId: string | null | undefined;
  spec: string | null | undefined;
  y?: number;
}) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 block"
      style={coverStyle(mediaId, spec, y)}
    />
  );
}

/**
 * خلفية الغلاف في مكان واحد.
 *
 * كلها `background-image` وحدها بلا اختصار `background`: خلط الاختصار مع
 * `background-size` يجعل React يحذف أحدهما عند إعادة الرسم — وهو الطريق
 * الذي يختفي به الغلاف بلا خطأ يظهر.
 */
export function coverStyle(
  mediaId: string | null | undefined,
  spec: string | null | undefined,
  /** موضع الصورة عمودياً (٪) — يضبطه صاحب الحساب بسحب الغلاف. */
  y: number = 50,
): React.CSSProperties {
  if (mediaId) {
    return {
      backgroundImage: `url(/api/media/${mediaId})`,
      backgroundSize: "cover",
      backgroundPosition: `center ${Math.min(100, Math.max(0, y))}%`,
    };
  }

  const value = (spec ?? DEFAULT_COVER).trim();
  // لونٌ مصمت لا يصلح صورةً — يوضع لوناً وإلا لم يُرسم شيء.
  return /^(linear|radial|conic|repeating-linear|repeating-conic|repeating-radial)-gradient\(|^url\(/.test(value)
    ? { backgroundImage: value, backgroundSize: "cover", backgroundPosition: "center" }
    : { backgroundColor: value };
}

export function ScreenHeader({
  title,
  back,
  action,
  display = false,
  mark = false,
}: {
  title: string;
  back?: string;
  action?: React.ReactNode;
  display?: boolean;
  /** العلامة بدل الاسم العاري: الرمز، ثم فاصل، ثم اسم الشاشة. */
  mark?: boolean;
}) {
  return (
    <header className="chrome flex items-center justify-between px-5 pb-3 pt-4">
      {/*
        السحب من الحافة يرجع في كل شاشةٍ لها رجوع — والزرّ يرجع إلى ما
        جاء منه المستخدم فعلاً لا إلى وجهةٍ مكتوبة هنا.
      */}
      <BackSwipe href={back} />
      <div className="flex items-center gap-1">
        {back ? <BackButton href={back} /> : null}
        {mark ? (
          <AthrPageMark label={title} />
        ) : (
          <h1
            className={display ? "text-[23px]" : "text-[18px] font-semibold"}
            style={display ? { fontFamily: "var(--font-display)" } : undefined}
          >
            {title}
          </h1>
        )}
      </div>
      {action}
    </header>
  );
}

/**
 * الحالة الفارغة: عنوان وسطر يشرح، ومعهما فعلٌ واحد حين يوجد.
 * شاشةٌ فارغة بلا مخرج تُقرأ كعطل، لا كبداية.
 */
export function Empty({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="px-8 py-14 text-center">
      <span
        className="mx-auto mb-4 block h-12 w-12 rounded-full"
        style={{ background: "var(--color-chip)" }}
      />
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      {hint ? <p className="mt-2 text-[12.5px] leading-relaxed text-muted">{hint}</p> : null}
      {action ? (
        <Link
          href={action.href}
          className="mt-4 inline-flex items-center justify-center rounded-xl px-5 text-[13.5px] font-bold"
          style={{ height: 44, background: "var(--color-clay)", color: "var(--color-on-brand)" }}
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}

/**
 * وسم بجانب الاسم بلونَي المشرف. حجمه صغير عمداً: الاسم هو البطل،
 * والوسم صفة عليه لا عنوان فوقه.
 */
/**
 * ما يلي الاسم: نجمةُ المشترك ثم وسمه الممنوح.
 *
 * الاشتراك كان وسماً نصّياً يُمنح تلقائياً («داعم»)، فصار نجمةً: أصغر،
 * ولا يزاحم وسماً حقيقياً منحه المشرف، ولا يحتاج ترجمةً حين يكون الاسم
 * لاتينياً. والوسم الممنوح يبقى كما هو بجانبها.
 */
export function NameTag({
  isPlus,
  tag,
  size = 11,
}: {
  isPlus?: boolean;
  tag?: { name: string; bg: string; fg: string } | null;
  size?: number;
}) {
  if (!isPlus && !tag) return null;
  return (
    <>
      {isPlus ? (
        <span className="shrink-0 text-gold" aria-label="مشترك في آثار+" title="مشترك في آثار+">
          <SparkIcon size={Math.round(size * 1.25)} />
        </span>
      ) : null}
      <TagPill tag={tag ?? null} size={size} />
    </>
  );
}

export function TagPill({
  tag,
  size = 11,
}: {
  tag: { name: string; bg: string; fg: string } | null;
  size?: number;
}) {
  if (!tag) return null;
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full font-bold"
      style={{
        background: tag.bg,
        color: tag.fg,
        fontSize: size,
        lineHeight: 1,
        padding: `${Math.round(size * 0.35)}px ${Math.round(size * 0.66)}px`,
      }}
    >
      {tag.name}
    </span>
  );
}
