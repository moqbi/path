import Link from "next/link";
import { initial } from "@/lib/format";
import { BackIcon, HomeIcon, CircleIcon, StoreIcon, UserIcon } from "@/components/icons";

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

export function Avatar({
  name,
  size = 40,
  frameSpec,
  mediaId,
  ring = "var(--color-paper)",
}: {
  name: string;
  size?: number;
  frameSpec?: string | null;
  mediaId?: string | null;
  ring?: string;
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
        color: "var(--color-ink)",
        fontSize: size * 0.36,
        border: frameSpec ? `2px solid ${ring}` : "none",
      }}
    >
      {mediaId ? "" : initial(name)}
    </div>
  );

  if (!frameSpec) {
    return (
      <div style={{ width: size, height: size }} className="shrink-0 rounded-full">
        {inner}
      </div>
    );
  }

  // الإطار المشترى يُرسم كحلقة تدرّج حول الصورة بحشوة تتناسب مع الحجم.
  return (
    <div
      className="shrink-0 rounded-full"
      style={{ width: size, height: size, background: frameSpec, padding: Math.max(2, size * 0.045) }}
    >
      {inner}
    </div>
  );
}

/** التدرّج الافتراضي للغلاف حين لا صورة ولا خلفية مشتراة. */
export const DEFAULT_COVER = "linear-gradient(140deg,#f2e6d5,#e8cdb4 45%,#c9a68f)";

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
): React.CSSProperties {
  if (mediaId) {
    return {
      backgroundImage: `url(/api/media/${mediaId})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
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
}: {
  title: string;
  back?: string;
  action?: React.ReactNode;
  display?: boolean;
}) {
  return (
    <header className="chrome flex items-center justify-between px-5 py-3">
      <div className="flex items-center gap-1">
        {back ? (
          <Link
            href={back}
            aria-label="رجوع"
            className="-mr-2 flex h-11 w-11 items-center justify-center"
            style={{ color: "var(--color-chrome-muted)" }}
          >
            <BackIcon size={19} />
          </Link>
        ) : null}
        <h1
          className={display ? "text-[21px]" : "text-[16px] font-semibold"}
          style={display ? { fontFamily: "var(--font-display)" } : undefined}
        >
          {title}
        </h1>
      </div>
      {action}
    </header>
  );
}

const TABS = [
  { href: "/", label: "اللحظات", Icon: HomeIcon },
  { href: "/circle", label: "أصدقائي", Icon: CircleIcon },
  { href: "/store", label: "المتجر", Icon: StoreIcon },
  { href: "/me", label: "أنا", Icon: UserIcon },
];

export function TabBar({ active }: { active: string }) {
  return (
    <nav className="chrome sticky bottom-0 z-10">
      <div className="flex items-stretch justify-around px-2 pb-5 pt-1.5">
        {TABS.map(({ href, label, Icon }) => {
          const on = href === active;
          return (
            <Link
              key={href}
              href={href}
              aria-current={on ? "page" : undefined}
              className="flex min-h-11 flex-1 flex-col items-center justify-center gap-1 rounded-xl py-1.5"
              style={{ color: on ? "var(--color-clay)" : "var(--color-chrome-muted)" }}
            >
              <Icon size={21} />
              <span className="text-[10.5px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="px-8 py-16 text-center">
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      {hint ? <p className="mt-2 text-[12.5px] leading-relaxed text-muted">{hint}</p> : null}
    </div>
  );
}

/**
 * وسم بجانب الاسم بلونَي المشرف. حجمه صغير عمداً: الاسم هو البطل،
 * والوسم صفة عليه لا عنوان فوقه.
 */
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
