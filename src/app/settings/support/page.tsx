import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ScreenHeader } from "@/components/ui";
import { InfoIcon } from "@/components/icons";
import { ar } from "@/lib/format";
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
    where: { userId: user.id, NOT: { topic: "beta" } },
    select: { closed: true },
  });

  return (
    <div className="screen">
      <ScreenHeader title="الدعم وتواصل معنا" back="/settings" />

      <main className="scroll-area px-5 py-4">
        <div className="mb-5 rounded-2xl border border-line bg-card p-4">
          <p className="mb-1 text-[13.5px] font-semibold">كيف نقدر نساعدك؟</p>
          <p className="mb-3 text-[11.5px] leading-relaxed text-muted">
            اكتب مشكلتك أو اقتراحك أو بلاغك، وتابع الردَّ عليه في «تذاكري» وبريدك.
          </p>
          <TicketForm />
        </div>

        {/*
          نظامُ التذاكر (القاعدة ٤٨٠): الرسائلُ وردودُها في «تذاكري» لا تحت النموذج —
          كانت تتكدّس هنا حتى يضيع النموذجُ نفسه.
        */}
        <a
          href="/tickets"
          className="flex items-center gap-3 rounded-2xl border border-line bg-card p-4"
        >
          <span className="min-w-0 grow">
            <span className="block text-[13.5px] font-bold text-ink">تذاكري</span>
            <span className="block text-[11.5px] text-muted">
              {tickets.length === 0
                ? "تابع طلباتك وردودنا عليها هنا"
                : `${ar(tickets.length)} طلب، ${ar(tickets.filter((ticket) => !ticket.closed).length)} مفتوح`}
            </span>
          </span>
          <span className="text-[18px] text-faint" aria-hidden>
            ‹
          </span>
        </a>

        <p className="flex items-center justify-center gap-2 py-6 text-center text-[11px] leading-relaxed text-faint">
          <InfoIcon size={13} />
          نقرأ كل رسالة · الردّ خلال يوم عمل
        </p>
      </main>
    </div>
  );
}
