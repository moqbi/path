import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ar, relative } from "@/lib/format";
import { TOPIC_LABEL } from "@/lib/topics";
import { canComment, ticketState } from "@/lib/tickets";
import { StateChip } from "../state-chip";
import { CommentForm } from "../forms";

export const dynamic = "force-dynamic";

/**
 * تذكرةٌ واحدة (القاعدة ٤٨٠): رسالتُه الأولى، ثمّ ردودُ الفريق وتعليقاتُه بترتيبها،
 * ثمّ حقلُ التعليق حين يكون الدورُ له. لصاحبها وحده: معرّفُ غيره «غير موجود».
 */
export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/tickets");
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
  const can = canComment(ticket.lockedAt, ticket.closed, last);

  return (
    <>
      <a href="/tickets" className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: "rgba(253,252,248,.7)" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m9 6 6 6-6 6" />
        </svg>
        طلباتي
      </a>
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <h1 className="text-[24px] font-extrabold" style={{ fontFamily: "var(--font-display)" }}>
          طلب #{ar(ticket.number)}
        </h1>
        <StateChip state={ticketState(ticket.closed, ticket.lockedAt, last)} onDark />
        {ticket.topic && TOPIC_LABEL[ticket.topic] ? (
          <span className="text-[12px] font-semibold" style={{ color: "rgba(253,252,248,.7)" }}>
            {TOPIC_LABEL[ticket.topic]}
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-2.5">
        <Bubble who="أنت" at={ticket.createdAt} body={ticket.body} extra={ticket._count.files ? `${ar(ticket._count.files)} مرفق` : null} />
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
          <p className="rounded-2xl px-4 py-3 text-center text-[12.5px] leading-relaxed" style={{ background: "rgba(253,252,248,.08)", color: "rgba(253,252,248,.75)" }}>
            {can.why}
          </p>
        )}
      </div>
    </>
  );
}

function Bubble({ who, at, body, staff, extra }: { who: string; at: Date; body: string; staff?: boolean; extra?: string | null }) {
  return (
    <article
      className="rounded-2xl p-4"
      style={
        staff
          ? { background: "#fff6e2", boxShadow: "inset 0 0 0 1px rgba(246,185,59,.55)" }
          : { background: "var(--color-card)" }
      }
    >
      <div className="mb-1.5 flex items-center gap-2">
        {staff ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/athr-mark.png" alt="" width={18} height={18} style={{ width: 18, height: 18 }} />
        ) : null}
        <span className={`text-[12px] font-bold ${staff ? "text-clay-ink" : "text-ink"}`}>{who}</span>
        <span className="text-[11px] text-faint">{relative(at)}</span>
      </div>
      <p dir="auto" className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink">
        {body}
      </p>
      {extra ? <p className="mt-1.5 text-[11px] text-faint">{extra}</p> : null}
    </article>
  );
}
