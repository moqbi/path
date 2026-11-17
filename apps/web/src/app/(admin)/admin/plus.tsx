"use client";

import { useActionState, useState } from "react";
import { grantPlus, revokePlus, setPlusUntil, type AdminResult } from "@/app/actions";
import { PLUS_DAYS, PLUS_LABEL } from "@/lib/plus";
import { untilDay } from "@/lib/format";

/**
 * منحُ آثار+ في صفّ الحساب.
 *
 * في مكانه لا في شاشةٍ تعرض كل المستخدمين: الحساب يُوصَل إليه بالبحث
 * برقم عضويته أو معرّفه (القاعدة ١١٥)، فالمنح يجري حيث يُقرأ الحساب.
 *
 * ومطويٌّ حتى يُطلب — كالإيقاف: صفُّ الحساب يُقرأ للوسم والبريد في
 * الغالب، وقائمةُ مُددٍ مفتوحة على كل صفّ تجعل القائمة جداراً.
 *
 * وحين يكون مشتركاً يُقال إلى متى، فالمنحُ فوقه تمديدٌ لا استبدال.
 */
export function PlusGrant({
  userId,
  until,
}: {
  userId: string;
  /** نهايةُ اشتراكه القائم إن كان له اشتراك. */
  until: Date | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, run, pending] = useActionState<AdminResult, FormData>(
    grantPlus.bind(null, userId),
    null,
  );

  const [dateState, runDate, datePending] = useActionState<AdminResult, FormData>(
    setPlusUntil.bind(null, userId),
    null,
  );

  const live = until !== null && until > new Date();
  // التاريخُ يبدأ من نهايته القائمة بتوقيت الرياض، وإلّا بعد شهرٍ من اليوم.
  const riyadhDay = (at: Date) =>
    new Date(at.getTime() + 3 * 3_600_000).toISOString().slice(0, 10);
  const defaultDay = riyadhDay(live ? until : new Date(Date.now() + 30 * 86_400_000));
  const today = riyadhDay(new Date());

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-2 border-t border-line px-3 py-2.5">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-[12px] font-semibold text-clay-ink"
        >
          {live ? "مدّد آثار+" : "امنح آثار+"}
        </button>

        {live ? (
          <>
            <span className="text-[11px] text-faint">مشترك حتى {untilDay(until)}</span>
            <form action={revokePlus.bind(null, userId)} className="mr-auto">
              <button
                type="submit"
                className="text-[11.5px] font-semibold"
                style={{ color: "var(--color-live)" }}
              >
                أوقف الاشتراك
              </button>
            </form>
          </>
        ) : (
          <span className="text-[11px] text-faint">ليس مشتركاً</span>
        )}

        {state?.ok || dateState?.ok ? (
          <span className="w-full text-[11.5px] font-semibold text-clay-ink">{dateState?.ok ?? state?.ok}</span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="border-t border-line">
    <form action={run} className="flex flex-wrap items-end gap-2 px-3 py-2.5">
      <label className="flex flex-col gap-1">
        <span className="text-[10.5px] text-faint">المدّة</span>
        <select
          name="days"
          defaultValue="30"
          className="h-10 w-[104px] rounded-xl border border-line bg-paper px-2 text-[12px] text-ink outline-none"
        >
          {PLUS_DAYS.map((days) => (
            <option key={days} value={days}>
              {PLUS_LABEL[days]}
            </option>
          ))}
        </select>
      </label>

      <button
        type="submit"
        disabled={pending}
        className="h-10 shrink-0 rounded-xl px-3.5 text-[12px] font-bold"
        style={{ background: "var(--color-clay)", color: "var(--color-on-brand)" }}
      >
        {/*
          «فعّل» لا «امنح»: زرُّ حفظِ الوسم في الصفّ نفسه مكتوبٌ عليه
          «امنح»، وزرّان بالاسم ذاته على بطاقةٍ واحدة يُضغط أحدهما
          مكان الآخر.
        */}
        {pending ? "…" : live ? "مدّد" : "فعّل"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="h-10 shrink-0 px-2 text-[12px] font-semibold text-muted"
      >
        تراجع
      </button>

      <p className="w-full text-[11px] leading-relaxed text-muted">
        {live ? "تُضاف المدّة إلى ما بقي، ولا تمحوه. " : ""}
        المنحُ بلا نقاط — للنقاط «امنح نقاطاً».
      </p>

      {state?.error ? (
        <p role="alert" className="w-full text-[11.5px]" style={{ color: "var(--color-live)" }}>
          {state.error}
        </p>
      ) : null}
      {state?.ok ? <p className="w-full text-[11.5px] font-semibold text-clay-ink">{state.ok} ✓</p> : null}
    </form>

    {/* أو اليومُ نفسه: يُصحَّح به تمديدٌ تكرّر، ويُقصَّر ولا يُطال إلا بتاريخ. */}
    <form action={runDate} className="flex flex-wrap items-end gap-2 border-t border-dashed border-line px-3 py-2.5">
      <label className="flex flex-col gap-1">
        <span className="text-[10.5px] text-faint">أو حدّد تاريخ النهاية</span>
        <input
          type="date"
          name="until"
          min={today}
          defaultValue={defaultDay}
          required
          className="h-10 w-[150px] rounded-xl border border-line bg-paper px-2 text-[12px] text-ink outline-none"
        />
      </label>
      <button
        type="submit"
        disabled={datePending}
        className="h-10 shrink-0 rounded-xl px-3.5 text-[12px] font-bold"
        style={{ background: "var(--color-clay)", color: "var(--color-on-brand)" }}
      >
        {datePending ? "…" : "اضبط"}
      </button>
      <p className="w-full text-[11px] leading-relaxed text-muted">
        ينتهي آخرَ ذلك اليوم بتوقيت الرياض — يُطيل أو يُقصّر ما قبله.
      </p>
      {dateState?.error ? (
        <p role="alert" className="w-full text-[11.5px]" style={{ color: "var(--color-live)" }}>
          {dateState.error}
        </p>
      ) : null}
      {dateState?.ok ? <p className="w-full text-[11.5px] font-semibold text-clay-ink">{dateState.ok} ✓</p> : null}
    </form>
    </div>
  );
}
