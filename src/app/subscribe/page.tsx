import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { cancelPlus, subscribe } from "@/app/actions";
import {
  BookIcon,
  CloseIcon,
  ReactionFace,
  SparkIcon,
  StoreIcon,
} from "@/components/icons";

const PERKS = [
  {
    title: "تفاعل بأي إيموجي",
    body: "الخمسة الأساسية تبقى للجميع · لك كل كيبوردك",
    icon: <ReactionFace kind="SMILE" size={18} color="#d9b863" />,
  },
  {
    title: "أرشيف بلا نهاية",
    body: "المجاني يحفظ ٦ أشهر · أنت تحفظ كل شي وتصدّره",
    icon: <BookIcon size={18} />,
  },
  {
    title: "دوائر منفصلة",
    body: "العائلة، الشلة، الشغل — كل وحدة بخصوصيتها",
    icon: <SparkIcon size={18} />,
  },
  {
    title: "٣٠ ر.س رصيد شهري في المتجر",
    body: "وخصم ٢٠٪ على كل شي · إطارات حصرية",
    icon: <StoreIcon size={18} />,
  },
];

export default async function SubscribePage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const monthly = subscribe.bind(null, "MONTHLY");
  const yearly = subscribe.bind(null, "YEARLY");

  return (
    <div
      className="flex min-h-dvh flex-col"
      style={{ background: "var(--color-night)", color: "var(--color-paper)" }}
    >
      <div className="flex justify-start px-5 pt-4">
        <Link
          href="/me"
          aria-label="إغلاق"
          className="flex h-10 w-10 items-center justify-center"
          style={{ color: "#8e857b" }}
        >
          <CloseIcon size={19} />
        </Link>
      </div>

      <div className="px-6 pt-1.5">
        <span
          className="mb-4 inline-flex items-center gap-2 rounded-full px-3.5 py-2"
          style={{ background: "rgba(169,128,56,.16)" }}
        >
          <SparkIcon size={14} className="text-[#d9b863]" />
          <span className="text-[12px] font-semibold" style={{ color: "#d9b863" }}>
            أثر+
          </span>
        </span>
        <h1
          className="mb-2.5 text-[30px] leading-snug"
          style={{ fontFamily: "var(--font-display)" }}
        >
          دائرتك تبقى ١٥٠
          <br />
          وكل شي غيرها يكبر
        </h1>
        <p className="mb-6 text-[13px] leading-loose" style={{ color: "#a69c92" }}>
          لا نبيع أصدقاء إضافيين. نبيع ذاكرة أطول وتعبيراً أوسع.
        </p>
      </div>

      <main className="grow px-6">
        {PERKS.map((perk) => (
          <div key={perk.title} className="mb-4.5 flex gap-3.5" style={{ marginBottom: 18 }}>
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{ background: "rgba(217,184,99,.14)", color: "#d9b863" }}
            >
              {perk.icon}
            </span>
            <div className="grow">
              <p className="mb-0.5 text-[14px] font-semibold">{perk.title}</p>
              <p className="text-[12px] leading-relaxed" style={{ color: "#a69c92" }}>
                {perk.body}
              </p>
            </div>
          </div>
        ))}

        {user.isPlus ? (
          <form action={cancelPlus} className="pt-4">
            <p className="mb-3 text-[13px]" style={{ color: "#a69c92" }}>
              أنت مشترك في أثر+ حالياً.
            </p>
            <button
              type="submit"
              className="w-full rounded-xl border text-[14px] font-semibold"
              style={{ height: 50, borderColor: "#3a342e", color: "#a69c92" }}
            >
              إلغاء الاشتراك
            </button>
          </form>
        ) : (
          <div className="flex gap-2.5 pt-2">
            <form action={monthly} className="grow">
              <button
                type="submit"
                className="w-full rounded-2xl border px-3 py-4 text-center"
                style={{ borderColor: "#3a342e" }}
              >
                <span className="mb-1.5 block text-[11.5px]" style={{ color: "#a69c92" }}>
                  شهري
                </span>
                <span className="block text-[26px]" style={{ fontFamily: "var(--font-display)" }}>
                  ٢٥
                </span>
                <span className="block text-[11px]" style={{ color: "#8e857b" }}>
                  ريال / شهر
                </span>
              </button>
            </form>

            <form action={yearly} className="grow">
              <button
                type="submit"
                className="relative w-full rounded-2xl px-3 py-4 text-center"
                style={{ border: "1.5px solid #d9b863", background: "rgba(217,184,99,.08)" }}
              >
                <span
                  className="absolute -top-2.5 right-1/2 translate-x-1/2 whitespace-nowrap rounded-full px-2.5 py-1 text-[9.5px] font-bold"
                  style={{ background: "#d9b863", color: "var(--color-night)" }}
                >
                  وفّر ٣٣٪
                </span>
                <span className="mb-1.5 block text-[11.5px]" style={{ color: "#d9b863" }}>
                  سنوي
                </span>
                <span className="block text-[26px]" style={{ fontFamily: "var(--font-display)" }}>
                  ١٩٩
                </span>
                <span className="block text-[11px]" style={{ color: "#8e857b" }}>
                  ريال / سنة
                </span>
              </button>
            </form>
          </div>
        )}
      </main>

      <p
        className="px-6 pb-8 pt-5 text-center text-[10.5px] leading-loose"
        style={{ color: "#7a716a" }}
      >
        في النسخة الحقيقية يمر الدفع عبر متجر آبل أو جوجل إلزامياً · هنا تفعيل تجريبي فقط
      </p>
    </div>
  );
}
