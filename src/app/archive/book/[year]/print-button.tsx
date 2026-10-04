"use client";

/** الطباعةُ من المتصفّح — ومنها «احفظ PDF»: لا مطبعةَ خلفنا (القاعدة ٢٤٤). */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print brand-gradient h-11 rounded-full px-5 text-[14px] font-bold"
      style={{ color: "var(--color-on-brand)" }}
    >
      اطبعه أو احفظه PDF
    </button>
  );
}
