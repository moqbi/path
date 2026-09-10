"use client";

import { useActionState, useEffect } from "react";
import { saveProfile } from "@/app/actions";

const FIELD =
  "w-full rounded-xl border border-line bg-card px-4 text-[13.5px] text-ink outline-none focus:border-clay";

export function EditProfileForm({
  name,
  handle,
  bio,
  city,
  onSaved,
}: {
  name: string;
  handle: string | null;
  bio: string | null;
  city: string | null;
  /** تُستدعى بعد حفظٍ ناجح — النافذة تُغلق نفسها. */
  onSaved?: () => void;
}) {
  const [state, action, pending] = useActionState(saveProfile, null);

  useEffect(() => {
    if (state?.ok) onSaved?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="text-[12.5px] font-semibold text-ink-2">الاسم</label>
      <input name="name" required maxLength={40} defaultValue={name} className={FIELD} style={{ height: 48 }} />

      <label className="text-[12.5px] font-semibold text-ink-2">المعرّف</label>
      <div className="flex items-center gap-2">
        <span className="text-[15px] text-muted">@</span>
        <input
          name="handle"
          dir="ltr"
          maxLength={20}
          defaultValue={handle ?? ""}
          placeholder="mohammed"
          className={`${FIELD} text-left`}
          style={{ height: 48 }}
        />
      </div>
      <p className="-mt-1 text-[11px] text-muted">
        حروف إنجليزية وأرقام و_ ، من ٣ إلى ٢٠ حرفاً. يظهر تحت اسمك.
      </p>

      <label className="text-[12.5px] font-semibold text-ink-2">نبذة</label>
      <textarea
        name="bio"
        maxLength={160}
        rows={3}
        defaultValue={bio ?? ""}
        placeholder="سطران عنك…"
        className={`${FIELD} py-3 leading-relaxed`}
      />

      <label className="text-[12.5px] font-semibold text-ink-2">المدينة</label>
      <input
        name="city"
        maxLength={40}
        defaultValue={city ?? ""}
        placeholder="الرياض"
        className={FIELD}
        style={{ height: 48 }}
      />

      {state?.error ? (
        <p role="alert" className="text-[12.5px]" style={{ color: "var(--color-live)" }}>
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="brand-gradient mt-1 rounded-xl text-[14.5px] font-bold disabled:opacity-60"
        style={{ height: 50, color: "var(--color-on-brand)" }}
      >
        {pending ? "نحفظ…" : "احفظ"}
      </button>
    </form>
  );
}
