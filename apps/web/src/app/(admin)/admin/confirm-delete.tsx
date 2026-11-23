"use client";

import { useState, useTransition } from "react";
import { TrashIcon } from "@/components/icons";

/** حذفٌ بضغطتين: الأولى تسأل والثانية تحذف — للردّ والتذكرة (القاعدة ٤٨٠). */
export function ConfirmDelete({
  run,
  label,
  wide = false,
}: {
  run: () => Promise<{ ok?: string; error?: string } | null>;
  label: string;
  /** زرٌّ عريضٌ بنصّه بدل أيقونة. */
  wide?: boolean;
}) {
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
              const res = await run();
              if (res?.error) {
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
      title={error ?? label}
      aria-label={label}
      onClick={() => {
        setError(null);
        setSure(true);
      }}
      className={
        wide
          ? "flex h-[42px] w-full items-center justify-center gap-1.5 rounded-xl border border-line text-[12.5px] font-semibold"
          : `grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line ${error ? "text-live" : "text-muted"}`
      }
      style={wide ? { color: "var(--color-live)" } : undefined}
    >
      <TrashIcon size={wide ? 15 : 15} />
      {wide ? label : null}
    </button>
  );
}
