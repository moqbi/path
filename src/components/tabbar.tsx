"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  BellIcon,
  CircleIcon,
  HomeIcon,
  LockIcon,
  MessageIcon,
  StoreIcon,
  UserIcon,
  WithIcon,
} from "@/components/icons";
import { Avatar } from "@/components/ui";
import { ar } from "@/lib/format";

/**
 * ستّةُ أبوابٍ كالجوّال (القاعدة ٢٢٨): المحادثاتُ بين الأصدقاء والإشعارات،
 * و«أنا» صورةُ صاحبها.
 */
const TABS = [
  { href: "/", label: "اللحظات", Icon: HomeIcon },
  { href: "/circle", label: "الأصدقاء", Icon: CircleIcon },
  { href: "/messages", label: "المحادثات", Icon: MessageIcon },
  { href: "/notifications", label: "الإشعارات", Icon: BellIcon },
  { href: "/store", label: "المتجر", Icon: StoreIcon },
  { href: "/me", label: "أنا", Icon: UserIcon },
];

const PILL = 62;

/**
 * ما له عمودٌ على سطح المكتب لا يتكرّر في شريط الوسط — **بقرار المالك**
 * (القاعدة ٢٠٠): الأصدقاءُ يميناً، و«أنا» والإشعاراتُ يساراً. وعلى الجوّال
 * والنافذةِ الضيّقة يبقى الشريطُ خمسةً كما كان.
 */
const DESK_ELSEWHERE = new Set(["/circle", "/messages", "/notifications", "/me"]);

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
  unread = 0,
  view = "",
  me = null,
}: {
  active: string;
  news?: number;
  /** ما لم يُقرأ من المحادثات — رقمٌ لا نقطة (القاعدة ١٥١). */
  unread?: number;
  me?: { name: string; avatarMediaId: string | null } | null;
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
        <div className="relative mb-[84px] mr-[14px] h-14 w-[74px]">
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

      {/*
        زجاجٌ عائم — **بقرار المالك** (القاعدة ٢٢٨، كالجوّال): قرصٌ فوق المحتوى
        لا شريطٌ ملتصق، والمحتوى يمرّ تحته مغبّشاً (`.glassbar` يترك له مكانه في
        آخر التمرير). أيقوناتٌ بلا أسماء — الاسمُ لقارئ الشاشة.
      */}
      <nav className="glassbar shell-fixed z-10" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
        <div
          className="pointer-events-auto mx-3 flex items-center justify-around px-1.5"
          style={{
            height: PILL,
            borderRadius: PILL / 2,
            background: "rgba(20,24,28,.48)",
            backdropFilter: "blur(22px) saturate(1.5)",
            WebkitBackdropFilter: "blur(22px) saturate(1.5)",
            border: "1px solid rgba(255,255,255,.14)",
            boxShadow: "0 8px 26px rgba(14,26,36,.28)",
          }}
        >
          {TABS.map(({ href, label: base, Icon }) => {
            const on = href === active;
            const moments = href === "/";
            // تبويب اللحظات يحمل اسم العدسة المفتوحة.
            const label = moments ? lens.label : base;
            const dot = href === "/notifications" && news > 0 && !on;
            const count = href === "/messages" && unread > 0 ? unread : 0;
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                title={label}
                aria-current={on ? "page" : undefined}
                onPointerDown={moments ? hold : undefined}
                onPointerUp={moments ? release : undefined}
                onPointerLeave={moments ? release : undefined}
                onPointerCancel={moments ? release : undefined}
                onContextMenu={moments ? (event) => event.preventDefault() : undefined}
                className={`flex flex-1 items-center justify-center${DESK_ELSEWHERE.has(href) ? " desk-hide" : ""}`}
                style={{ height: PILL - 14, touchAction: "manipulation" }}
              >
                <span
                  className="relative flex items-center justify-center rounded-full transition-colors"
                  style={{
                    width: 46,
                    height: PILL - 16,
                    background: on ? "rgba(255,255,255,.2)" : "transparent",
                    color: on ? "#ffffff" : "rgba(255,255,255,.78)",
                  }}
                >
                  {href === "/me" && me ? (
                    <span className="block rounded-full" style={{ boxShadow: on ? "0 0 0 2px #fff" : "0 0 0 1.5px rgba(255,255,255,.5)" }}>
                      <Avatar name={me.name} mediaId={me.avatarMediaId} size={28} />
                    </span>
                  ) : (
                    <Icon size={23} />
                  )}
                  {count ? (
                    <span
                      className="absolute flex items-center justify-center rounded-full px-1 text-[9.5px] font-bold"
                      style={{ top: 2, right: 4, minWidth: 17, height: 17, background: "var(--color-live)", color: "#fff" }}
                    >
                      {count > 99 ? "+٩٩" : ar(count)}
                    </span>
                  ) : null}
                  {dot ? (
                    <span
                      className="absolute block rounded-full"
                      style={{ bottom: 9, right: 10, width: 8, height: 8, background: "var(--color-live)" }}
                    />
                  ) : null}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
