"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  BellIcon,
  CircleIcon,
  HomeIcon,
  LockIcon,
  StoreIcon,
  UserIcon,
  WithIcon,
} from "@/components/icons";

const TABS = [
  { href: "/", label: "اللحظات", Icon: HomeIcon },
  { href: "/circle", label: "الأصدقاء", Icon: CircleIcon },
  { href: "/notifications", label: "الإشعارات", Icon: BellIcon },
  { href: "/store", label: "المتجر", Icon: StoreIcon },
  { href: "/me", label: "أنا", Icon: UserIcon },
];

/** الضغطة المطوّلة: نصف ثانية تقريباً، وأي تحريك للإصبع يلغيها. */
const HOLD_MS = 450;

/**
 * عدسات الخط الزمني الثلاث.
 *
 * الضغطة المطوّلة تعرض ما عدا العدسة التي أنت فيها — عرضُ ما أنت فيه
 * خيارٌ لا يفعل شيئاً. واسم التبويب يقول أين أنت، فلا حاجة لشرائح تحت
 * الغلاف.
 */
const LENSES = [
  { key: "", href: "/", label: "اللحظات", Icon: HomeIcon, bg: "var(--color-night)", ink: "#f7f5ef" },
  {
    key: "private",
    href: "/?view=private",
    label: "اللحظات الخاصة",
    Icon: LockIcon,
    bg: "var(--color-night)",
    ink: "#f7f5ef",
  },
  {
    key: "together",
    href: "/?view=together",
    label: "آثارنا",
    Icon: WithIcon,
    bg: "var(--color-clay)",
    ink: "var(--color-on-brand)",
  },
];

/**
 * الشريط السفلي، ومعه بابٌ مخفيّ: ضغطةٌ مطوّلة على «اللحظات» تُطيّر
 * اللحظات الخاصة وآثارنا من فوق التبويب نفسه — بحركة قوس النشر ذاتها،
 * فالبابان المخفيّان يتصرّفان كما تتصرّف بقية أزرار التطبيق.
 */
export function TabBarNav({
  active,
  news = 0,
  view = "",
}: {
  active: string;
  news?: number;
  /** العدسة المفتوحة في الخط الزمني: "" أو "private" أو "together". */
  view?: string;
}) {
  const lens = LENSES.find((item) => item.key === view) ?? LENSES[0];
  const hidden = LENSES.filter((item) => item.key !== lens.key);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function hold() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), HOLD_MS);
  }
  function release() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }

  return (
    <>
      <div
        onClick={() => setOpen(false)}
        aria-hidden={!open}
        className="fixed inset-0 z-20 transition-opacity duration-300"
        style={{
          background: "rgba(14,26,36,.82)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
        }}
      />

      {/* الأصناف تنطلق من فوق تبويب «اللحظات» في الطرف الأيمن. */}
      <div className="shell-fixed z-30">
        <div className="relative mb-[62px] mr-[6px] h-14 w-[74px]">
          {hidden.map((item, index) => (
            <Link
              key={item.href}
              href={item.href}
              tabIndex={open ? 0 : -1}
              aria-hidden={!open}
              onClick={() => setOpen(false)}
              className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center rounded-2xl"
              style={{
                background: "var(--color-card)",
                border: "1px solid var(--color-line)",
                color: "var(--color-ink)",
                width: 92,
                height: 74,
                insetInlineStart: "-9px",
                transform: open
                  ? `translateY(${-96 - index * 88}px) scale(1)`
                  : "translateY(0) scale(.4)",
                opacity: open ? 1 : 0,
                pointerEvents: open ? "auto" : "none",
                transitionProperty: "transform, opacity",
                transitionDuration: open ? "420ms" : "200ms",
                transitionTimingFunction: open
                  ? "cubic-bezier(.18,1.3,.42,1)"
                  : "cubic-bezier(.4,0,1,1)",
                transitionDelay: `${open ? index * 60 : (hidden.length - 1 - index) * 30}ms`,
                boxShadow: "0 10px 26px rgba(0,0,0,.4)",
              }}
            >
              <span
                className="mb-1 flex h-8 w-8 items-center justify-center rounded-full"
                style={{ background: item.bg, color: item.ink }}
              >
                <item.Icon size={16} />
              </span>
              <span className="text-[9.5px] font-semibold">{item.label}</span>
            </Link>
          ))}
        </div>
      </div>

      <nav className="tabbar sticky bottom-0 z-10">
        <div className="flex items-stretch justify-around px-1.5 pb-1.5 pt-1">
          {TABS.map(({ href, label: base, Icon }) => {
            const on = href === active;
            const moments = href === "/";
            // تبويب اللحظات يحمل اسم العدسة المفتوحة.
            const label = moments ? lens.label : base;
            const dot = href === "/notifications" && news > 0 && !on;
            return (
              <Link
                key={href}
                href={href}
                aria-current={on ? "page" : undefined}
                onPointerDown={moments ? hold : undefined}
                onPointerUp={moments ? release : undefined}
                onPointerLeave={moments ? release : undefined}
                onPointerCancel={moments ? release : undefined}
                onContextMenu={moments ? (event) => event.preventDefault() : undefined}
                className="flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 py-1"
                style={{
                  color: on ? "var(--color-clay-ink)" : "var(--color-muted)",
                  touchAction: "manipulation",
                }}
              >
                <span className="relative">
                  <Icon size={19} />
                  {dot ? (
                    <span
                      className="absolute -left-1 -top-0.5 block h-1.5 w-1.5 rounded-full"
                      style={{ background: "var(--color-clay)" }}
                    />
                  ) : null}
                </span>
                <span className="text-[9.5px] font-medium">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
