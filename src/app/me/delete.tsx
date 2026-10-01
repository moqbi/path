"use client";

import { useActionState } from "react";
import { deleteAccount } from "@/app/actions";

/**
 * حذف الحساب داخل التطبيق — شرط متجر آبل لكل تطبيق فيه تسجيل دخول.
 *
 * مطويٌّ فلا يُضغط بالخطأ، ومكتوبٌ فيه ما يذهب قبل أن يذهب، وكلمة المرور
 * شرطٌ لأن جهازاً مفتوحاً في يد غيرك لا يجب أن يمحو حسابك بضغطتين.
 */
export function DeleteAccount({
  hasPassword,
  answer,
  hasEmail,
}: {
  hasPassword: boolean;
  /** ما يُكتب للتأكيد حين لا كلمة: البريدُ، أو الاسمُ لمن لا بريدَ له. */
  answer: string;
  hasEmail: boolean;
}) {
  const [error, action, pending] = useActionState(deleteAccount, null);

  return (
    <details className="mb-8 rounded-2xl border border-line bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between p-4">
        <span className="text-[13.5px] font-semibold" style={{ color: "var(--color-live)" }}>
          حذف الحساب
        </span>
        <span className="text-[11.5px] text-muted">نهائي</span>
      </summary>

      <form action={action} className="flex flex-col gap-3 border-t border-line p-4">
        <p className="text-[12.5px] leading-relaxed text-muted">
          يذهب حسابك ومعه كل ما فيه: لحظاتك وصورك ومحادثاتك وتفاعلاتك وتعليقاتك
          وأصدقاؤك. لا نُبقي نسخة ولا يمكن التراجع.{" "}
          {/* من دخل بمزوّدٍ بلا كلمة يكتب بريده وهو مكتوبٌ أمامه — لا «كلمة مرور» لا يملكها. */}
          {hasPassword ? "اكتب كلمة مرورك لتأكيد أنك أنت." : hasEmail ? "اكتب بريدك للتأكيد:" : "اكتب اسمك للتأكيد:"}
        </p>
        {hasPassword ? null : (
          <p dir="auto" className="select-all text-[13px] font-semibold text-ink">
            {answer}
          </p>
        )}

        <input
          name="password"
          type={hasPassword ? "password" : "text"}
          required
          autoComplete={hasPassword ? "current-password" : "off"}
          placeholder={hasPassword ? "كلمة المرور" : hasEmail ? "البريد" : "الاسم"}
          aria-label={hasPassword ? "كلمة المرور" : hasEmail ? "البريد" : "الاسم"}
          className="rounded-xl border border-line bg-paper px-4 text-[13.5px] text-ink outline-none focus:border-clay"
          style={{ height: 48 }}
        />

        {error ? (
          <p role="alert" className="text-[12px]" style={{ color: "var(--color-live)" }}>
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="rounded-xl text-[14px] font-bold disabled:opacity-60"
          style={{ height: 48, background: "var(--color-live)", color: "#fff" }}
        >
          {pending ? "نحذف…" : "احذف حسابي نهائياً"}
        </button>
      </form>
    </details>
  );
}
