"use client";

import { useActionState } from "react";
import { changeEmail } from "@/app/actions";

/**
 * تغيير البريد في الخصوصية.
 *
 * مطويٌّ كحذف الحساب: تغييرٌ لا يُفعل كل يوم ولا يُضغط بالخطأ. والبريد
 * الحالي مكتوبٌ فوق الحقل — من يغيّره ينبغي أن يرى ما يغيّره.
 *
 * وكلمة المرور شرط: البريد اسمُ الدخول، وتغييرُه نقلٌ للحساب إلى عنوانٍ
 * آخر. جهازٌ مفتوحٌ في يد غيرك لا يفعل ذلك بضغطتين.
 */
export function ChangeEmail({
  current,
  hasPassword,
}: {
  current: string | null;
  hasPassword: boolean;
}) {
  const [state, action, pending] = useActionState(changeEmail, null);

  return (
    <details className="mb-3 rounded-2xl border border-line bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between p-4">
        <span>
          <span className="block text-[13.5px] font-semibold">
            {current ? "البريد الإلكتروني" : "اربط بريدك"}
          </span>
          <span dir="ltr" className="block text-right text-[11.5px] text-muted">
            {current ?? "لا بريدَ على حسابك — وبه تستعيده إن ضاع"}
          </span>
        </span>
        <span className="shrink-0 text-[11.5px] text-clay-ink">{current ? "غيّره" : "اربطه"}</span>
      </summary>

      <form action={action} className="flex flex-col gap-3 border-t border-line p-4">
        <p className="text-[12px] leading-relaxed text-muted">
          {current
            ? "البريد هو اسم دخولك. بعد تغييره تدخل بالبريد الجديد وكلمة المرور نفسها."
            : "من دخل بسناب لا بريدَ له، وبلا بريدٍ لا نستطيع أن نعيد إليه حسابه إن فقد سنابه. اربطه الآن."}
        </p>

        <input
          name="email"
          type="email"
          required
          dir="ltr"
          autoComplete="email"
          placeholder="البريد الجديد"
          aria-label="البريد الجديد"
          className="rounded-xl border border-line bg-paper px-4 text-[13.5px] text-ink outline-none focus:border-clay"
          style={{ height: 48 }}
        />
        {/*
           وكلمةُ المرور تُطلب ممّن له كلمة: من دخل بمزوّدٍ الجلسةُ
           دليلُه، وحقلٌ لا يستطيع ملأه بابٌ مغلق لا حارس.
        */}
        {hasPassword ? (
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="كلمة المرور"
            aria-label="كلمة المرور"
            className="rounded-xl border border-line bg-paper px-4 text-[13.5px] text-ink outline-none focus:border-clay"
            style={{ height: 48 }}
          />
        ) : null}

        {state?.error ? (
          <p role="alert" className="text-[12px]" style={{ color: "var(--color-live)" }}>
            {state.error}
          </p>
        ) : null}
        {state?.ok ? (
          <p role="status" className="text-[12px] font-medium text-clay-ink">
            {state.ok}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="rounded-xl text-[14px] font-bold disabled:opacity-60"
          style={{ height: 48, background: "var(--color-clay)", color: "var(--color-on-brand)" }}
        >
          {pending ? "نحفظ…" : current ? "احفظ البريد" : "اربط البريد"}
        </button>
      </form>
    </details>
  );
}
