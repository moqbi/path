"use client";

import { useState, useTransition } from "react";
import { resendVerify } from "@/app/actions";
import { CheckIcon } from "@/components/icons";

/**
 * حالُ البريد: مؤكَّدٌ أو لا، ومعه زرُّ إعادة الإرسال.
 *
 * ولا يُمنع شيءٌ على غير المؤكَّد: حسابٌ قائمٌ لا يُقفل على صاحبه لأنّ
 * رسالةً لم تصل. التأكيد بابُ الاستعادة يوم ينسى كلمته.
 */
export function VerifyEmail({
  verified,
  hasEmail,
}: {
  verified: boolean;
  hasEmail: boolean;
}) {
  const [said, setSaid] = useState<{ ok?: string; error?: string } | null>(null);
  const [busy, start] = useTransition();

  // ومن لا بريدَ له لا يُقال له «بريدك غير مؤكَّد»: صفُّ «اربط بريدك»
  // تحته يقول ما يلزم، وسطران يقولان الشيء نفسه ضجيج.
  if (!hasEmail) return null;

  if (verified) {
    return (
      <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-line bg-card p-4">
        <span className="text-[13.5px] font-semibold">البريد مؤكَّد</span>
        <span className="shrink-0 text-clay-ink">
          <CheckIcon size={18} />
        </span>
      </div>
    );
  }

  return (
    <div className="mb-3 rounded-2xl border border-line bg-card p-4">
      <p className="mb-1 text-[13.5px] font-semibold">بريدك غير مؤكَّد</p>
      <p className="mb-3 text-[11.5px] leading-relaxed text-muted">
        التأكيد بابُ استعادة حسابك يوم تنسى كلمة مرورك. لا يمنعك من شيء اليوم.
        وإن أرسلتَ ولم تجد الرسالة في الوارد فانظر في «البريد غير الهامّ».
      </p>

      {said?.error ? (
        <p role="alert" className="mb-2 text-[12px]" style={{ color: "var(--color-live)" }}>
          {said.error}
        </p>
      ) : null}
      {said?.ok ? (
        <p role="status" className="mb-2 text-[12px] font-medium text-clay-ink">
          {said.ok}
        </p>
      ) : null}

      <button
        type="button"
        disabled={busy}
        onClick={() =>
          start(async () => {
            setSaid(null);
            setSaid(await resendVerify());
          })
        }
        className="h-11 w-full rounded-xl border border-line text-[13px] font-semibold text-clay-ink disabled:opacity-60"
      >
        {busy ? "نرسل…" : "أرسل رابط التأكيد"}
      </button>
    </div>
  );
}
