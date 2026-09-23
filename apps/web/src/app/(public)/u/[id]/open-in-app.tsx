"use client";

import { useState } from "react";

/**
 * «افتح في التطبيق» — رابطُ التطبيق نفسه (`athar://u/<id>`).
 *
 * ومن لم يُنزّله: المتصفّح لا يعرف `athar://` فيبقى في الصفحة. فإن بقيت
 * الصفحةُ ظاهرةً بعد لحظة — لم ينتقل شيء — يُرسَل إلى المتجر إن كان رابطُه
 * مضبوطاً، وإلّا قيل له إنّ التطبيق لم يُنشر بعد. والتطبيقُ إن فُتح أخفى
 * الصفحةَ (`visibilitychange`) فلا يُفتح المتجرُ فوقه.
 *
 * وهذا بابُ ما بعد «حمّل»: الروابطُ العامّة (`https://…/u/1`) لا تفتح
 * التطبيقَ مباشرةً حتى يُربط النطاق بـUniversal Links — وذاك إعدادٌ في
 * آبل وفي بناء التطبيق، لا في هذه الصفحة.
 */
export function OpenInApp({ userId, store }: { userId: string; store: string | null }) {
  const [said, setSaid] = useState<string | null>(null);

  function open() {
    setSaid(null);
    let left = false;
    const gone = () => {
      if (document.hidden) left = true;
    };
    document.addEventListener("visibilitychange", gone);

    window.location.href = `athar://u/${userId}`;

    window.setTimeout(() => {
      document.removeEventListener("visibilitychange", gone);
      if (left) return;
      if (store) window.location.href = store;
      else setSaid("التطبيق لم يُنشر في المتجر بعد — قريباً.");
    }, 1400);
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={open}
        className="brand-gradient flex h-12 w-full items-center justify-center rounded-2xl text-[14px] font-bold"
        style={{ color: "var(--color-on-brand)" }}
      >
        افتح الملف في التطبيق
      </button>
      {said ? <p className="mt-2 text-center text-[12px] text-muted">{said}</p> : null}
    </div>
  );
}
