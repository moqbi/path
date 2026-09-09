"use client";

import { useActionState } from "react";
import type { AdminResult } from "@/app/actions";

/**
 * نموذج في اللوحة يقول ما حدث.
 *
 * قبله كانت أخطاء الفحص تُرمى استثناءات فتطير الشاشة إلى صفحة خطأ عامة —
 * والمشرف لا يعرف أين أخطأ ولا إن كان قد حُفظ شيء. الآن الرسالة تظهر
 * تحت الأزرار، والنجاح يُقال صراحة.
 */
export function Saver({
  action,
  children,
  className,
}: {
  action: (prev: AdminResult, formData: FormData) => Promise<AdminResult>;
  children: React.ReactNode;
  className?: string;
}) {
  const [state, run, pending] = useActionState(action, null);

  return (
    <form action={run} className={className}>
      {children}

      {state?.error ? (
        <p role="alert" className="text-[12.5px] font-medium" style={{ color: "var(--color-live)" }}>
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p role="status" className="text-[12.5px] font-medium text-clay-ink">
          {state.ok} {pending ? "…" : "✓"}
        </p>
      ) : null}
    </form>
  );
}
