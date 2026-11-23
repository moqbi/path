import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ar, relative } from "@/lib/format";
import { TOPIC_LABEL } from "@/lib/topics";
import { ticketState } from "@/lib/tickets";
import { StateChip } from "./state-chip";
import { TicketSignIn } from "./forms";

export const dynamic = "force-dynamic";

/**
 * نظامُ التذاكر (القاعدة ٤٨٠): بلا جلسةٍ بابُ الدخول، ومعها طلباتُه بأرقامها وحالها.
 */
export default async function TicketsPage() {
  const user = await currentUser();
  if (!user) return <SignIn />;

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
    <>
      <div className="mb-5 mt-2">
        <h1 className="text-[24px] font-extrabold" style={{ fontFamily: "var(--font-display)" }}>
          أهلاً {user.name}
        </h1>
        <p className="mt-1 text-[13px]" style={{ color: "rgba(253,252,248,.7)" }}>
          {rows.length === 0 ? "لا طلبات بعد — اكتب لنا من التطبيق: أنا ← الإعدادات ← الدعم الفني." : `${ar(rows.length)} طلب، ${ar(open)} مفتوح`}
        </p>
      </div>

      <div className="flex flex-col gap-2.5">
        {rows.map((row) => (
          <a key={row.id} href={`/tickets/${row.id}`} className="block rounded-2xl bg-card p-4 transition-transform hover:-translate-y-0.5">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="text-[13px] font-bold text-ink">طلب #{ar(row.number)}</span>
              <StateChip state={ticketState(row.closed, row.lockedAt, row.messages[0]?.fromStaff ?? null)} />
              {row.topic && TOPIC_LABEL[row.topic] ? (
                <span className="text-[11px] font-semibold text-muted">{TOPIC_LABEL[row.topic]}</span>
              ) : null}
              <span className="ms-auto shrink-0 text-[11px] text-faint">{relative(row.lastAt)}</span>
            </div>
            <p dir="auto" className="line-clamp-2 text-[13px] leading-relaxed text-ink-2">
              {row.body}
            </p>
            {row._count.messages ? (
              <p className="mt-1.5 text-[11px] text-faint">{ar(row._count.messages)} ردّ وتعليق</p>
            ) : null}
          </a>
        ))}
      </div>
    </>
  );
}

function SignIn() {
  return (
    <div className="mx-auto mt-6 max-w-[420px]">
      <h1 className="text-center text-[26px] font-extrabold" style={{ fontFamily: "var(--font-display)" }}>
        تابع طلباتك
      </h1>
      <p className="mb-5 mt-1.5 text-center text-[13.5px] leading-relaxed" style={{ color: "rgba(253,252,248,.72)" }}>
        ادخل بحسابك في آثار لتقرأ ردودنا وتعلّق عليها.
      </p>
      <div className="rounded-3xl bg-card p-5">
        <TicketSignIn />
      </div>
      <p className="mt-4 text-center text-[12.5px] leading-relaxed" style={{ color: "rgba(253,252,248,.65)" }}>
        دخلت التطبيق بآبل أو قوقل أو سناب أو تيك توك؟ افتح تذاكرك من التطبيق:
        <br />
        أنا ← الإعدادات ← الدعم الفني ← تذاكري.
      </p>
    </div>
  );
}
