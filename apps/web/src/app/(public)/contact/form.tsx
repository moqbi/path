"use client";

import { useActionState, useEffect, useState } from "react";
import { applyForJob, joinBeta, openPublicTicket } from "@/app/actions";
import { FilesField } from "@/components/files-field";
import { BETA_DEVICES, CONTACT_REASONS } from "@/lib/topics";

const FIELD =
  "w-full min-w-0 rounded-xl border border-line bg-paper px-4 text-[13.5px] text-ink outline-none focus:border-clay";

/**
 * الحقول محفوظةٌ في الحالة لا متروكةٌ للمتصفّح.
 *
 * React يمسح حقول النموذج بعد كل إجراء — فرسالةٌ من عشرة أسطر تُردّ
 * بخطأٍ في البريد كانت تذهب كلها، ومن ذهبت رسالتُه مرّةً لا يكتبها ثانية.
 * وبالنجاح تُمسح قصداً.
 */
export function ContactForm({ mode = "contact" }: { mode?: "contact" | "careers" | "beta" }) {
  const careers = mode === "careers";
  const beta = mode === "beta";
  const [state, action, pending] = useActionState(
    careers ? applyForJob : beta ? joinBeta : openPublicTicket,
    null,
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [body, setBody] = useState("");
  const [reason, setReason] = useState("");
  const [device, setDevice] = useState("");

  useEffect(() => {
    if (state?.ok) {
      setName("");
      setEmail("");
      setBody("");
      setReason("");
      setDevice("");
    }
  }, [state]);

  return (
    <form action={action} className="flex flex-col gap-3.5">
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
        <span className="px-1 text-[10.5px] text-faint">
          {beta ? "بريدُ حسابك في آبل أو قوقل — إليه تُرسَل الدعوة." : "إليه يذهب ردّنا."}
        </span>
      </label>

      {mode === "contact" ? (
        <label className="flex flex-col gap-1">
          <span className="px-1 text-[11.5px] font-semibold text-muted">سبب التواصل</span>
          <select
            name="reason"
            required
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className={FIELD}
            style={{ height: 46 }}
          >
            <option value="" disabled>
              اختر…
            </option>
            {CONTACT_REASONS.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {beta ? (
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
      ) : null}

      <label className="flex flex-col gap-1">
        <span className="px-1 text-[11.5px] font-semibold text-muted">
          {careers ? "عرّفنا بنفسك" : beta ? "ملاحظة (اختياري)" : "رسالتك"}
        </span>
        <textarea
          name="body"
          required={!beta}
          rows={beta ? 3 : 6}
          maxLength={1200}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={
            careers
              ? "ما الذي تحسنه، وماذا صنعت — ورابطٌ إن وُجد"
              : beta
                ? "طراز جهازك، أو ما تحبّ أن تجرّبه أوّلاً"
                : undefined
          }
          className={`${FIELD} py-3 leading-[1.9]`}
        />
      </label>

      {beta ? null : (
      <FilesField
        accept={careers ? "image/jpeg,image/png,image/webp,application/pdf" : "image/jpeg,image/png,image/webp"}
        label={careers ? "سيرتك أو أعمالك (اختياري)" : "صور توضّح المشكلة (اختياري)"}
        hint={careers ? "صور أو PDF — ثلاثة ملفّات، وخمسة ميغا لكلٍّ" : "صور فقط — ثلاث، وخمسة ميغا لكلٍّ"}
        resetKey={state?.ok}
      />
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 h-12 rounded-xl text-[14px] font-bold disabled:opacity-60"
        style={{ background: "var(--color-clay)", color: "var(--color-on-brand)" }}
      >
        {pending ? "نرسل…" : careers ? "أرسل طلبك" : beta ? "سجّلني" : "أرسل"}
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
