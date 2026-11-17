"use client";

import { useActionState, useState } from "react";
import { grantCoins, setCoins, type AdminResult } from "@/app/actions";

const FIELD = "h-10 rounded-xl border border-line bg-paper px-2 text-[12px] text-ink outline-none";

/**
 * منحُ نقاطٍ في صفّ الحساب (القاعدة ١٩٨) — بجانب منح آثار+ وبهيئته: مطويٌّ
 * حتى يُطلب، فصفُّ الحساب لا يصير جداراً من الحقول.
 */
export function CoinsGrant({ userId, balance }: { userId: string; balance: number }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [state, run, pending] = useActionState<AdminResult, FormData>(grantCoins.bind(null, userId), null);
  const [setState, runSet, setPending] = useActionState<AdminResult, FormData>(setCoins.bind(null, userId), null);

  /*
    تعديلُ الرصيد رقماً — **بقرار المالك**: لتصحيح ما أُودع خطأً، بلا تنبيهٍ ولا
    إشعار، وسطرٌ في سجلّ الإشراف بما كان وما صار.
  */
  if (editing) {
    return (
      <form action={runSet} className="flex flex-wrap items-end gap-2 border-t border-line px-3 py-2.5">
        <label className="flex flex-col gap-1">
          <span className="text-[10.5px] text-faint">الرصيد الجديد</span>
          <input name="balance" inputMode="numeric" required defaultValue={String(balance)} className={`${FIELD} w-[120px]`} />
        </label>
        <button
          type="submit"
          disabled={setPending}
          className="h-10 shrink-0 rounded-xl px-3.5 text-[12px] font-bold"
          style={{ background: "var(--color-clay)", color: "var(--color-on-brand)" }}
        >
          {setPending ? "…" : "احفظ"}
        </button>
        <button type="button" onClick={() => setEditing(false)} className="h-10 shrink-0 px-2 text-[12px] font-semibold text-muted">
          تراجع
        </button>
        <p className="w-full text-[11px] leading-relaxed text-muted">
          الرصيد الآن {balance.toLocaleString("ar-SA")} نقطة. يُكتب الرقم كما هو — بلا تنبيهٍ له ولا إشعار.
        </p>
        {setState?.error ? (
          <p role="alert" className="w-full text-[11.5px]" style={{ color: "var(--color-live)" }}>
            {setState.error}
          </p>
        ) : null}
        {setState?.ok ? <p className="w-full text-[11.5px] font-semibold text-clay-ink">{setState.ok} ✓</p> : null}
      </form>
    );
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-2 border-t border-line px-3 py-2.5">
        <button type="button" onClick={() => setOpen(true)} className="text-[12px] font-semibold text-clay-ink">
          امنح نقاطاً
        </button>
        <button type="button" onClick={() => setEditing(true)} className="text-[12px] font-semibold text-clay-ink">
          عدّل الرصيد
        </button>
        <span className="text-[11px] text-faint">الرصيد {balance.toLocaleString("ar-SA")}</span>
        {state?.ok ? <span className="text-[11.5px] font-semibold text-clay-ink">{state.ok} ✓</span> : null}
      </div>
    );
  }

  return (
    <form
      action={async (data) => {
        await run(data);
      }}
      className="flex flex-wrap items-end gap-2 border-t border-line px-3 py-2.5"
    >
      <label className="flex flex-col gap-1">
        <span className="text-[10.5px] text-faint">النقاط</span>
        <input name="coins" inputMode="numeric" required className={`${FIELD} w-[96px]`} />
      </label>
      <label className="flex min-w-0 grow flex-col gap-1">
        <span className="text-[10.5px] text-faint">السبب (اختياري)</span>
        <input name="note" maxLength={80} placeholder="مكافأة اختبار النسخة ١٨" className={`${FIELD} w-full`} />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="h-10 shrink-0 rounded-xl px-3.5 text-[12px] font-bold"
        style={{ background: "var(--color-clay)", color: "var(--color-on-brand)" }}
      >
        {pending ? "…" : "أودِع"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="h-10 shrink-0 px-2 text-[12px] font-semibold text-muted">
        تراجع
      </button>
      <p className="w-full text-[11px] leading-relaxed text-muted">
        يصله تنبيه «لأنك تستحق — تمّ منحك … نقطة من قبل الإدارة» ويظهر في إشعاراته.
      </p>
      {state?.error ? (
        <p role="alert" className="w-full text-[11.5px]" style={{ color: "var(--color-live)" }}>
          {state.error}
        </p>
      ) : null}
      {state?.ok ? <p className="w-full text-[11.5px] font-semibold text-clay-ink">{state.ok} ✓</p> : null}
    </form>
  );
}
