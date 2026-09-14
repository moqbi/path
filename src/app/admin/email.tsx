"use client";

import { useActionState } from "react";
import { setUserEmail, type AdminResult } from "@/app/actions";

/**
 * تغيير بريد حسابٍ من اللوحة.
 *
 * مطويٌّ تحت كل حساب: الشائع هو منح وسمٍ لا تبديل بريد، فلا يأخذ البارز
 * مكان المعتاد. ولا يُعرض إلا للمالك — والإجراء نفسه يفحص ذلك، فالإخفاء
 * ترتيبٌ للشاشة لا حماية.
 */
export function AdminEmail({ userId, current }: { userId: string; current: string }) {
  const bound = setUserEmail.bind(null, userId);
  const [state, action, pending] = useActionState<AdminResult, FormData>(bound, null);

  return (
    <details className="border-t border-line">
      <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5">
        <span className="text-[11.5px] text-muted">تغيير البريد</span>
        <span className="text-[11.5px] text-clay-ink">افتح</span>
      </summary>

      <form action={action} className="flex flex-col gap-2 px-3 pb-3">
        <div className="flex gap-2">
          <input
            name="email"
            type="email"
            required
            dir="ltr"
            defaultValue={current}
            aria-label="البريد الجديد"
            className="h-10 min-w-0 grow rounded-xl border border-line bg-paper px-3 text-[12px] text-ink outline-none focus:border-clay"
          />
          <button
            type="submit"
            disabled={pending}
            className="h-10 shrink-0 rounded-xl px-3 text-[12px] font-bold disabled:opacity-60"
            style={{ background: "var(--color-clay)", color: "var(--color-on-brand)" }}
          >
            {pending ? "…" : "احفظ"}
          </button>
        </div>

        {state?.error ? (
          <p role="alert" className="text-[11.5px]" style={{ color: "var(--color-live)" }}>
            {state.error}
          </p>
        ) : null}
        {state?.ok ? (
          <p role="status" className="text-[11.5px] font-medium text-clay-ink">
            {state.ok}
          </p>
        ) : null}
      </form>
    </details>
  );
}
