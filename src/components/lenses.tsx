import Link from "next/link";
import { HomeIcon, PrivateIcon, SparkIcon, WithIcon } from "@/components/icons";

const ITEMS = [
  { key: "", label: "اللحظات", href: "/", Icon: HomeIcon },
  { key: "private", label: "الخاصة", href: "/?view=private", Icon: PrivateIcon },
  { key: "together", label: "آثارنا", href: "/?view=together", Icon: WithIcon },
] as const;

/**
 * عدساتُ الخطّ الزمنيّ الثلاث — نسخةُ `Lenses` في الجوّال (القاعدة ٢٦١): قرصٌ
 * كهرمانيّ فاتح، والمفتوحةُ على بطاقة. و«آثارنا» لغير المشترك تأخذه إلى صفحته.
 */
export function Lenses({ view, isPlus }: { view: string; isPlus: boolean }) {
  return (
    <nav
      aria-label="العدسات"
      className="flex shrink-0 items-center rounded-full"
      style={{ height: 32, padding: 2, background: "var(--color-gold-soft)" }}
    >
      {ITEMS.map(({ key, label, href, Icon }) => {
        const on = view === key;
        const locked = key === "together" && !isPlus;
        return (
          <Link
            key={key || "all"}
            href={locked ? "/subscribe" : href}
            aria-current={on ? "page" : undefined}
            className="flex items-center gap-1 rounded-full px-[9px] text-[12px] font-bold"
            style={{
              height: 28,
              background: on ? "var(--color-card)" : "transparent",
              color: on ? "var(--color-clay-ink)" : "var(--color-muted)",
            }}
          >
            {locked ? <SparkIcon size={12} /> : <Icon size={13} />}
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
