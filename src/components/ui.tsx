import Link from "next/link";
import { initial } from "@/lib/format";
import { BackIcon, HomeIcon, CircleIcon, StoreIcon, UserIcon } from "@/components/icons";

/**
 * خلفية الحرف تُشتق من الاسم لا تُخزَّن، فتبقى ثابتة لكل شخص بلا عمود إضافي
 * ولا رفع صور في النموذج الأولي.
 */
const TINTS = ["#2f3d55", "#3a3350", "#33455a", "#3d3746", "#2b4250", "#413a4c"];

function tintFor(name: string): string {
  let sum = 0;
  for (const ch of name) sum += ch.codePointAt(0) ?? 0;
  return TINTS[sum % TINTS.length];
}

export function Avatar({
  name,
  size = 40,
  frameSpec,
  ring = "var(--color-paper)",
}: {
  name: string;
  size?: number;
  frameSpec?: string | null;
  ring?: string;
}) {
  const inner = (
    <div
      className="flex items-center justify-center rounded-full font-semibold"
      style={{
        width: "100%",
        height: "100%",
        background: tintFor(name),
        color: "var(--color-ink)",
        fontSize: size * 0.36,
        border: frameSpec ? `2px solid ${ring}` : "none",
      }}
    >
      {initial(name)}
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
    <header className="flex items-center justify-between border-b border-line px-5 py-3">
      <div className="flex items-center gap-1">
        {back ? (
          <Link
            href={back}
            aria-label="رجوع"
            className="-mr-2 flex h-11 w-11 items-center justify-center text-muted"
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
  { href: "/circle", label: "الدائرة", Icon: CircleIcon },
  { href: "/store", label: "المتجر", Icon: StoreIcon },
  { href: "/me", label: "أنا", Icon: UserIcon },
];

export function TabBar({ active }: { active: string }) {
  return (
    <nav className="sticky bottom-0 z-10 border-t border-line bg-paper">
      <div className="flex items-stretch justify-around px-2 pb-5 pt-1.5">
        {TABS.map(({ href, label, Icon }) => {
          const on = href === active;
          return (
            <Link
              key={href}
              href={href}
              aria-current={on ? "page" : undefined}
              className="flex min-h-11 flex-1 flex-col items-center justify-center gap-1 rounded-xl py-1.5"
              style={{ color: on ? "var(--color-clay)" : "var(--color-faint)" }}
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
