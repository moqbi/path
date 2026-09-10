/**
 * إيصال الرسالة: صحٌّ واحد إذا خرجت، وصحّان إذا وصلت جهازه، ويتلوّنان
 * بلون العلامة إذا قرأها. ثلاث حالات تُقرأ بلمحة، بلا كلمة تُكتب.
 */
export type Receipt = "sent" | "delivered" | "read";

export function receiptOf(message: {
  deliveredAt: Date | null;
  readAt: Date | null;
}): Receipt {
  if (message.readAt) return "read";
  if (message.deliveredAt) return "delivered";
  return "sent";
}

const WORD: Record<Receipt, string> = {
  sent: "أُرسلت",
  delivered: "وصلت",
  read: "قُرئت",
};

export function Ticks({ state, size = 17 }: { state: Receipt; size?: number }) {
  return (
    <svg
      width={size}
      height={(size * 12) / 17}
      viewBox="0 0 17 12"
      fill="none"
      role="img"
      aria-label={WORD[state]}
      data-receipt={state}
      className="shrink-0"
      style={{ color: state === "read" ? "var(--color-clay)" : "var(--color-faint)" }}
    >
      <path
        d="M1 6.6 4.2 10 10.6 2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {state !== "sent" && (
        <path
          d="M6.6 6.9 8.6 9.3 15.6 1.4"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
