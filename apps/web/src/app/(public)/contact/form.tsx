"use client";

import { useActionState, useEffect, useState } from "react";
import { openPublicTicket } from "@/app/actions";

const FIELD =
  "w-full min-w-0 rounded-xl border border-line bg-card px-4 text-[13.5px] text-ink outline-none focus:border-clay";

/**
 * الحقول محفوظةٌ في الحالة لا متروكةٌ للمتصفّح.
 *
 * React يمسح حقول النموذج بعد كل إجراء — فرسالةٌ من عشرة أسطر تُردّ
 * بخطأٍ في البريد كانت تذهب كلها، ومن ذهبت رسالتُه مرّةً لا يكتبها ثانية.
 * وبالنجاح تُمسح قصداً.
 */
export function ContactForm() {
  const [state, action, pending] = useActionState(openPublicTicket, null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [body, setBody] = useState("");

  useEffect(() => {
    if (state?.ok) {
      setName("");
      setEmail("");
      setBody("");
    }
  }, [state]);

  return (
    <form action={action} className="my-5 flex max-w-lg flex-col gap-2.5">
      <label className="flex flex-col gap-1">
        <span className="px-1 text-[11.5px] font-semibold text-muted">اسمك</span>
        <input
          name="name"
          required
          maxLength={60}
          value={name}
          onChange={(event) => setName(event.target.value)}
          className={FIELD}
          style={{ height: 46 }}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="px-1 text-[11.5px] font-semibold text-muted">بريدك</span>
        <input
          name="email"
          type="email"
          required
          dir="ltr"
          maxLength={120}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={FIELD}
          style={{ height: 46 }}
        />
        <span className="px-1 text-[10.5px] text-faint">إليه يذهب ردّنا.</span>
      </label>

      <label className="flex flex-col gap-1">
        <span className="px-1 text-[11.5px] font-semibold text-muted">رسالتك</span>
        <textarea
          name="body"
          required
          rows={6}
          maxLength={1200}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          className={`${FIELD} py-3 leading-[1.9]`}
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="h-11 rounded-xl text-[13px] font-bold disabled:opacity-60"
        style={{ background: "var(--color-clay)", color: "var(--color-on-brand)" }}
      >
        {pending ? "…" : "أرسل"}
      </button>

      {state?.error ? (
        <p role="alert" className="text-[12.5px] font-medium" style={{ color: "var(--color-live)" }}>
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p role="status" className="text-[12.5px] font-medium text-clay-ink">
          {state.ok}
        </p>
      ) : null}
    </form>
  );
}
