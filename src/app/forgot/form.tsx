"use client";

import { useActionState } from "react";
import { requestReset } from "@/app/actions";

export function ForgotForm() {
  const [state, action, pending] = useActionState(requestReset, null);

  return (
    <form action={action} className="mx-auto flex w-full max-w-sm flex-col gap-3">
      <input
        name="email"
        type="email"
        required
        dir="ltr"
        autoComplete="email"
        placeholder="بريدك"
        aria-label="بريدك"
        className="rounded-xl border border-line bg-card px-4 text-[13.5px] text-ink outline-none focus:border-clay"
        style={{ height: 50 }}
      />

      {state?.error ? (
        <p role="alert" className="text-[12.5px]" style={{ color: "var(--color-live)" }}>
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p role="status" className="rounded-xl bg-card px-4 py-3 text-[12.5px] leading-relaxed text-clay-ink">
          {state.ok}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="brand-gradient rounded-xl text-[14.5px] font-bold disabled:opacity-60"
        style={{ height: 50, color: "var(--color-on-brand)" }}
      >
        {pending ? "نرسل…" : "أرسل الرابط"}
      </button>
    </form>
  );
}
