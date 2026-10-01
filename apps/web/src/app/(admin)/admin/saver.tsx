"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { AdminResult } from "@/app/actions";

/**
 * نموذج في اللوحة يقول ما حدث.
 *
 * قبله كانت أخطاء الفحص تُرمى استثناءات فتطير الشاشة إلى صفحة خطأ عامة —
 * والمشرف لا يعرف أين أخطأ ولا إن كان قد حُفظ شيء. الآن الخطأ يظهر تحت
 * الأزرار، والنجاح **يُغلق النموذج** المطويّ الذي هو فيه (`details`) ويظهر
 * «تمّ الحفظ» عائماً أسفل الشاشة — بقرار المالك: كان يبقى مفتوحاً حتى
 * يُضغط الصنفُ ثانيةً، فلا يُعرف أحُفظ أم لا.
 */
export function Saver({
  action,
  children,
  className,
}: {
  action: (prev: AdminResult, formData: FormData) => Promise<AdminResult>;
  children: React.ReactNode;
  className?: string;
}) {
  const [state, run, pending] = useActionState(action, null);
  const form = useRef<HTMLFormElement>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!state?.ok) return;
    form.current?.closest("details")?.removeAttribute("open");
    setToast(state.ok === "حُفظ" ? "تمّ الحفظ" : state.ok);
    const timer = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(timer);
  }, [state]);

  return (
    <form ref={form} action={run} className={className}>
      {children}

      {state?.error ? (
        <p role="alert" className="text-[12.5px] font-medium" style={{ color: "var(--color-live)" }}>
          {state.error}
        </p>
      ) : null}
      {pending ? <p className="text-[12.5px] font-medium text-muted">يُحفظ…</p> : null}

      {toast
        ? createPortal(
            <p
              role="status"
              className="fixed bottom-6 left-1/2 z-[80] -translate-x-1/2 rounded-full px-5 py-2.5 text-[13px] font-semibold shadow-lg"
              style={{ background: "var(--color-chrome, #0E1A24)", color: "#fff" }}
            >
              {toast} ✓
            </p>,
            document.body,
          )
        : null}
    </form>
  );
}

/**
 * أخو `Saver` لإجراءٍ لا يردّ رسالة (`Promise<void>`) — الحقولُ الصغيرة داخل
 * صنف المتجر: فراغُ الإطار والمجموعة. كانت تحفظ ويبقى الصنفُ مفتوحاً بلا كلمة،
 * فصارت تُغلقه وتقول «تمّ الحفظ» كالنموذج الكبير فوقها.
 */
export function SaveForm({
  action,
  children,
  className,
}: {
  action: (formData: FormData) => Promise<void>;
  children: React.ReactNode;
  className?: string;
}) {
  const form = useRef<HTMLFormElement>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <form
      ref={form}
      className={className}
      action={async (data) => {
        setError(null);
        try {
          await action(data);
          form.current?.closest("details")?.removeAttribute("open");
          setToast("تمّ الحفظ");
        } catch (problem) {
          setError(problem instanceof Error ? problem.message : "تعذّر الحفظ");
        }
      }}
    >
      {children}
      {error ? (
        <p role="alert" className="w-full text-[12px]" style={{ color: "var(--color-live)" }}>
          {error}
        </p>
      ) : null}
      {toast
        ? createPortal(
            <p
              role="status"
              className="fixed bottom-6 left-1/2 z-[80] -translate-x-1/2 rounded-full px-5 py-2.5 text-[13px] font-semibold shadow-lg"
              style={{ background: "var(--color-chrome, #0E1A24)", color: "#fff" }}
            >
              {toast} ✓
            </p>,
            document.body,
          )
        : null}
    </form>
  );
}
