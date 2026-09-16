"use client";

import { useActionState, useState } from "react";
import { liftSuspension, suspendUser, type AdminResult } from "@/app/actions";
import { SUSPEND_HOURS } from "@/lib/suspend";
import { relative, untilDay } from "@/lib/format";

/**
 * الإيقاف المؤقّت في صفّ الحساب.
 *
 * مطويٌّ حتى يُطلب: صفُّ الحساب يُقرأ للوسم والبريد في الغالب، وقائمةُ
 * مُددٍ وحقلُ سببٍ مفتوحان على كل صفّ يجعلان القائمة جداراً.
 *
 * والمدّة قائمةٌ مغلقة لا حقلُ أيام: حقلٌ حرّ يقبل «٩٩٩٩» بزلّة إصبع،
 * وإيقافُ سبعٍ وعشرين سنةً حذفُ حسابٍ بلا اسمه.
 */
export function Suspend({
  userId,
  until,
  reason,
}: {
  userId: string;
  until: Date | null;
  reason: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, run, pending] = useActionState<AdminResult, FormData>(
    suspendUser.bind(null, userId),
    null,
  );

  const held = until !== null && until > new Date();

  if (held) {
    return (
      <div className="border-t border-line px-3 py-2.5">
        <p className="text-[12px] font-semibold" style={{ color: "var(--color-live)" }}>
          موقوف — ينتهي {untilDay(until)}
        </p>
        {reason ? <p className="mt-0.5 text-[11px] text-muted">{reason}</p> : null}
        <form action={liftSuspension.bind(null, userId)}>
          <button type="submit" className="mt-1.5 text-[11.5px] font-semibold text-clay-ink">
            ارفع الإيقاف الآن
          </button>
        </form>
      </div>
    );
  }

  if (!open) {
    return (
      <div className="border-t border-line px-3 py-2.5">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-[12px] font-semibold"
          style={{ color: "var(--color-live)" }}
        >
          أوقفه مؤقّتاً
        </button>
        {until ? (
          /*
            إيقافٌ انقضى بنفسه يبقى تاريخُه في الصفّ فيُقرأ هنا. وما
            رُفع باليد يُمحى منه — وسجلُّ الإشراف يحفظ الاثنين، فهو
            المرجع لا هذا الحقل.
          */
          <span className="mr-2 text-[11px] text-faint">سبق إيقافه {relative(until)}</span>
        ) : null}
      </div>
    );
  }

  return (
    <form action={run} className="flex flex-wrap items-end gap-2 border-t border-line px-3 py-2.5">
      <label className="flex flex-col gap-1">
        <span className="text-[10.5px] text-faint">المدّة</span>
        <select
          name="hours"
          defaultValue="24"
          className="h-10 w-[104px] rounded-xl border border-line bg-paper px-2 text-[12px] text-ink outline-none"
        >
          {SUSPEND_HOURS.map((one) => (
            <option key={one.key} value={one.key}>
              {one.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex min-w-[150px] grow flex-col gap-1">
        <span className="text-[10.5px] text-faint">السبب — يُقال له</span>
        <input
          name="reason"
          maxLength={200}
          placeholder="بلاغات متكرّرة"
          className="h-10 w-full rounded-xl border border-line bg-paper px-3 text-[12.5px] text-ink outline-none placeholder:text-faint"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="h-10 shrink-0 rounded-xl px-3.5 text-[12px] font-bold"
        style={{ background: "var(--color-live)", color: "#fff" }}
      >
        {pending ? "…" : "أوقف"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="h-10 shrink-0 px-2 text-[12px] font-semibold text-muted"
      >
        تراجع
      </button>

      {state?.error ? (
        <p role="alert" className="w-full text-[11.5px]" style={{ color: "var(--color-live)" }}>
          {state.error}
        </p>
      ) : null}
      {state?.ok ? <p className="w-full text-[11.5px] font-semibold text-clay-ink">{state.ok} ✓</p> : null}
    </form>
  );
}
