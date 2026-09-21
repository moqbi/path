"use client";

import Link from "next/link";
import { useActionState } from "react";
import { resetPassword } from "@/app/actions";

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPassword, null);

  const field =
    "rounded-xl border border-line bg-card px-4 text-[13.5px] text-ink outline-none focus:border-clay";

  if (state?.ok) {
    return (
      <div className="mx-auto w-full max-w-sm">
        <p role="status" className="mb-4 rounded-xl bg-card px-4 py-3 text-center text-[12.5px] leading-relaxed text-clay-ink">
          {state.ok}
        </p>
        <Link
          href="/login"
          className="brand-gradient flex items-center justify-center rounded-xl text-[14.5px] font-bold"
          style={{ height: 50, color: "var(--color-on-brand)" }}
        >
          ادخل الآن
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="mx-auto flex w-full max-w-sm flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      <input
        name="next"
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
        placeholder="كلمة المرور الجديدة (٨ أحرف فأكثر)"
        aria-label="كلمة المرور الجديدة"
        className={field}
        style={{ height: 50 }}
      />
      <input
        name="again"
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
        placeholder="اكتبها مرّةً أخرى"
        aria-label="تأكيد كلمة المرور"
        className={field}
        style={{ height: 50 }}
      />

      {state?.error ? (
        <p role="alert" className="text-[12.5px]" style={{ color: "var(--color-live)" }}>
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="brand-gradient rounded-xl text-[14.5px] font-bold disabled:opacity-60"
        style={{ height: 50, color: "var(--color-on-brand)" }}
      >
        {pending ? "نضبط…" : "احفظ كلمة المرور"}
      </button>
    </form>
  );
}
