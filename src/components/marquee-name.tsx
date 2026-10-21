"use client";

import { useEffect, useRef, useState } from "react";

/**
 * الاسمُ الطويل ينزلق في مكانه ولا يدخل على الأقراص بجانبه (القاعدة ٣٢٢) — نسخةُ
 * `components/marquee-name.tsx` في الجوّال. يُقاس الفائضُ بعد التركيب، فإن زاد
 * الاسمُ على مكانه انزلق ذهاباً وإياباً (`.marquee`)، ومن طلب «قلّل الحركة» يراه
 * مقصوصاً كما كان.
 */
export function MarqueeName({ name, className }: { name: string; className?: string }) {
  const box = useRef<HTMLSpanElement>(null);
  const text = useRef<HTMLSpanElement>(null);
  const [over, setOver] = useState(0);

  useEffect(() => {
    const measure = () => {
      if (!box.current || !text.current) return;
      const extra = text.current.scrollWidth - box.current.clientWidth;
      setOver(extra > 1 ? extra : 0);
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (box.current) observer.observe(box.current);
    return () => observer.disconnect();
  }, [name]);

  return (
    <span ref={box} className={`block min-w-0 overflow-hidden whitespace-nowrap ${className ?? ""}`}>
      <span
        ref={text}
        dir="auto"
        className={over ? "marquee inline-block" : "inline-block"}
        style={over ? ({ "--shift": `${over}px`, "--travel": `${Math.max(1.2, over * 0.028)}s` } as React.CSSProperties) : undefined}
      >
        {name}
      </span>
    </span>
  );
}
