"use client";

import { useEffect, useState } from "react";
import { ar } from "@/lib/format";

/** رقمٌ يعدّ من الصفر إلى قيمته — ومن طلب «قلّل الحركة» يراه في الحال (القاعدة ٣٦). */
function CountUp({ to }: { to: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (to === 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setN(to);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / 900);
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <>{ar(n)}</>;
}

/**
 * الإحصاءاتُ سطرٌ يُقرأ جملةً لا أربعةُ أعمدة — نسخةُ `StatLine` في الجوّال
 * (القاعدة ٢٩٣): الرقمُ ثقيلٌ والكلمةُ بعده باهتة، والهديتان رقمان والصفرُ منهما لا يُكتب.
 */
export function StatLine({ moments, friends, sent, got }: { moments: number; friends: number; sent: number; got: number }) {
  const item = (to: number, label: string) => (
    <span className="text-[13px] text-ground-muted">
      <span className="text-[15px] font-extrabold text-ground-ink">
        <CountUp to={to} />
      </span>{" "}
      {label}
    </span>
  );
  return (
    <div className="mt-2.5 flex flex-wrap gap-x-3.5 gap-y-0.5">
      {item(moments, "لحظة")}
      {item(friends, "صديق")}
      {sent ? item(sent, "أهديت") : null}
      {got ? item(got, "أُهدي لك") : null}
    </div>
  );
}
