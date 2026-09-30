"use client";

import { useActionState, useState } from "react";
import { joinBetaFromApp } from "@/app/actions";
import { BETA_DEVICES } from "@/lib/topics";

const FIELD =
  "w-full rounded-xl border border-line bg-paper px-4 text-[13px] text-ink outline-none placeholder:text-faint focus:border-clay";

/** نموذجُ `/beta` في الموقع نفسه: بريدُ الدعوة، والجهاز، وملاحظةٌ اختيارية. */
export function BetaForm({ email: initial }: { email: string }) {
  const [state, action, pending] = useActionState(joinBetaFromApp, null);
  const [device, setDevice] = useState("");

  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="px-1 text-[11.5px] font-semibold text-muted">بريدك</span>
        <input
          name="email"
          type="email"
          required
          dir="ltr"
          maxLength={200}
          defaultValue={initial}
          className={FIELD}
          style={{ height: 46 }}
        />
        <span className="px-1 text-[10.5px] text-faint">
          بريدُ حسابك في آبل أو قوقل — إليه تُرسَل الدعوة.
        </span>
      </label>

      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 px-1 text-[11.5px] font-semibold text-muted">جهازك</legend>
        <div className="grid grid-cols-2 gap-2">
          {BETA_DEVICES.map((option) => (
            <label
              key={option}
              className="latin flex h-[46px] cursor-pointer items-center justify-center rounded-xl border text-[13.5px] font-semibold"
              style={{
                borderColor: device === option ? "var(--color-clay)" : "var(--color-line)",
                background: device === option ? "var(--color-card)" : "var(--color-paper)",
                color: device === option ? "var(--color-clay-ink)" : "var(--color-ink-2)",
              }}
            >
              <input
                type="radio"
                name="device"
                value={option}
                required
                checked={device === option}
                onChange={() => setDevice(option)}
                className="sr-only"
              />
              {option}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1">
        <span className="px-1 text-[11.5px] font-semibold text-muted">ملاحظة (اختياري)</span>
        <textarea name="body" rows={3} maxLength={600} className={`${FIELD} resize-none py-3`} />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="brand-gradient w-full rounded-xl text-[14px] font-bold disabled:opacity-50"
        style={{ height: 48, color: "var(--color-on-brand)" }}
      >
        {pending ? "نرسل…" : "انضم"}
      </button>
      {state?.error ? (
        <p className="text-[12px]" style={{ color: "var(--color-live)" }}>
          {state.error}
        </p>
      ) : null}
      {state?.ok ? <p className="text-[12px] text-clay-ink">{state.ok}</p> : null}
    </form>
  );
}
