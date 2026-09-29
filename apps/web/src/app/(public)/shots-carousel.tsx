"use client";

import { useEffect, useRef, useState } from "react";
import type { Shot } from "@/lib/site";

/**
 * لقطاتُ «من داخل التطبيق» — شريطٌ يُمرَّر، ومعه سهمان حين لا تتّسع له
 * الشاشة: ثلاثةُ هواتف تتّسع على الحاسوب فلا سهم، وسبعةٌ لا تتّسع فيظهر.
 *
 * والتمريرُ بالإصبع يبقى كما هو (`scroll-snap`)، والسهمان لمن يقرأ بالفأرة.
 * والاتجاه عربيّ: السهمُ الأيمن يعود إلى ما قبل، والأيسر يمضي إلى ما بعد —
 * و`scrollLeft` في الصفحات من اليمين سالبٌ في المتصفّحات الحديثة، فيُقاس
 * بقيمته المطلقة.
 */
export function ShotsCarousel({ shots }: { shots: Shot[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  useEffect(() => {
    const node = track.current;
    if (!node) return;
    const measure = () => {
      const travelled = Math.abs(node.scrollLeft);
      const room = node.scrollWidth - node.clientWidth;
      setEdges({ start: travelled < 4, end: travelled >= room - 4 });
    };
    measure();
    node.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      node.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [shots.length]);

  // خطوةُ سهمٍ واحدة = هاتفٌ واحد وفراغُه.
  const step = (towardEnd: boolean) => {
    const node = track.current;
    if (!node) return;
    const card = node.querySelector("figure");
    const width = (card?.getBoundingClientRect().width ?? 220) + 24;
    // في RTL يمضي الشريطُ إلى ما بعدُ بإزاحةٍ سالبة.
    node.scrollBy({ left: towardEnd ? -width : width, behavior: "smooth" });
  };

  const overflow = !(edges.start && edges.end);

  return (
    <div className="relative mt-10">
      <div
        ref={track}
        className="no-bar flex snap-x snap-mandatory gap-6 overflow-x-auto px-1 pb-4"
        style={{ justifyContent: overflow ? "flex-start" : "center" }}
      >
        {shots.map((shot) => (
          <figure key={shot.id} className="flex shrink-0 snap-center flex-col items-center gap-3">
            <div className="phone phone-shot">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={shot.src} alt={`لقطة من ${shot.label} في آثار مومنتس`} loading="lazy" />
            </div>
            <figcaption className="text-[12.5px] font-bold text-ink-2">{shot.label}</figcaption>
          </figure>
        ))}
      </div>

      {overflow ? (
        <>
          <Arrow side="right" label="السابقة" disabled={edges.start} onClick={() => step(false)} />
          <Arrow side="left" label="التالية" disabled={edges.end} onClick={() => step(true)} />
        </>
      ) : null}
    </div>
  );
}

function Arrow({
  side,
  label,
  disabled,
  onClick,
}: {
  side: "left" | "right";
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="absolute top-[42%] z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-card shadow-md transition-opacity disabled:pointer-events-none disabled:opacity-0"
      style={{ [side]: -4, color: "var(--color-ink)" }}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {side === "right" ? <path d="M9 6l6 6-6 6" /> : <path d="M15 6l-6 6 6 6" />}
      </svg>
    </button>
  );
}
