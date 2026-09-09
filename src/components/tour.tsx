"use client";

import { useEffect, useState } from "react";
import { CircleIcon, HomeIcon, LockIcon, PlusIcon, WithIcon } from "@/components/icons";

const KEY = "athr:tour";

const STEPS = [
  {
    Icon: HomeIcon,
    title: "خطّك الزمني",
    body: "لحظاتك ولحظات دائرتك في يوميّة واحدة: مكانٌ حللت به، أغنية تسمعها، خاطرة، أو نوم. لا خوارزمية ترتّبها — الأحدث أولاً.",
  },
  {
    Icon: PlusIcon,
    title: "انشر بضغطة",
    body: "زرّ الزائد يفتح قوساً: اكتب، صورة، مكان، أغنية، نوم. والمكان يأتي من جهازك لا من لوحة المفاتيح.",
  },
  {
    Icon: CircleIcon,
    title: "مئة وخمسون",
    body: "سقف دائرتك ١٥٠ ولا يُشترى. الإضافة من أصدقاء أصدقائك وحدهم — لا بحث ولا اكتشاف عام.",
  },
  {
    Icon: LockIcon,
    title: "من يرى ماذا",
    body: "عند النشر تختار: كل دائرتك، أو تصنيفاً منها (العائلة، الزملاء)، أو أشخاصاً بأعيانهم. ومن هو خارج الجمهور لا تصله اللحظة أصلاً.",
  },
  {
    Icon: WithIcon,
    title: "آثارنا",
    body: "اضغط مطوّلاً على تبويب «اللحظات» لتفتح لحظاتك الخاصة، وأثرك المشترك مع كل صديق.",
  },
];

/**
 * جولة أول فتح.
 *
 * تُعرض مرة واحدة ثم تُنسى في `localStorage` — لا صفّ في القاعدة لشيء
 * يخصّ هذا الجهاز وحده. وتُقرأ بعد التركيب لا قبله، فلا تومض للعائدين.
 */
export function Tour() {
  const [step, setStep] = useState<number | null>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) !== "1") setStep(0);
    } catch {
      // التصفح الخاص قد يمنع التخزين — لا جولة، ولا شيء يتعطّل.
    }
  }, []);

  function close() {
    try {
      localStorage.setItem(KEY, "1");
    } catch {}
    setStep(null);
  }

  if (step === null) return null;
  const current = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center"
      style={{ background: "rgba(14,26,36,.82)", animation: "athr-veil 200ms ease both" }}
    >
      <div
        className="w-full rounded-t-3xl px-6 pb-9 pt-7 text-center"
        style={{
          background: "var(--color-card)",
          maxWidth: 430,
          animation: "athr-sheet 380ms cubic-bezier(.16,1.1,.3,1) both",
        }}
      >
        <span
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
          style={{ background: "var(--color-clay-soft)", color: "var(--color-clay-ink)" }}
        >
          <current.Icon size={26} />
        </span>

        <h2 className="mb-2 text-[19px] font-bold">{current.title}</h2>
        <p className="mx-auto mb-6 max-w-[320px] text-[13.5px] leading-loose text-ink-2">
          {current.body}
        </p>

        <div className="mb-5 flex items-center justify-center gap-1.5">
          {STEPS.map((_, index) => (
            <span
              key={index}
              className="block rounded-full"
              style={{
                width: index === step ? 18 : 6,
                height: 6,
                background: index === step ? "var(--color-clay)" : "var(--color-line)",
                transition: "width 220ms ease",
              }}
            />
          ))}
        </div>

        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={close}
            className="rounded-xl border border-line px-4 text-[13px] font-semibold text-muted"
            style={{ height: 50 }}
          >
            تخطّى
          </button>
          <button
            type="button"
            onClick={() => (last ? close() : setStep(step + 1))}
            className="brand-gradient grow rounded-xl text-[15px] font-bold"
            style={{ height: 50, color: "var(--color-on-brand)" }}
          >
            {last ? "ابدأ" : "التالي"}
          </button>
        </div>
      </div>
    </div>
  );
}
