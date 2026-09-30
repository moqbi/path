"use client";

import { useActionState, useEffect, useState } from "react";
import { openTicket } from "@/app/actions";
import { FilesField } from "@/components/files-field";
import { CONTACT_REASONS } from "@/lib/topics";

const FIELD =
  "w-full rounded-xl border border-line bg-paper px-4 text-[13px] text-ink outline-none placeholder:text-faint focus:border-clay";

/**
 * نموذج الرسالة: سببُها ثمّ نصُّها ثمّ صورٌ إن لزم — كنموذج الموقع
 * (القاعدة ١٨٠ب). ويُفرَّغ بعد الإرسال حتى لا تُرسل مرتين بالغلط.
 */
export function TicketForm() {
  const [state, action, pending] = useActionState(openTicket, null);
  const [topic, setTopic] = useState("");
  const [body, setBody] = useState("");

  useEffect(() => {
    if (state?.ok) {
      setTopic("");
      setBody("");
    }
  }, [state]);

  return (
    <form action={action} className="flex flex-col gap-2.5">
      <select
        name="topic"
        required
        value={topic}
        onChange={(event) => setTopic(event.target.value)}
        className={FIELD}
        style={{ height: 46 }}
        aria-label="سبب التواصل"
      >
        <option value="" disabled>
          سبب التواصل…
        </option>
        {CONTACT_REASONS.map((item) => (
          <option key={item.key} value={item.key}>
            {item.label}
          </option>
        ))}
      </select>
      <textarea
        name="body"
        required
        rows={4}
        maxLength={1200}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="اكتب رسالتك…"
        className={`${FIELD} resize-none py-3`}
      />
      <FilesField
        accept="image/jpeg,image/png,image/webp"
        label="صور (اختياري)"
        hint="حتى ٣ صور، ٥ ميغا لكلٍّ — لقطةُ شاشةٍ تشرح المشكلة أسرع من فقرة."
        resetKey={state}
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
        <p className="text-[12px]" style={{ color: "var(--color-live)" }}>
          {state.error}
        </p>
      ) : null}
      {state?.ok ? <p className="text-[12px] text-clay-ink">{state.ok}</p> : null}
    </form>
  );
}
