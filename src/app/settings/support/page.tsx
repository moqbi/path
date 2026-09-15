import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ScreenHeader } from "@/components/ui";
import { InfoIcon } from "@/components/icons";
import { relative } from "@/lib/format";
import { TicketForm } from "./form";

/**
 * الدعم الفني: رسالةٌ تُكتب هنا وتُقرأ هنا.
 *
 * لا بريد إلكتروني يخرج من التطبيق: الرسالة تُحفظ ويقرؤها المشرف في
 * اللوحة ويردّ عليها، فيرى صاحبها ردَّه في مكان سؤاله — ويعرف أنها
 * وصلت. وهذا أيضاً ما يشترطه متجر آبل: وسيلة تواصلٍ داخل التطبيق.
 */
export default async function SupportPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const tickets = await prisma.supportTicket.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <div className="screen">
      <ScreenHeader title="الدعم وتواصل معنا" back="/settings/privacy" />

      <main className="scroll-area px-5 py-4">
        <div className="mb-5 rounded-2xl border border-line bg-card p-4">
          <p className="mb-1 text-[13.5px] font-semibold">كيف نقدر نساعدك؟</p>
          <p className="mb-3 text-[11.5px] leading-relaxed text-muted">
            اكتب مشكلتك أو اقتراحك أو بلاغك، ونردّ عليك في هذه الصفحة نفسها.
          </p>
          <TicketForm />
        </div>

        {tickets.length > 0 ? (
          <>
            <p className="mb-2 px-1 text-[11.5px] font-semibold tracking-wide text-faint">
              رسائلك
            </p>
            <div className="flex flex-col gap-2.5">
              {tickets.map((ticket) => (
                <article key={ticket.id} className="rounded-2xl border border-line bg-card p-4">
                  <div className="mb-1.5 flex items-center gap-2">
                    <span
                      className="rounded-full px-2.5 py-1 text-[10px] font-bold"
                      style={
                        ticket.reply
                          ? { background: "var(--color-clay-soft)", color: "var(--color-clay-ink)" }
                          : { background: "var(--color-chip)", color: "var(--color-muted)" }
                      }
                    >
                      {ticket.closed ? "مغلقة" : ticket.reply ? "رُدّ عليها" : "بانتظار الردّ"}
                    </span>
                    <span className="text-[10.5px] text-faint">{relative(ticket.createdAt)}</span>
                  </div>
                  <p dir="auto" className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink">
                    {ticket.body}
                  </p>
                  {ticket.reply ? (
                    <div
                      className="mt-3 rounded-xl p-3"
                      style={{ background: "var(--color-chip)" }}
                    >
                      <p className="mb-1 text-[10.5px] font-bold text-clay-ink">ردّ آثار</p>
                      <p dir="auto" className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink-2">
                        {ticket.reply}
                      </p>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </>
        ) : null}

        <p className="flex items-center justify-center gap-2 py-6 text-center text-[11px] leading-relaxed text-faint">
          <InfoIcon size={13} />
          نقرأ كل رسالة · الردّ خلال يوم عمل
        </p>
      </main>
    </div>
  );
}
