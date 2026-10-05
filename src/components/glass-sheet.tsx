"use client";

import { useEffect, useRef, useState } from "react";
import { Portal } from "@/components/sheet";
import { CloseIcon } from "@/components/icons";

/**
 * النافذةُ الزجاجيّة — نسخةُ `apps/mobile/components/glass-sheet.tsx` (القاعدة ٢٤٧):
 * زجاجٌ داكن طافٍ فوق أسفل الشاشة **بلا حجابٍ خلفه** — **بقرار المالك**، فالصفحةُ
 * تبقى كما هي وراءها. وتُغلق بالضغط خارجها، وبـEsc، وبسحب رأسها إلى أسفل.
 *
 * **والسحبُ إلى أسفل من أيّ موضعٍ فيها** ما دام جسمُها في أعلاه (وبالفأرة من رأسها).
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
  const body = useRef<HTMLDivElement>(null);
  // العنصرُ في حالةٍ لا في مرجعٍ وحده: البوّابةُ ترسم ما فيها بعد أوّل رسمة، فتأثيرٌ
  // يقرأ المرجعَ ساعتها يجده فارغاً ولا يركّب مستمعاً — وكان السحبُ لا يعمل.
  const [sheetEl, setSheetEl] = useState<HTMLDivElement | null>(null);
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
  // السحبُ إلى أسفل من أيّ موضعٍ فيها — **بقرار المالك**، كالجوّال — ما دام جسمُها
  // في أعلاه: تتبع الإصبع وتصغر وتبهت، وما تجاوز الحدّ أو أُفلت بسرعةٍ يُكمل نزولَه
  // ويُغلقها، وإلّا عادت. والالتقاطُ بعد أن تثبت السحبةُ رأسيّةً، فالنقرُ والكتابةُ لهما.
  useEffect(() => {
    const sheet = sheetEl;
    const scroller = body.current;
    if (!sheet) return;
    let startX = 0;
    let startY: number | null = null;
    let startAt = 0;
    let dy = 0;
    let dragging = false;
    const paint = (value: number, animate: boolean) => {
      const shrink = 1 - Math.min(value, 320) / 4000;
      sheet.style.transition = animate ? "transform 220ms cubic-bezier(.4,0,1,1), opacity 220ms" : "none";
      sheet.style.transform = `translateX(-50%) translateY(${value}px) scale(${shrink})`;
      sheet.style.opacity = String(1 - Math.min(value, 320) / 800);
    };
    const reset = () => {
      sheet.style.transition = "transform 260ms cubic-bezier(.2,1.3,.4,1), opacity 200ms";
      sheet.style.transform = "translateX(-50%)";
      sheet.style.opacity = "1";
    };
    const start = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && !head.current?.contains(event.target as Node)) return;
      if ((event.target as HTMLElement).closest("button, a, input, textarea")) return;
      if (scroller && scroller.scrollTop > 2 && !head.current?.contains(event.target as Node)) return;
      startX = event.clientX;
      startY = event.clientY;
      startAt = event.timeStamp;
      dy = 0;
      dragging = false;
    };
    const move = (event: PointerEvent) => {
      if (startY === null) return;
      const dx = event.clientX - startX;
      dy = event.clientY - startY;
      if (!dragging) {
        if (dy > 8 && dy > Math.abs(dx) * 1.4) {
          dragging = true;
          sheet.setPointerCapture(event.pointerId);
        } else if (Math.abs(dx) > 10 || dy < -8) {
          startY = null;
          return;
        } else return;
      }
      event.preventDefault();
      paint(Math.max(0, dy), false);
    };
    const end = (event: PointerEvent) => {
      if (startY === null) return;
      startY = null;
      if (!dragging) return;
      dragging = false;
      const fast = dy / Math.max(1, event.timeStamp - startAt) > 0.9;
      if (dy > 90 || fast) {
        paint(window.innerHeight, true);
        setTimeout(() => close.current(), 210);
      } else reset();
    };
    // اللمسُ: المتصفّحُ يأخذ السحبة تمريراً ويُلغي `pointer` — فيُمنع ذلك ما دام
    // الجسمُ في أعلاه والإصبعُ ينزل (مستمعٌ أصليّ `passive: false` — القاعدة ١٤).
    let touchY = 0;
    const touchStart = (event: TouchEvent) => {
      touchY = event.touches[0]?.clientY ?? 0;
    };
    const touchMove = (event: TouchEvent) => {
      const down = (event.touches[0]?.clientY ?? 0) - touchY > 0;
      const top = !scroller || scroller.scrollTop <= 2;
      if (dragging || (down && top && startY !== null)) event.preventDefault();
    };
    sheet.addEventListener("touchstart", touchStart, { passive: true });
    sheet.addEventListener("touchmove", touchMove, { passive: false });
    sheet.addEventListener("pointerdown", start);
    sheet.addEventListener("pointermove", move);
    sheet.addEventListener("pointerup", end);
    sheet.addEventListener("pointercancel", end);
    return () => {
      sheet.removeEventListener("touchstart", touchStart);
      sheet.removeEventListener("touchmove", touchMove);
      sheet.removeEventListener("pointerdown", start);
      sheet.removeEventListener("pointermove", move);
      sheet.removeEventListener("pointerup", end);
      sheet.removeEventListener("pointercancel", end);
    };
  }, [sheetEl]);

  return (
    <Portal>
      <div
        ref={(el) => {
          box.current = el;
          setSheetEl(el);
        }}
        role="dialog"
        aria-label={title}
        // الضغطُ داخلها لا يصعد إلى رابط اللحظة تحتها (القاعدة ٢٨) — والبوّابةُ
        // تُصعِد أحداث React في شجرة المكوّنات لا في المستند.
        onClick={(event) => event.stopPropagation()}
        // ومثلُها أحداثُ المؤشّر: كانت تصعد إلى صفّ سحبٍ (`SwipeRow`) فوق البطاقة
        // فيحاول إفلاتَ مؤشّرٍ أمسكته النافذة ويرمي خطأً.
        onPointerDown={(event) => event.stopPropagation()}
        onPointerMove={(event) => event.stopPropagation()}
        onPointerUp={(event) => event.stopPropagation()}
        onPointerCancel={(event) => event.stopPropagation()}
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
          border: "1px solid rgba(255,255,255,.16)",
          background: "rgba(20,24,28,.8)",
          backdropFilter: "blur(28px) saturate(1.4)",
          WebkitBackdropFilter: "blur(28px) saturate(1.4)",
          boxShadow: "0 10px 40px rgba(0,0,0,.38)",
          color: "#fff",
          // `backwards` لا `both`: ما يبقى بعد الحركة يكتب فوق `transform` الذي يرسمه السحب.
          animation: "athr-glass-up 260ms cubic-bezier(.2,1.2,.4,1) backwards",
        }}
      >
        <div ref={head} className="shrink-0 cursor-grab select-none" style={{ touchAction: "none" }}>
          <span
            aria-hidden="true"
            className="mx-auto mt-2.5 block rounded-full"
            style={{ width: 40, height: 4, background: "rgba(255,255,255,.3)" }}
          />
          <div className="flex items-center gap-3 px-[18px] pb-3.5 pt-3">
            <div className="min-w-0 grow">
              <p className="truncate text-[17px] font-bold">{title}</p>
              {subtitle ? (
                <p className="mt-0.5 truncate text-[12px]" style={{ color: "rgba(255,255,255,.62)" }}>
                  {subtitle}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              aria-label="إغلاق"
              onClick={() => close.current()}
              className="flex shrink-0 items-center justify-center rounded-full"
              style={{ width: 34, height: 34, background: "rgba(255,255,255,.12)" }}
            >
              <CloseIcon size={16} />
            </button>
          </div>
          <div className="mx-[18px] h-px" style={{ background: "rgba(255,255,255,.1)" }} />
        </div>
        <div ref={body} className="no-bar min-h-0 grow overflow-y-auto" style={{ overscrollBehavior: "contain" }}>
          {children}
        </div>
      </div>
    </Portal>
  );
}
