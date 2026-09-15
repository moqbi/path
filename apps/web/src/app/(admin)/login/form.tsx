"use client";

import { useActionState } from "react";
import { signIn } from "@/app/actions";
import { AthrLockup } from "@/components/brand";

const FIELD =
  "h-12 w-full min-w-0 rounded-xl border border-line bg-card px-4 text-[13.5px] text-ink outline-none focus:border-clay";

export function SignInForm() {
  const [state, action, pending] = useActionState(signIn, null);

  return (
    <form action={action} className="mx-auto flex w-full max-w-sm flex-col gap-3">
      <div className="mb-4 flex justify-center">
        <AthrLockup size={72} />
      </div>

      <input name="email" type="email" required dir="ltr" placeholder="البريد" aria-label="البريد" className={FIELD} />
      <input
        name="password"
        type="password"
        required
        dir="ltr"
        placeholder="كلمة المرور"
        aria-label="كلمة المرور"
        className={FIELD}
      />

      <button
        type="submit"
        disabled={pending}
        className="h-12 rounded-xl text-[13.5px] font-bold disabled:opacity-60"
        style={{ background: "var(--color-clay)", color: "var(--color-on-brand)" }}
      >
        {pending ? "…" : "ادخل"}
      </button>

      {state?.error ? (
        <p role="alert" className="text-center text-[12.5px]" style={{ color: "var(--color-live)" }}>
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
