"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { AthrLockup } from "@/components/brand";
import { signOut } from "@/app/actions";
import { startSetup, verifyCode, type Setup } from "./actions";

const FIELD =
  "h-14 w-full min-w-0 rounded-xl border border-line bg-card px-4 text-center text-[22px] font-bold tracking-[0.4em] text-ink outline-none focus:border-clay latin";

export function VerifyForm({ setup, name }: { setup: boolean; name: string }) {
  const [state, action, pending] = useActionState(verifyCode, null);
  const [qr, setQr] = useState<Setup | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);

  // مرّةً واحدة: كلُّ نداءٍ يولّد سرّاً جديداً، ورمزٌ معروضٌ من نداءٍ سبق لا يطابق الكوكي.
  const started = useRef(false);
  useEffect(() => {
    if (!setup || started.current) return;
    started.current = true;
    void startSetup().then((result) => {
      if ("error" in result) setQrError(result.error);
      else setQr(result);
    });
  }, [setup]);

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-4">
      <div className="mb-2 flex justify-center">
        <AthrLockup size={64} />
      </div>

      <div className="text-center">
        <h1 className="text-[18px] font-bold" style={{ fontFamily: "var(--font-display)" }}>
          {setup ? "اضبط التحقّق الثنائيّ" : "التحقّق الثنائيّ"}
        </h1>
        <p className="mt-1 text-[12.5px] leading-6 text-muted">
          {setup
            ? `أهلاً ${name} — اللوحة تطلب رمزاً من تطبيق الرموز مع كل دخول. امسح الرمز بـGoogle Authenticator أو 1Password أو ما يشبهه، ثمّ اكتب الأرقام الستّة.`
            : "اكتب الأرقام الستّة من تطبيق الرموز."}
        </p>
      </div>

      {setup ? (
        <div className="flex flex-col items-center gap-3">
          {qr ? (
            <>
              <span className="block rounded-2xl bg-white p-3">
                <svg
                  viewBox={`-1 -1 ${qr.size + 2} ${qr.size + 2}`}
                  width={196}
                  height={196}
                  shapeRendering="crispEdges"
                  role="img"
                  aria-label="رمز QR لتطبيق الرموز"
                >
                  <path d={qr.path} fill="#0e1a24" />
                </svg>
              </span>
              <p className="text-center text-[11.5px] text-muted">
                أو اكتب المفتاح بيدك:
                <span dir="ltr" className="latin mt-1 block select-all break-all text-[13px] font-semibold text-ink">
                  {qr.secret.match(/.{1,4}/g)?.join(" ")}
                </span>
              </p>
            </>
          ) : (
            <p className="text-[12.5px] text-muted">{qrError ?? "…"}</p>
          )}
        </div>
      ) : null}

      <form action={action} className="flex flex-col gap-3">
        <input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus={!setup}
          required
          dir="ltr"
          maxLength={8}
          placeholder="000000"
          aria-label="رمز التحقّق"
          className={FIELD}
        />
        <button
          type="submit"
          disabled={pending}
          className="h-12 rounded-xl text-[13.5px] font-bold disabled:opacity-60"
          style={{ background: "var(--color-clay)", color: "var(--color-on-brand)" }}
        >
          {pending ? "…" : setup ? "فعّل وادخل" : "ادخل"}
        </button>
        {state?.error ? (
          <p role="alert" className="text-center text-[12.5px]" style={{ color: "var(--color-live)" }}>
            {state.error}
          </p>
        ) : null}
      </form>

      <form action={signOut} className="text-center">
        <button type="submit" className="text-[12px] text-muted underline">
          خروج
        </button>
      </form>
    </div>
  );
}
