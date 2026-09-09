"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CircleIcon, CloseIcon, HomeIcon, LockIcon, StoreIcon, UserIcon, WithIcon } from "@/components/icons";

const TABS = [
  { href: "/", label: "اللحظات", Icon: HomeIcon },
  { href: "/circle", label: "الأصدقاء", Icon: CircleIcon },
  { href: "/store", label: "المتجر", Icon: StoreIcon },
  { href: "/me", label: "أنا", Icon: UserIcon },
];

/** الضغطة المطوّلة: نصف ثانية تقريباً، وأي تحريك للإصبع يلغيها. */
const HOLD_MS = 450;

/**
 * الشريط السفلي، ومعه بابٌ مخفيّ: ضغطةٌ مطوّلة على «اللحظات» تفتح
 * اللحظات الخاصة وآثارنا.
 *
 * مخفيّ عن قصد: هذان مكانان يُقصدان قصداً ولا يُفتحان بالتمرير، ووضعهما
 * تبويبين دائمين يجعل الشريط خمسة أبواب لا يُقرأ.
 */
export function TabBar({ active }: { active: string }) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

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
      {open ? (
        <div
          className="z-30 flex flex-col items-center justify-end"
          style={{
            // العتمة تملأ النافذة، والورقة نفسها بعرض الهيكل في وسطها —
            // فلا تطير إلى حافة الشاشة على المتصفح العريض.
            position: "fixed",
            inset: 0,
            background: "rgba(14,26,36,.55)",
          }}
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full rounded-t-3xl p-4 pb-8"
            style={{ background: "var(--color-card)", maxWidth: 430 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[14.5px] font-bold">لحظاتك الأخرى</p>
              <button
                type="button"
                aria-label="إغلاق"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-muted"
              >
                <CloseIcon size={16} />
              </button>
            </div>

            <Link
              href="/private"
              onClick={() => setOpen(false)}
              className="mb-2 flex items-center gap-3 rounded-2xl border border-line p-3.5"
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                style={{ background: "var(--color-night)", color: "#f7f5ef" }}
              >
                <LockIcon size={18} />
              </span>
              <span className="min-w-0 grow">
                <span className="block text-[14px] font-semibold">اللحظات الخاصة</span>
                <span className="block text-[11.5px] text-muted">
                  ما نُشر لتصنيفٍ من دائرتك أو لأشخاص بأعيانهم
                </span>
              </span>
            </Link>

            <Link
              href="/together"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-2xl border border-line p-3.5"
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                style={{ background: "var(--color-clay)", color: "var(--color-on-brand)" }}
              >
                <WithIcon size={18} />
              </span>
              <span className="min-w-0 grow">
                <span className="block text-[14px] font-semibold">آثارنا</span>
                <span className="block text-[11.5px] text-muted">
                  خطّكما المشترك: كم لحظة تجمعكما منذ صرتما أصدقاء
                </span>
              </span>
            </Link>
          </div>
        </div>
      ) : null}

      <nav className="chrome sticky bottom-0 z-10">
        <div className="flex items-stretch justify-around px-2 pb-5 pt-1.5">
          {TABS.map(({ href, label, Icon }) => {
            const on = href === active;
            const moments = href === "/";
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
                className="flex min-h-11 flex-1 flex-col items-center justify-center gap-1 rounded-xl py-1.5"
                style={{
                  color: on ? "var(--color-clay)" : "var(--color-chrome-muted)",
                  touchAction: "manipulation",
                }}
              >
                <Icon size={21} />
                <span className="text-[10.5px] font-medium">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
