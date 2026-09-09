"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** المسافة التي يكتمل عندها الانكماش: نزولٌ قصير يكفي. */
const RANGE = 120;

/**
 * رأس الملف الشخصي ينكمش مع التمرير.
 *
 * النبذة والإحصاءات تُطوى أولاً — هي التي تُقرأ مرة وتُعرف — وتبقى
 * الصورة والاسم وزرّ التعديل. القيم تتبع الإصبع بلا انتقال زمني: انتقالٌ
 * على قيمةٍ متغيّرة مع كل بكسل يجعل الحركة تلاحق نفسها فتُحسّ مطّاطية.
 *
 * الارتفاع الطبيعي يُقاس مرة بعد التركيب، فالطيّ يعرف من أين يبدأ.
 */
export function ProfileShell({
  cover,
  avatar,
  identity,
  fold,
  actions,
  children,
}: {
  cover: ReactNode;
  avatar: ReactNode;
  identity: ReactNode;
  /** ما يُطوى: النبذة والسطر التعريفي والإحصاءات. */
  fold: ReactNode;
  actions: ReactNode;
  children: ReactNode;
}) {
  const scroll = useRef<HTMLElement>(null);
  const foldRef = useRef<HTMLDivElement>(null);
  const [natural, setNatural] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);

  useLayoutEffect(() => {
    if (foldRef.current) setNatural(foldRef.current.scrollHeight);
  }, []);

  useEffect(() => {
    const el = scroll.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setProgress(Math.min(1, Math.max(0, el.scrollTop / RANGE)));
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const shrink = 1 - progress;

  return (
    <>
      <div className="shrink-0">
        {cover}

        <div className="relative px-5" style={{ marginTop: -52 }}>
          <div
            className="mb-2 flex justify-center"
            style={{
              transform: `scale(${0.7 + shrink * 0.3})`,
              transformOrigin: "center top",
              marginBottom: 8 - progress * 14,
            }}
          >
            {avatar}
          </div>

          {identity}

          <div
            ref={foldRef}
            aria-hidden={progress > 0.9}
            style={{
              overflow: "hidden",
              maxHeight: natural === null ? undefined : natural * shrink,
              opacity: Math.max(0, shrink * 1.6 - 0.6),
              transform: `translateY(${-progress * 8}px)`,
            }}
          >
            {fold}
          </div>

          <div style={{ marginTop: 8 }}>{actions}</div>
        </div>
      </div>

      <main
        ref={scroll}
        className="scroll-area relative px-5 pt-4"
        style={{ borderTop: "1px solid var(--color-line)" }}
      >
        {children}
      </main>
    </>
  );
}
