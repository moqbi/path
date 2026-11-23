import type { TicketState } from "@/lib/tickets";
import { TICKET_STATE_LABEL } from "@/lib/tickets";

/** حالُ الطلب: المرجانيّ لما ينتظرنا، والكهرمانيّ لما رُدّ عليه، والباهت للمغلق. */
export function StateChip({ state, onDark = false }: { state: TicketState; onDark?: boolean }) {
  const style =
    state === "open"
      ? { background: "rgba(255,122,90,.14)", color: "#c8492b" }
      : state === "answered"
        ? { background: "rgba(246,185,59,.2)", color: "var(--color-clay-ink)" }
        : onDark
          ? { background: "rgba(253,252,248,.14)", color: "rgba(253,252,248,.85)" }
          : { background: "rgba(20,33,43,.07)", color: "var(--color-muted)" };
  return (
    <span className="shrink-0 rounded-full px-2.5 py-0.5 text-[10.5px] font-bold" style={style}>
      {TICKET_STATE_LABEL[state]}
    </span>
  );
}
