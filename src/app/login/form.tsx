"use client";

import { useActionState } from "react";
import { signIn } from "@/app/actions";
import { AthrLockup, TAGLINE_AR } from "@/components/brand";
import { LockIcon } from "@/components/icons";

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, null);

  return (
    <div className="flex min-h-dvh flex-col justify-between px-6 pb-10 pt-16">
      <div>
        <div className="mb-4 flex justify-center pt-6">
          <AthrLockup size={46} />
        </div>
        <p className="mb-12 text-center text-[14.5px] text-muted">{TAGLINE_AR}</p>

        <form action={action} className="flex flex-col gap-3">
          <label className="flex flex-col gap-2">
            <span className="text-[11.5px] font-semibold tracking-wide text-faint">البريد</span>
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              defaultValue="mohammed@athar.test"
              className="rounded-xl border border-line bg-card px-4 text-[14.5px] text-ink outline-none focus:border-clay"
              style={{ height: 52 }}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-[11.5px] font-semibold tracking-wide text-faint">كلمة المرور</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              defaultValue="athar1234"
              className="rounded-xl border border-line bg-card px-4 text-[14.5px] text-ink outline-none focus:border-clay"
              style={{ height: 52 }}
            />
          </label>

          {state?.error ? (
            <p role="alert" className="text-[12.5px] font-medium" style={{ color: "var(--color-live)" }}>
              {state.error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="brand-gradient mt-3 flex items-center justify-center rounded-xl text-[15.5px] font-bold disabled:opacity-60"
            style={{ height: 54, color: "var(--color-on-brand)" }}
          >
            {pending ? "لحظة…" : "دخول"}
          </button>
        </form>
      </div>

      <div className="flex items-start justify-center gap-2 text-[11px] leading-relaxed text-faint">
        <LockIcon size={13} className="mt-0.5 shrink-0" />
        <span>حسابان تجريبيان: mohammed@athar.test و noura@athar.test — كلمة المرور athar1234</span>
      </div>
    </div>
  );
}
