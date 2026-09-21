"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useSwipeDown } from "@/components/nav";

/**
 * النوافذ تُرسم على جسد الصفحة لا داخل الشجرة (القاعدة ٩٢).
 *
 * `fixed` داخل عنصرٍ عليه `transform` يُقاس من ذلك العنصر لا من الشاشة،
 * فكانت النافذة تُحبس خلف شريط التبويبات.
 */
export function Portal({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready) return null;
  return createPortal(children, document.body);
}

/**
 * نافذةٌ من الأسفل.
 *
 * ومكانها هنا لا في `avatar-menu.tsx`: المتجر يفتح البطاقة نفسها،
 * ونسخةٌ ثانية منها تنفرط عن الأولى بأوّل تعديل.
 *
 * وتُغلق بسحبها إلى أسفل (القاعدة ٧٨) — وهو «رجوعها».
 */
export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  // المستمعات تُركَّب مع النافذة نفسها، فكلُّ نافذةٍ تُفتح تُسحب لتُغلق.
  const box = useSwipeDown(onClose);

  return (
    <Portal>
      <div
        className="fixed inset-0 z-50 flex flex-col justify-end"
        style={{ background: "rgba(14,26,36,.42)", animation: "athr-veil 160ms ease both" }}
      >
        <button type="button" aria-label="إغلاق" onClick={onClose} className="grow" />
        <div
          ref={box}
          className="rounded-t-3xl px-5 pb-8 pt-3"
          style={{ background: "var(--color-paper)", borderTop: "1px solid var(--color-line)" }}
        >
          {/* مقبضٌ يقول إنّ النافذة تُسحب. */}
          <span
            aria-hidden="true"
            className="mx-auto mb-3 block rounded-full"
            style={{ width: 44, height: 4, background: "var(--color-line)" }}
          />
          <p dir="auto" className="mb-2 text-center text-[13px] font-bold text-ink-2">
            {title}
          </p>
          {children}
        </div>
      </div>
    </Portal>
  );
}
