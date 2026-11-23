import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ScreenHeader } from "@/components/ui";
import { ar, relative } from "@/lib/format";
import { TOPIC_LABEL } from "@/lib/topics";
import { TICKET_STATE_LABEL, ticketState } from "@/lib/tickets";
import { StateChip } from "./state-chip";

/**
 * نظامُ التذاكر (القاعدة ٤٨٠): كلُّ رسالةٍ إلى الدعم طلبٌ برقمه وحاله، والمحادثةُ فيه
 * لا في صفحة الدعم — كانت الرسائلُ وردودُها تتكدّس تحت النموذج حتى يضيع النموذج.
 * ويُفتح من الجوّال في المتصفّح المدمج بجلسةٍ تُفتح له (`/tickets/enter`).
 */
export default async function TicketsPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const rows = await prisma.supportTicket.findMany({
    where: { userId: user.id, NOT: { topic: "beta" } },
    orderBy: { lastAt: "desc" },
    take: 50,
    select: {
      id: true,
      number: true,
      body: true,
      topic: true,
      closed: true,
      lockedAt: true,
      lastAt: true,
      _count: { select: { messages: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { fromStaff: true } },
    },
  });
  const open = rows.filter((row) => !row.closed).length;

  return (
    <div className="screen">
      <ScreenHeader title="تذاكري" back="/settings/support" />
      <main className="scroll-area px-5 py-4">
        <div className="mb-4 flex items-center justify-between gap-3 px-1">
          <p className="text-[12px] text-ground-ink">
            {rows.length === 0
              ? "لا طلبات بعد."
              : `${ar(rows.length)} طلب، ${ar(open)} مفتوح`}
          </p>
          <Link
            href="/settings/support"
            className="rounded-full border border-line bg-card px-3.5 py-1.5 text-[12px] font-semibold text-clay-ink"
          >
            طلب جديد
          </Link>
        </div>

        <div className="flex flex-col gap-2.5">
          {rows.map((row) => {
            const state = ticketState(row.closed, row.lockedAt, row.messages[0]?.fromStaff ?? null);
            return (
              <Link
                key={row.id}
                href={`/tickets/${row.id}`}
                className="block rounded-2xl border border-line bg-card p-4"
              >
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="text-[12.5px] font-bold text-ink">طلب #{ar(row.number)}</span>
                  <StateChip state={state} label={TICKET_STATE_LABEL[state]} />
                  {row.topic && TOPIC_LABEL[row.topic] ? (
                    <span className="text-[10.5px] font-semibold text-ink-2">{TOPIC_LABEL[row.topic]}</span>
                  ) : null}
                  <span className="ms-auto text-[10.5px] text-faint">{relative(row.lastAt)}</span>
                </div>
                <p dir="auto" className="line-clamp-2 text-[12.5px] leading-relaxed text-muted">
                  {row.body}
                </p>
                {row._count.messages ? (
                  <p className="mt-1.5 text-[10.5px] text-faint">{ar(row._count.messages)} ردّ وتعليق</p>
                ) : null}
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
