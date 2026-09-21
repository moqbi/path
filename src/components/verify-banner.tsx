"use client";

import { useState, useTransition } from "react";
import { resendVerify } from "@/app/actions";
import { UNVERIFIED_MINUTES } from "@/lib/verify";
import { ar } from "@/lib/format";

/**
 * «أكّد بريدك» في أعلى الخطّ الزمنيّ.
 *
 * وسطرُ الإعدادات وحده لا يكفي: من سجّل للتوّ لا يعرف أنّ هناك إعدادات،
 * ولا أنّ رسالةً خرجت إليه أصلاً — فكان يمرّ على الحساب الجديد شهرٌ
 * بلا تأكيد، فإذا نسي كلمته لم يبقَ له باب.
 *
 * **ويُقال له أين يبحث**: أوّلُ رسالةٍ من نطاقٍ جديد تذهب إلى «غير
 * الهامّ» عند كثيرين، ومن لم يجدها في الوارد يظنّها لم تُرسَل فيعيد
 * الطلب — والباب فيه مهلةُ دقيقة، فيُردّ ويظنّ العطل عندنا.
 *
 * **ولا يمنع شيئاً** (القاعدة ١١٩ب): يُطوى بضغطةٍ ويبقى الخطُّ الزمنيّ
 * تحته. وطيُّه في `sessionStorage` لا في القاعدة: حقلٌ يُكتب لأجل
 * إخفاء سطرٍ ثمنٌ لا يُدفع، وبفتحٍ جديد يعود التذكير.
 */
const HIDDEN = "athr:verify-hidden";

export function VerifyBanner({ email }: { email: string }) {
  const [gone, setGone] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return sessionStorage.getItem(HIDDEN) === "1";
    } catch {
      return false;
    }
  });
  const [said, setSaid] = useState<{ ok?: string; error?: string } | null>(null);
  const [busy, start] = useTransition();

  if (gone) return null;

  return (
    <section className="mb-3 rounded-2xl border border-line bg-card p-4">
      <p className="mb-1 text-[13.5px] font-semibold">أكّد بريدك</p>
      <p className="mb-3 text-[11.5px] leading-relaxed text-muted">
        أرسلنا رابط التأكيد إلى <span dir="ltr" className="latin font-semibold">{email}</span>.
        إن لم تجده في الوارد فانظر في «البريد غير الهامّ» — أوّلُ رسالةٍ منّا تذهب
        إليه أحياناً.
      </p>
      <p className="mb-3 text-[11.5px] font-semibold leading-relaxed" style={{ color: "var(--color-live)" }}>
        وأكّده خلال {ar(UNVERIFIED_MINUTES)} دقائق، وإلّا حُذف الحساب — لا نُبقي
        حساباً ببريدٍ لم يُثبت صاحبُه أنّه له.
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

      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            start(async () => {
              setSaid(null);
              setSaid(await resendVerify());
            })
          }
          className="h-11 flex-1 rounded-xl border border-line text-[13px] font-semibold text-clay-ink disabled:opacity-60"
        >
          {busy ? "نرسل…" : "أعِد الإرسال"}
        </button>
        <button
          type="button"
          onClick={() => {
            try {
              sessionStorage.setItem(HIDDEN, "1");
            } catch {
              /* متصفّحٌ يمنع التخزين: يُطوى لهذه الشاشة وحدها */
            }
            setGone(true);
          }}
          className="h-11 rounded-xl px-4 text-[13px] font-semibold text-muted"
        >
          لاحقاً
        </button>
      </div>
    </section>
  );
}
