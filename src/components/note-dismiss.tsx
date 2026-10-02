"use client";

import { useTransition } from "react";
import { clearNotes, dismissNote } from "@/app/actions";

/** «×» على صفّ الإشعار — يحذفه من كل مكان (القاعدة ٢٥ب). */
export function NoteDismiss({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-label="احذف الإشعار"
      disabled={pending}
      onClick={() => start(() => dismissNote(id))}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[16px] text-faint"
      style={{ opacity: pending ? 0.4 : 1 }}
    >
      ×
    </button>
  );
}

/** «احذف الكل» — بسؤالٍ قبله: لا رجعة فيه. */
export function ClearNotes() {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (window.confirm("تحذف كل الإشعارات؟")) start(() => clearNotes());
      }}
      className="rounded-full px-3 py-1.5 text-[12px] font-semibold"
      style={{ color: "var(--color-chrome-ink)", border: "1px solid rgba(255,255,255,.18)", opacity: pending ? 0.5 : 1 }}
    >
      احذف الكل
    </button>
  );
}
