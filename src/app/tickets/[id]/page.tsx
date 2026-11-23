import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ScreenHeader } from "@/components/ui";
import { ar, relative } from "@/lib/format";
import { TOPIC_LABEL } from "@/lib/topics";
import { TICKET_STATE_LABEL, canComment, ticketState } from "@/lib/tickets";
import { StateChip } from "../state-chip";
import { CommentForm } from "./comment-form";

/**
 * تذكرةٌ واحدة (القاعدة ٤٨٠): رسالتُه الأولى، ثمّ ردودُ الفريق وتعليقاتُه بترتيبها،
 * ثمّ حقلُ التعليق حين يكون الدورُ له — بعد ردّ الموظّف، أو ليُعيد فتح المغلقة.
 * لصاحبها وحده: معرّفُ غيره «غير موجود» (القاعدة ٢٣ب).
 */
export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { id } = await params;

  const ticket = await prisma.supportTicket.findFirst({
    where: { id, userId: user.id },
    select: {
      id: true,
      number: true,
      body: true,
      topic: true,
      closed: true,
      lockedAt: true,
      createdAt: true,
      _count: { select: { files: true } },
      messages: { orderBy: { createdAt: "asc" }, select: { id: true, fromStaff: true, body: true, createdAt: true } },
    },
  });
  if (!ticket) notFound();

  const last = ticket.messages.at(-1)?.fromStaff ?? null;
  const state = ticketState(ticket.closed, ticket.lockedAt, last);
  const can = canComment(ticket.lockedAt, ticket.closed, last);

  return (
    <div className="screen">
      <ScreenHeader title={`طلب #${ar(ticket.number)}`} back="/tickets" />
      <main className="scroll-area px-5 py-4">
        <div className="mb-3 flex flex-wrap items-center gap-2 px-1">
          <StateChip state={state} label={TICKET_STATE_LABEL[state]} />
          {ticket.topic && TOPIC_LABEL[ticket.topic] ? (
            <span className="text-[11px] font-semibold text-ground-ink">{TOPIC_LABEL[ticket.topic]}</span>
          ) : null}
          <span className="text-[11px] text-ground-ink">{relative(ticket.createdAt)}</span>
        </div>

        <div className="flex flex-col gap-2.5">
          <Bubble who="أنت" at={ticket.createdAt} body={ticket.body} extra={ticket._count.files ? `${ar(ticket._count.files)} صورة مرفقة` : null} />
          {ticket.messages.map((message) => (
            <Bubble
              key={message.id}
              staff={message.fromStaff}
              who={message.fromStaff ? "فريق آثار" : "أنت"}
              at={message.createdAt}
              body={message.body}
            />
          ))}
        </div>

        <div className="mt-4">
          {can.ok ? (
            <CommentForm ticketId={ticket.id} reopen={ticket.closed} />
          ) : (
            <p className="rounded-2xl border border-line bg-card px-4 py-3 text-center text-[12px] leading-relaxed text-muted">
              {can.why}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

function Bubble({ who, at, body, staff, extra }: { who: string; at: Date; body: string; staff?: boolean; extra?: string | null }) {
  return (
    <article
      className="rounded-2xl border p-4"
      style={
        staff
          ? { background: "var(--color-clay-soft)", borderColor: "var(--color-clay)" }
          : { background: "var(--color-card)", borderColor: "var(--color-line)" }
      }
    >
      <div className="mb-1.5 flex items-center gap-2">
        <span className={`text-[11.5px] font-bold ${staff ? "text-clay-ink" : "text-ink"}`}>{who}</span>
        <span className="text-[10.5px] text-faint">{relative(at)}</span>
      </div>
      <p dir="auto" className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink">
        {body}
      </p>
      {extra ? <p className="mt-1.5 text-[10.5px] text-faint">{extra}</p> : null}
    </article>
  );
}
