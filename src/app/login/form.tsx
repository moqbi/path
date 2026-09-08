"use client";

import { useActionState } from "react";
import { signIn } from "@/app/actions";
import { LockIcon } from "@/components/icons";

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, null);

  return (
    <div className="flex min-h-dvh flex-col justify-between px-6 pb-10 pt-20">
      <div>
        <h1
          className="mb-3 text-[44px] leading-none tracking-wide"
          style={{ fontFamily: "var(--font-display)" }}
        >
          أثر
        </h1>
        <p className="mb-12 text-[14px] leading-relaxed text-muted">
          دائرتك الصغيرة، ولحظاتك التي تبقى.
        </p>

        <form action={action} className="flex flex-col gap-3">
          <label className="flex flex-col gap-2">
            <span className="text-[11.5px] font-semibold tracking-wide text-faint">
              البريد
            </span>
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              defaultValue="mohammed@athar.test"
              className="h-13 rounded-xl border border-line bg-card px-4 text-[14.5px] outline-none focus:border-clay"
              style={{ height: 52 }}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-[11.5px] font-semibold tracking-wide text-faint">
              كلمة المرور
            </span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              defaultValue="athar1234"
              className="rounded-xl border border-line bg-card px-4 text-[14.5px] outline-none focus:border-clay"
              style={{ height: 52 }}
            />
          </label>

          {state?.error ? (
            <p role="alert" className="text-[12.5px] font-medium text-clay">
              {state.error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="mt-3 flex items-center justify-center rounded-xl bg-ink text-[15.5px] font-semibold text-paper disabled:opacity-60"
            style={{ height: 54 }}
          >
            {pending ? "لحظة…" : "دخول"}
          </button>
        </form>
      </div>

      <div className="flex items-center justify-center gap-2 text-[11px] leading-relaxed text-faint">
        <LockIcon size={13} />
        <span>حسابان تجريبيان: mohammed@athar.test و noura@athar.test — كلمة المرور athar1234</span>
      </div>
    </div>
  );
}
