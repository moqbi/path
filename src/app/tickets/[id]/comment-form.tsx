"use client";

import { useActionState, useEffect, useState } from "react";
import { commentTicket } from "@/app/actions";

/** حقلُ تعليق صاحب الطلب — ويقول إنّه يُعيد فتح المغلقة قبل أن يُضغط. */
export function CommentForm({ ticketId, reopen }: { ticketId: string; reopen: boolean }) {
  const [state, action, pending] = useActionState(commentTicket.bind(null, ticketId), null);
  const [body, setBody] = useState("");
  useEffect(() => {
    if (state?.ok) setBody("");
  }, [state]);

  return (
    <form action={action} className="flex flex-col gap-2.5 rounded-2xl border border-line bg-card p-4">
      <p className="text-[12px] font-semibold text-ink">{reopen ? "أعد فتح الطلب بتعليق" : "تعليقك على الردّ"}</p>
      <textarea
        name="body"
        required
        rows={3}
        maxLength={1200}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder={reopen ? "اكتب ما بقي من مشكلتك…" : "اكتب تعليقك…"}
        className="w-full resize-none rounded-xl border border-line bg-paper px-4 py-3 text-[13px] text-ink outline-none placeholder:text-faint focus:border-clay"
      />
      <button
        type="submit"
        disabled={pending}
        className="brand-gradient w-full rounded-xl text-[14px] font-bold disabled:opacity-50"
        style={{ height: 46, color: "var(--color-on-brand)" }}
      >
        {pending ? "نرسل…" : reopen ? "أعد فتح الطلب" : "أرسل"}
      </button>
      {state?.error ? <p className="text-[12px]" style={{ color: "var(--color-live)" }}>{state.error}</p> : null}
      {state?.ok ? <p className="text-[12px] text-clay-ink">{state.ok}</p> : null}
    </form>
  );
}
