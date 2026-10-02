"use client";

import { useEffect, useState } from "react";

const KEY = "athr.desk.side";

/**
 * «أنا» والإشعارات في عمودٍ واحد يتبادلان — **بقرار المالك**.
 *
 * الوجهان يُرسمان على الخادم معاً ويُخفى أحدهما هنا، فالتبديلُ لحظيّ بلا
 * طلب. والاختيارُ يُحفظ للمتصفّح وحده: من ترك الإشعارات مفتوحةً يجدها كذلك
 * في الصفحة التالية — والحفظُ زينةٌ لا شرط، فمخزنٌ مغلق لا يُسقط شيئاً.
 */
export function PanelTabs({
  me,
  notes,
  badge,
}: {
  me: React.ReactNode;
  notes: React.ReactNode;
  badge: string | null;
}) {
  const [tab, setTab] = useState<"me" | "notes">("me");

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) === "notes") setTab("notes");
    } catch {}
  }, []);

  function pick(next: "me" | "notes") {
    setTab(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {}
  }

  return (
    <>
      <div role="tablist" className="desk-tabs">
        {(
          [
            ["me", "أنا", null],
            ["notes", "الإشعارات", badge],
          ] as const
        ).map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => pick(key)}
            className="desk-tab"
          >
            {label}
            {count ? <span className="desk-tab-badge">{count}</span> : null}
          </button>
        ))}
      </div>
      <div className="desk-panel-body" hidden={tab !== "me"}>
        {me}
      </div>
      <div className="desk-panel-body" hidden={tab !== "notes"}>
        {notes}
      </div>
    </>
  );
}
