"use client";

import { useActionState } from "react";
import { changePassword } from "@/app/actions";

/**
 * تغيير كلمة المرور — مطويٌّ كتغيير البريد.
 *
 * القديمةُ شرط، والجديدةُ مرّتين: خطأٌ في حرفٍ واحد يُقفل الحساب على
 * صاحبه، ولا بريدَ في المنظومة بعد يستعيده به.
 */
export function ChangePassword({ hasPassword }: { hasPassword: boolean }) {
  const [state, action, pending] = useActionState(changePassword, null);

  const field =
    "rounded-xl border border-line bg-paper px-4 text-[13.5px] text-ink outline-none focus:border-clay";

  return (
    <details className="rounded-2xl border border-line bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between p-4">
        <span className="text-[13.5px] font-semibold">
          {hasPassword ? "كلمة المرور" : "اضبط كلمة مرور"}
        </span>
        <span className="shrink-0 text-[11.5px] text-clay-ink">
          {hasPassword ? "غيّرها" : "اضبطها"}
        </span>
      </summary>

      <form action={action} className="flex flex-col gap-3 border-t border-line p-4">
        {/* ومن دخل بمزوّدٍ لا قديمةَ له تُطلب: الجلسةُ دليلُه. */}
        {hasPassword ? (
          <input
            name="current"
            type="password"
            required
            autoComplete="current-password"
            placeholder="كلمة المرور الحالية"
            aria-label="كلمة المرور الحالية"
            className={field}
            style={{ height: 48 }}
          />
        ) : null}
        <input
          name="next"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="الجديدة (٨ أحرف فأكثر)"
          aria-label="كلمة المرور الجديدة"
          className={field}
          style={{ height: 48 }}
        />
        <input
          name="again"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="الجديدة مرّةً أخرى"
          aria-label="تأكيد كلمة المرور الجديدة"
          className={field}
          style={{ height: 48 }}
        />

        {state?.error ? (
          <p role="alert" className="text-[12px]" style={{ color: "var(--color-live)" }}>
            {state.error}
          </p>
        ) : null}
        {state?.ok ? (
          <p role="status" className="text-[12px] font-medium text-clay-ink">
            {state.ok}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="rounded-xl text-[14px] font-bold disabled:opacity-60"
          style={{ height: 48, background: "var(--color-clay)", color: "var(--color-on-brand)" }}
        >
          {pending ? "نحفظ…" : hasPassword ? "احفظ كلمة المرور" : "اضبط كلمة المرور"}
        </button>
      </form>
    </details>
  );
}
