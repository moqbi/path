"use client";

import { useActionState, useEffect, useState } from "react";
import { commentTicket, ticketSignIn } from "./actions";

const FIELD =
  "h-12 w-full min-w-0 rounded-xl border border-line bg-paper px-4 text-[14px] text-ink outline-none placeholder:text-faint focus:border-clay";

/** دخولُ نظام التذاكر بالبريد وكلمة المرور. */
export function TicketSignIn() {
  const [state, action, pending] = useActionState(ticketSignIn, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input name="email" type="email" required dir="ltr" autoComplete="email" placeholder="البريد" aria-label="البريد" className={FIELD} />
      <input
        name="password"
        type="password"
        required
        dir="ltr"
        autoComplete="current-password"
        placeholder="كلمة المرور"
        aria-label="كلمة المرور"
        className={FIELD}
      />
      <button
        type="submit"
        disabled={pending}
        className="brand-gradient h-12 rounded-xl text-[14px] font-bold disabled:opacity-60"
        style={{ color: "var(--color-on-brand)" }}
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

/** حقلُ تعليق صاحب الطلب — ويقول إنّه يُعيد فتح المغلقة قبل أن يُضغط. */
export function CommentForm({ ticketId, reopen }: { ticketId: string; reopen: boolean }) {
  const [state, action, pending] = useActionState(commentTicket.bind(null, ticketId), null);
  const [body, setBody] = useState("");
  useEffect(() => {
    if (state?.ok) setBody("");
  }, [state]);

  return (
    <form action={action} className="flex flex-col gap-2.5 rounded-2xl bg-card p-4">
      <p className="text-[12.5px] font-bold text-ink">{reopen ? "أعد فتح الطلب بتعليق" : "تعليقك على الردّ"}</p>
      <textarea
        name="body"
        required
        rows={3}
        maxLength={1200}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder={reopen ? "اكتب ما بقي من مشكلتك…" : "اكتب تعليقك…"}
        className="w-full resize-none rounded-xl border border-line bg-paper px-4 py-3 text-[13.5px] text-ink outline-none placeholder:text-faint focus:border-clay"
      />
      <button
        type="submit"
        disabled={pending}
        className="brand-gradient h-12 w-full rounded-xl text-[14px] font-bold disabled:opacity-50"
        style={{ color: "var(--color-on-brand)" }}
      >
        {pending ? "نرسل…" : reopen ? "أعد فتح الطلب" : "أرسل"}
      </button>
      {state?.error ? <p className="text-[12px]" style={{ color: "var(--color-live)" }}>{state.error}</p> : null}
      {state?.ok ? <p className="text-[12px] font-semibold text-clay-ink">{state.ok}</p> : null}
    </form>
  );
}
