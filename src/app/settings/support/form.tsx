"use client";

import { useActionState, useEffect, useRef } from "react";
import { openTicket } from "@/app/actions";

/** نموذج الرسالة: يُفرَّغ بعد الإرسال حتى لا تُرسل مرتين بالغلط. */
export function TicketForm() {
  const [state, action, pending] = useActionState(openTicket, null);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) form.current?.reset();
  }, [state]);

  return (
    <form ref={form} action={action}>
      <textarea
        name="body"
        required
        rows={4}
        maxLength={1200}
        placeholder="اكتب رسالتك…"
        className="mb-2.5 w-full resize-none rounded-xl border border-line bg-paper px-4 py-3 text-[13px] text-ink outline-none placeholder:text-faint focus:border-clay"
      />
      <button
        type="submit"
        disabled={pending}
        className="brand-gradient w-full rounded-xl text-[14px] font-bold disabled:opacity-50"
        style={{ height: 48, color: "var(--color-on-brand)" }}
      >
        {pending ? "نرسل…" : "أرسل"}
      </button>
      {state?.error ? (
        <p className="mt-2 text-[12px]" style={{ color: "var(--color-live)" }}>
          {state.error}
        </p>
      ) : null}
      {state?.ok ? <p className="mt-2 text-[12px] text-clay-ink">{state.ok}</p> : null}
    </form>
  );
}
