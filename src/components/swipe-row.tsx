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
  children,
}: {
  onDelete: () => void | Promise<void>;
  confirmLabel?: string;
  children: React.ReactNode;
}) {
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const origin = useRef<{ x: number; y: number } | null>(null);
  const axis = useRef<"none" | "x" | "y">("none");

  return (
    <div className="relative overflow-hidden" style={{ touchAction: "pan-y" }}>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setOpen(false);
          setOffset(0);
          start(() => void onDelete());
        }}
        className="absolute inset-y-0 left-0 flex items-center justify-center gap-1.5 px-4 text-[13px] font-bold disabled:opacity-60"
        style={{ width: REVEAL, background: "var(--color-live)", color: "#fff" }}
      >
        <CloseIcon size={16} />
        {confirmLabel}
      </button>

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
          const base = open ? REVEAL : 0;
          setOffset(Math.max(0, Math.min(REVEAL, base + dx)));
        }}
        onPointerUp={() => {
          if (axis.current === "x") {
            const settled = offset > REVEAL / 2;
            setOpen(settled);
            setOffset(settled ? REVEAL : 0);
          }
          origin.current = null;
          axis.current = "none";
        }}
        onPointerCancel={() => {
          setOffset(open ? REVEAL : 0);
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
