"use client";

import { useState, useTransition } from "react";
import { deleteBroadcast } from "@/app/actions";
import { TrashIcon } from "@/components/icons";

/** حذفُ تنبيهٍ من القائمة (القاعدة ٣٩٠): ضغطةٌ تسأل، والثانيةُ تحذف. */
export function BroadcastDelete({ id }: { id: string }) {
  const [sure, setSure] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (sure) {
    return (
      <span className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await deleteBroadcast(id);
              if (res.error) {
                setError(res.error);
                setSure(false);
              }
            })
          }
          className="h-8 rounded-lg px-3 text-[12px] font-bold text-white disabled:opacity-60"
          style={{ background: "var(--color-live)" }}
        >
          {pending ? "يُحذف…" : "احذف"}
        </button>
        <button type="button" onClick={() => setSure(false)} className="h-8 px-1.5 text-[12px] font-semibold text-muted">
          تراجع
        </button>
      </span>
    );
  }
  return (
    <button
      type="button"
      title={error ?? "حذف التنبيه"}
      aria-label="حذف التنبيه"
      onClick={() => {
        setError(null);
        setSure(true);
      }}
      className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line ${error ? "text-live" : "text-muted"}`}
    >
      <TrashIcon size={16} />
    </button>
  );
}
