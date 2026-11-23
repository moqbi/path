import type { TicketState } from "@/lib/tickets";

/** شارةُ حال الطلب: الردُّ باللمسة، والمراجعةُ رماديّة، والمغلقةُ باهتة. */
export function StateChip({ state, label }: { state: TicketState; label: string }) {
  const style =
    state === "answered"
      ? { background: "var(--color-clay-soft)", color: "var(--color-clay-ink)" }
      : state === "open"
        ? { background: "var(--color-chip)", color: "var(--color-ink-2)" }
        : { background: "var(--color-chip)", color: "var(--color-faint)" };
  return (
    <span className="rounded-full px-2.5 py-1 text-[10px] font-bold" style={style}>
      {label}
    </span>
  );
}
