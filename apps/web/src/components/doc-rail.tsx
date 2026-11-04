"use client";

import { useEffect, useRef, useState } from "react";
import { ar } from "@/lib/format";

/**
 * فهرسٌ جانبيّ يتبع القراءة في الخصوصية والشروط (القاعدة ٤٢٠): ثابتٌ في جهة
 * البداية بجانب عمود النصّ، يضيء القسمَ الذي تحت العين، ومعه دائرةٌ تقول كم بقي
 * ووقتُ القراءة، والضغطُ ينقل. كان الفهرسُ شرائحَ في أعلى الصفحة تختفي بأوّل
 * نزول، والصفحةُ قرابة خمسة آلاف بكسل.
 *
 * **للكمبيوتر وحده** (`.doc-rail`، من ١٢٤٠): على ما دونه لا مكانَ بجانب العمود،
 * فتبقى الشرائحُ في الأعلى كما كانت. ويبهت حين يصل الذيل — ثابتٌ فوق الذيل
 * الداكن يُقرأ لصقاً عليه.
 */
export function DocRail({ sections }: { sections: { id: string; title: string }[] }) {
  const [at, setAt] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [hidden, setHidden] = useState(false);
  const ring = useRef<SVGCircleElement>(null);

  useEffect(() => {
    // وقتُ القراءة من نصّ الصفحة نفسه: مئتا كلمةٍ في الدقيقة.
    const words = (document.querySelector("main")?.textContent ?? "").split(/\s+/).filter(Boolean).length;
    setMinutes(Math.max(1, Math.round(words / 200)));

    let frame = 0;
    const read = () => {
      frame = 0;
      let current = 0;
      sections.forEach((section, i) => {
        const el = document.getElementById(section.id);
        if (el && el.getBoundingClientRect().top < window.innerHeight * 0.35) current = i;
      });
      setAt(current);
      const room = document.documentElement.scrollHeight - window.innerHeight;
      const done = room > 0 ? Math.min(1, window.scrollY / room) : 0;
      if (ring.current) ring.current.style.strokeDashoffset = String(113 * (1 - done));
      const foot = document.querySelector(".site-foot");
      setHidden(!!foot && foot.getBoundingClientRect().top < window.innerHeight - 40);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [sections]);

  return (
    <aside className={hidden ? "doc-rail doc-rail-away" : "doc-rail"} aria-label="أقسام الصفحة">
      <span className="text-[13px] font-bold text-ink" style={{ fontFamily: "var(--font-display)" }}>
        في هذه الصفحة
      </span>
      <nav className="mt-3 flex flex-col gap-0.5">
        {sections.map((section, i) => (
          <a key={section.id} href={`#${section.id}`} className={i === at ? "on" : ""} aria-current={i === at ? "location" : undefined}>
            <i aria-hidden />
            {ar(i + 1)}. {section.title}
          </a>
        ))}
      </nav>
      <div className="mt-4 flex items-center gap-3">
        <svg viewBox="0 0 44 44" width="40" height="40" aria-hidden>
          <circle cx="22" cy="22" r="18" fill="none" stroke="var(--color-line)" strokeWidth="4" />
          <circle
            ref={ring}
            cx="22"
            cy="22"
            r="18"
            fill="none"
            stroke="var(--color-gold)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="113"
            strokeDashoffset="113"
            transform="rotate(-90 22 22)"
          />
        </svg>
        {minutes ? <span className="text-[12px] text-muted">قراءة {ar(minutes)} {minutes > 2 && minutes < 11 ? "دقائق" : "دقيقة"}</span> : null}
      </div>
    </aside>
  );
}
