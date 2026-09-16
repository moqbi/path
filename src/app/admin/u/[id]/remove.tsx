"use client";

import { useActionState, useState } from "react";
import { removeMomentAsAdmin, type AdminResult } from "@/app/actions";

/**
 * حذفُ لحظةٍ من اللوحة: سؤالٌ ثم حذف (القاعدة ٦١).
 *
 * والسؤال هنا لا في `confirm()` النظام: نافذةُ المتصفّح تخرج بلغة الجهاز
 * وبخطّه، وتبدو في لوحةٍ عربية كأنها من تطبيقٍ آخر. وزرّان ظاهران أصدق.
 *
 * والإجراء يردّ رسالةً ولا يرمي (القاعدة ٩٠): الرمي من زرٍّ يُسقط الشاشة
 * كلّها، فيرى المشرف فشلاً بلا سبب — أو لا يرى شيئاً.
 */
export function RemoveMoment({ momentId }: { momentId: string }) {
  const [asking, setAsking] = useState(false);
  const [state, run, pending] = useActionState<AdminResult, FormData>(
    removeMomentAsAdmin.bind(null, momentId),
    null,
  );

  if (state?.ok) {
    return <span className="text-[11.5px] font-semibold text-clay-ink">{state.ok} ✓</span>;
  }

  if (!asking) {
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        className="h-9 shrink-0 rounded-xl border px-3 text-[11.5px] font-bold"
        style={{ borderColor: "var(--color-live)", color: "var(--color-live)" }}
      >
        احذفها
      </button>
    );
  }

  return (
    <form action={run} className="flex shrink-0 items-center gap-2">
      {state?.error ? (
        <span role="alert" className="text-[11.5px]" style={{ color: "var(--color-live)" }}>
          {state.error}
        </span>
      ) : null}
      <button
        type="button"
        onClick={() => setAsking(false)}
        className="h-9 rounded-xl border border-line px-3 text-[11.5px] font-semibold text-muted"
      >
        تراجع
      </button>
      <button
        type="submit"
        disabled={pending}
        className="h-9 rounded-xl px-3 text-[11.5px] font-bold"
        style={{ background: "var(--color-live)", color: "#fff" }}
      >
        {pending ? "…" : "أكّد الحذف"}
      </button>
    </form>
  );
}
