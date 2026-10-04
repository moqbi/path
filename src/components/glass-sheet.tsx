"use client";

import { useEffect, useRef } from "react";
import { Portal } from "@/components/sheet";
import { CloseIcon } from "@/components/icons";

/**
 * النافذةُ الزجاجيّة — نسخةُ `apps/mobile/components/glass-sheet.tsx` (القاعدة ٢٤٧):
 * زجاجٌ صافٍ بلا لونٍ — **بقرار المالك** — طافٍ فوق أسفل الشاشة **بلا حجابٍ خلفه** — **بقرار المالك**، فالصفحةُ
 * تبقى كما هي وراءها. وتُغلق بالضغط خارجها، وبـEsc، وبسحب رأسها إلى أسفل.
 *
 * **والسحبُ من رأسها وحده** لا من جسمها: فيه لوحةُ إيموجي تُمرَّر وحقلُ كتابة.
 * وتُرسم على جسد الصفحة (القاعدة ٩٢)، فـ`.shell-fixed` لا تصلها — عرضُها هنا.
 */
export function GlassSheet({
  title,
  subtitle,
  onClose,
  keep = false,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  /** ما دام فيها ما يضيع (تعليقٌ نصفُ مكتوب) لا تُغلقها ضغطةٌ خارجها. */
  keep?: boolean;
  children: React.ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const holding = useRef(keep);
  holding.current = keep;

  // الضغطُ خارجها وEsc يُغلقانها — بلا حجابٍ يلتقط الضغطة، فالمستمعُ على المستند.
  useEffect(() => {
    const onDown = (event: PointerEvent) => {
      if (box.current?.contains(event.target as Node)) return;
      if (holding.current) return;
      close.current();
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && close.current();
    // بعد الضغطة التي فتحتها لا معها، وإلا أغلقتها في اللحظة نفسها.
    const timer = setTimeout(() => document.addEventListener("pointerdown", onDown), 0);
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  // سحبُ الرأس إلى أسفل: النافذةُ تتبع الإصبع، وما تجاوز ٩٠ يُغلقها.
  useEffect(() => {
    const el = head.current;
    const sheet = box.current;
    if (!el || !sheet) return;
    let startY: number | null = null;
    let dy = 0;
    const paint = (value: number) => {
      sheet.style.transition = value ? "none" : "transform 180ms ease-out";
      sheet.style.transform = `translateX(-50%) translateY(${value}px)`;
    };
    const start = (event: PointerEvent) => {
      if ((event.target as HTMLElement).closest("button")) return;
      startY = event.clientY;
      dy = 0;
      el.setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      if (startY === null) return;
      dy = Math.max(0, event.clientY - startY);
      paint(dy);
    };
    const end = () => {
      if (startY === null) return;
      startY = null;
      if (dy > 90) close.current();
      else paint(0);
    };
    el.addEventListener("pointerdown", start);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    return () => {
      el.removeEventListener("pointerdown", start);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", end);
      el.removeEventListener("pointercancel", end);
    };
  }, []);

  return (
    <Portal>
      <div
        ref={box}
        role="dialog"
        aria-label={title}
        // الضغطُ داخلها لا يصعد إلى رابط اللحظة تحتها (القاعدة ٢٨) — والبوّابةُ
        // تُصعِد أحداث React في شجرة المكوّنات لا في المستند.
        onClick={(event) => event.stopPropagation()}
        className="fixed z-50 overflow-hidden"
        style={{
          left: "50%",
          bottom: 12,
          transform: "translateX(-50%)",
          width: "calc(100% - 20px)",
          maxWidth: 440,
          maxHeight: "78vh",
          display: "flex",
          flexDirection: "column",
          borderRadius: 30,
          border: "1px solid rgba(255,255,255,.6)",
          background: "rgba(255,255,255,.34)",
          backdropFilter: "blur(30px) saturate(1.6)",
          WebkitBackdropFilter: "blur(30px) saturate(1.6)",
          boxShadow: "0 10px 40px rgba(14,26,36,.18)",
          color: "var(--color-ink)",
          animation: "athr-glass-up 260ms cubic-bezier(.2,1.2,.4,1) both",
        }}
      >
        <div ref={head} className="shrink-0 cursor-grab select-none" style={{ touchAction: "none" }}>
          <span
            aria-hidden="true"
            className="mx-auto mt-2.5 block rounded-full"
            style={{ width: 40, height: 4, background: "rgba(14,26,36,.18)" }}
          />
          <div className="flex items-center gap-3 px-[18px] pb-3.5 pt-3">
            <div className="min-w-0 grow">
              <p className="truncate text-[17px] font-bold">{title}</p>
              {subtitle ? (
                <p className="mt-0.5 truncate text-[12px]" style={{ color: "var(--color-muted)" }}>
                  {subtitle}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              aria-label="إغلاق"
              onClick={() => close.current()}
              className="flex shrink-0 items-center justify-center rounded-full"
              style={{ width: 34, height: 34, background: "rgba(14,26,36,.07)" }}
            >
              <CloseIcon size={16} />
            </button>
          </div>
          <div className="mx-[18px] h-px" style={{ background: "rgba(14,26,36,.06)" }} />
        </div>
        <div className="no-bar min-h-0 grow overflow-y-auto">{children}</div>
      </div>
    </Portal>
  );
}
