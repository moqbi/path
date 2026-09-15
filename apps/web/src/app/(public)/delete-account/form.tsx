"use client";

import { useActionState, useState } from "react";
import { deleteAccountFromWeb } from "@/app/actions";

const FIELD =
  "w-full min-w-0 rounded-xl border border-line bg-card px-4 text-[13.5px] text-ink outline-none focus:border-clay";

export function DeleteForm() {
  const [state, action, pending] = useActionState(deleteAccountFromWeb, null);
  /*
    البريد محفوظٌ في الحالة: React يمسح حقول النموذج بعد كل إجراء، فمن
    نسي التأكيد كان يعود ليجد الحقول فارغة. وكلمةُ المرور تُمسح قصداً —
    حقلٌ يحتفظ بها على شاشةٍ مفتوحة ليس لطفاً.
  */
  const [email, setEmail] = useState("");

  // بعد الحذف لا يبقى نموذج: حقلا بريدٍ وكلمةِ مرورٍ تحت «حُذف حسابك»
  // يُقرآن دعوةً إلى محاولةٍ أخرى على حسابٍ لم يعد موجوداً.
  if (state?.ok) {
    return (
      <p
        role="status"
        className="my-5 rounded-2xl border border-line bg-card p-5 text-[14px] font-semibold"
      >
        {state.ok}
      </p>
    );
  }

  return (
    <form action={action} className="my-5 flex max-w-md flex-col gap-2.5">
      <label className="flex flex-col gap-1">
        <span className="px-1 text-[11.5px] font-semibold text-muted">بريد الحساب</span>
        <input
          name="email"
          type="email"
          required
          dir="ltr"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={FIELD}
          style={{ height: 46 }}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="px-1 text-[11.5px] font-semibold text-muted">كلمة المرور</span>
        <input
          name="password"
          type="password"
          required
          dir="ltr"
          className={FIELD}
          style={{ height: 46 }}
        />
      </label>

      <label className="flex items-start gap-2.5 px-1 text-[12.5px] leading-[1.8]">
        <input name="sure" type="checkbox" className="mt-1 h-4 w-4 accent-[#ff7a5a]" />
        أفهم أنّ الحذف نهائيّ وأنّ ما يذهب لا يعود.
      </label>

      <button
        type="submit"
        disabled={pending}
        className="h-11 rounded-xl text-[13px] font-bold text-white disabled:opacity-60"
        style={{ background: "var(--color-live)" }}
      >
        {pending ? "…" : "احذف حسابي"}
      </button>

      {state?.error ? (
        <p role="alert" className="text-[12.5px] font-medium" style={{ color: "var(--color-live)" }}>
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
