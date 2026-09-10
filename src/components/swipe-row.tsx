"use client";

import { useRef, useState, useTransition } from "react";
import { CloseIcon } from "@/components/icons";

const REVEAL = 88;

/**
 * صف يكشف زر الحذف بالسحب.
 *
 * السحب بالمؤشر لا باللمس وحده، فيعمل على الجوال والمتصفح معاً. والحركة
 * على `transform` فقط لتبقى على مسار الرسم السريع، وتُتجاهل السحبة إن كانت
 * رأسية أكثر منها أفقية حتى لا تتعارض مع تمرير القائمة.
 */
export function SwipeRow({
  onDelete,
  confirmLabel = "حذف",
  onSecond,
  secondLabel,
  children,
}: {
  onDelete: () => void | Promise<void>;
  confirmLabel?: string;
  /** فعلٌ ثانٍ يظهر بجانب الأول — الحظر مثلاً بجانب الإزالة. */
  onSecond?: () => void | Promise<void>;
  secondLabel?: string;
  children: React.ReactNode;
}) {
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const origin = useRef<{ x: number; y: number } | null>(null);
  const axis = useRef<"none" | "x" | "y">("none");

  const second = onSecond && secondLabel ? { run: onSecond, label: secondLabel } : null;
  const reveal = second ? REVEAL * 2 : REVEAL;

  function fire(run: () => void | Promise<void>) {
    setOpen(false);
    setOffset(0);
    start(() => void run());
  }

  return (
    <div className="relative overflow-hidden" style={{ touchAction: "pan-y" }}>
      <div className="absolute inset-y-0 left-0 flex" style={{ width: reveal }}>
        {second ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => fire(second.run)}
            className="flex grow items-center justify-center px-2 text-[13px] font-bold disabled:opacity-60"
            style={{ background: "var(--color-night)", color: "#f7f5ef" }}
          >
            {second.label}
          </button>
        ) : null}
        <button
          type="button"
          disabled={pending}
          onClick={() => fire(onDelete)}
          className="flex grow items-center justify-center gap-1.5 px-2 text-[13px] font-bold disabled:opacity-60"
          style={{ background: "var(--color-live)", color: "#fff" }}
        >
          <CloseIcon size={16} />
          {confirmLabel}
        </button>
      </div>

      <div
        draggable={false}
        onDragStart={(event) => event.preventDefault()}
        onPointerDown={(event) => {
          // بلا التقاط المؤشر يبتلع سحبُ الرابط الأصلي بقيةَ الأحداث،
          // فلا تصل حركة الإصبع ولا ينزلق الصف.
          event.currentTarget.setPointerCapture(event.pointerId);
          origin.current = { x: event.clientX, y: event.clientY };
          axis.current = "none";
        }}
        onPointerMove={(event) => {
          if (!origin.current) return;
          const dx = event.clientX - origin.current.x;
          const dy = event.clientY - origin.current.y;

          if (axis.current === "none") {
            if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
            axis.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
          }
          if (axis.current !== "x") return;

          // السحب من اليسار إلى اليمين يزيح الصف فتنكشف حافته اليسرى وزرها.
          const base = open ? reveal : 0;
          setOffset(Math.max(0, Math.min(reveal, base + dx)));
        }}
        onPointerUp={() => {
          if (axis.current === "x") {
            const settled = offset > reveal / 2;
            setOpen(settled);
            setOffset(settled ? reveal : 0);
          }
          origin.current = null;
          axis.current = "none";
        }}
        onPointerCancel={() => {
          setOffset(open ? reveal : 0);
          origin.current = null;
          axis.current = "none";
        }}
        style={{
          userSelect: "none",
          WebkitUserSelect: "none",
          transform: `translateX(${offset}px)`,
          transition: origin.current ? "none" : "transform 220ms cubic-bezier(.2,.8,.3,1)",
          background: "var(--color-paper)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
