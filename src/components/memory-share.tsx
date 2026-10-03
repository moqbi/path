"use client";

import { useState, useTransition } from "react";
import { dismissMemories, shareMemoryAction, shareRecapAction } from "@/app/actions";
import { CloseIcon, ShareIcon } from "@/components/icons";

/**
 * «شاركها» على الويب: لدائرتك (أو تصنيف «من يرى لحظاتي») — نسخةٌ باسمك في
 * خطّك (القاعدة ٢٣٥). واختيارُ أشخاصٍ بأعيانهم من التطبيق.
 */
export function ShareMemory({ momentId }: { momentId: string }) {
  const [state, setState] = useState<"idle" | "done" | string>("idle");
  const [pending, start] = useTransition();
  if (state === "done") return <span className="shrink-0 text-[11.5px] font-semibold text-gold-ink">نُشرت</span>;
  return (
    <button
      type="button"
      aria-label="شاركها مع دائرتك"
      title={state !== "idle" ? state : "شاركها مع دائرتك"}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await shareMemoryAction(momentId);
          setState(result.ok ? "done" : (result.error ?? "تعذّرت المشاركة"));
        })
      }
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-paper text-ink-2"
      style={{ opacity: pending ? 0.5 : 1 }}
    >
      <ShareIcon size={16} />
    </button>
  );
}

export function ShareRecap({ year }: { year: number }) {
  const [state, setState] = useState<"idle" | "done" | string>("idle");
  const [pending, start] = useTransition();
  if (state === "done") return <p className="text-[14px] font-bold" style={{ color: "#F6B93B" }}>نُشر في خطّك</p>;
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await shareRecapAction(year);
            setState(result.ok ? "done" : (result.error ?? "تعذّرت المشاركة"));
          })
        }
        className="h-12 w-full rounded-2xl text-[15px] font-extrabold"
        style={{ background: "#F6B93B", color: "var(--color-night)", opacity: pending ? 0.6 : 1 }}
      >
        شارك آثرك مع دائرتك
      </button>
      {state !== "idle" ? <p className="mt-2 text-[12px]" style={{ color: "#FF7A5A" }}>{state}</p> : null}
    </div>
  );
}

export function DismissMemories() {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-label="إخفاء لليوم"
      disabled={pending}
      onClick={() => start(() => dismissMemories())}
      className="p-1 text-muted"
    >
      <CloseIcon size={14} />
    </button>
  );
}
