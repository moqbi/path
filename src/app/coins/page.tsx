import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ScreenHeader } from "@/components/ui";
import { SparkIcon } from "@/components/icons";
import { coinText, riyals } from "@/lib/format";

/**
 * شحن النقاط في الويب — **عرضٌ لا شراء**.
 *
 * شراءُ آبل وجوجل يجري في التطبيق الأصليّ وحده: لا يفتح المتصفّح
 * نافذتهما بحال، ولا بوّابةَ دفعٍ عندنا تُغني عنهما — والسلعُ الرقمية
 * لا تُباع بغير IAP (القاعدة ٧٣ج). فهذه الصفحة تقول ما يُباع وبكم،
 * وتقول أين يُشترى.
 *
 * وكانت لافتةَ الرصيد في المتجر لا تفتح شيئاً: ضغطةٌ تموت تحت الإصبع
 * تُقرأ عطلاً، ومن ضغطها يريد أن يشحن — فالأقلّ أن يعرف كم يكلّف وأين.
 *
 * وباقةٌ بلا `sku` مسوّدةٌ لم تُربط بالمتجر بعد، فلا تُعرض هنا كما لا
 * تُعرض على الجوّال — لا نُسعّر ما لا يُباع.
 */
export default async function CoinsPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const packs = await prisma.coinPack.findMany({
    where: { hidden: false, NOT: { sku: "" } },
    orderBy: [{ sortOrder: "asc" }, { coins: "asc" }],
    select: { id: true, name: true, coins: true, priceHalalas: true },
  });

  return (
    <div className="screen">
      <ScreenHeader title="شحن النقاط" back="/store" mark />

      <div className="scroll-area px-5 pb-10 pt-4">
        <div
          className="mb-5 flex items-center gap-2.5 rounded-2xl border p-4"
          style={{ background: "var(--color-gold-soft)", borderColor: "var(--color-gold-line)" }}
        >
          <SparkIcon size={20} className="text-gold" />
          <div className="min-w-0 grow">
            <p className="text-[12px] font-semibold" style={{ color: "var(--color-clay-ink)" }}>
              رصيدك الآن
            </p>
            <p className="text-[19px] font-bold">{coinText(user.coins)}</p>
          </div>
        </div>

        {packs.length === 0 ? (
          <div className="rounded-2xl border border-line bg-card p-6 text-center">
            <p className="mb-1.5 text-[14px] font-bold">لا باقات متاحة الآن</p>
            <p className="text-[12.5px] leading-relaxed text-muted">
              الشحن يمرّ بمتجر جهازك، وباقاتُنا تنتظر أن تُنشر هناك.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {packs.map((pack) => (
              <div
                key={pack.id}
                className="flex items-center gap-3 rounded-2xl border border-line bg-card p-4"
              >
                <SparkIcon size={18} className="text-gold" />
                <div className="min-w-0 grow">
                  <p className="text-[14.5px] font-bold">{pack.name}</p>
                  <p className="mt-0.5 text-[11.5px] text-muted">{coinText(pack.coins)}</p>
                </div>
                <span className="text-[13.5px] font-bold" style={{ color: "var(--color-clay-ink)" }}>
                  {riyals(pack.priceHalalas)}
                </span>
              </div>
            ))}
          </div>
        )}

        <p className="mt-5 rounded-2xl border border-line bg-card p-4 text-[12.5px] leading-relaxed text-muted">
          الشحن يتمّ من تطبيق آثار مومنتس على جوّالك: يفتح المتجرُ نافذةَ
          الدفع، ويصل الرصيد إلى حسابك نفسه أينما دخلتَ منه.
        </p>
      </div>
    </div>
  );
}
