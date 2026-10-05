"use client";

/** «تحميل PDF» نافذةُ طباعة المتصفّح — ومنها «احفظ PDF» (القاعدة ٢٥٦). */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print brand-gradient h-11 rounded-full px-5 text-[14px] font-bold"
      style={{ color: "var(--color-on-brand)" }}
    >
      تحميل PDF
    </button>
  );
}
