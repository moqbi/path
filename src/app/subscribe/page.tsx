import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { cancelPlus, subscribe } from "@/app/actions";
import { BookIcon, CameraIcon, CircleIcon, MicIcon, SparkIcon, StoreIcon, WithIcon } from "@/components/icons";
import { TagPill } from "@/components/ui";
import { SUPPORTER_TAG } from "@/lib/supporter";
import { ScreenHeader } from "@/components/ui";

const PERKS = [
  // كما في الجوّال: النجمةُ والوسمُ أوّلاً، مرسومَين كما يظهران بجانب الاسم.
  {
    title: "نجمة التوثيق",
    body: "بجانب اسمك في كل مكان — في اللحظات والتعليقات والأصدقاء",
    icon: <SparkIcon size={18} />,
  },
  {
    title: "وسم «داعم»",
    body: "يظهر بجانب اسمك ما دام اشتراكك قائماً",
    icon: <TagPill tag={SUPPORTER_TAG} size={10} />,
  },
  {
    title: "تفاعل بأي إيموجي",
    body: "الخمسة الأساسية تبقى للجميع · لك كل كيبوردك",
    icon: <span className="text-[17px] leading-none">😊</span>,
  },
  {
    title: "أرشيف بلا نهاية",
    body: "المجاني يحفظ ٦ أشهر · أنت تحفظ كل شي وتصدّره",
    icon: <BookIcon size={18} />,
  },
  {
    title: "آثارنا",
    body: "كلُّ لحظةٍ جمعتك بصديقٍ بالإشارة «مع» — في خطٍّ واحد لكما",
    icon: <WithIcon size={18} />,
  },
  {
    title: "دوائر منفصلة",
    body: "العائلة، الشلة، الشغل — كل وحدة بخصوصيتها",
    icon: <CircleIcon size={18} />,
  },
  {
    title: "رسالة صوتية دقيقتان",
    body: "٢٠ ثانية للجميع · لك ١٢٠ ثانية في كل محادثة",
    icon: <MicIcon size={18} />,
  },
  {
    title: "صورة عرض متحركة",
    body: "GIF أو WebP متحركة · من ١٢٠×١٢٠ إلى ٣٢٠×٣٢٠ · حتى ٣ ميغابايت",
    icon: <CameraIcon size={18} />,
  },
  {
    title: "١٠٠٠ نقطة شهرياً في المتجر",
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
    /*
      الوضع الفاتح كبقية التطبيق: كانت الأرضية داكنة والحبر حبرَ الوضع
      الفاتح، فتُقرأ الصفحة شاشةً غريبة عن التطبيق الذي جاءت منه.
    */
    <div className="screen">
      <ScreenHeader title="آثار+" back="/" mark />

      <div className="shrink-0 px-6 pt-4">
        <span
          className="mb-4 inline-flex items-center gap-2 rounded-full px-3.5 py-2"
          style={{ background: "var(--color-gold-soft)" }}
        >
          <SparkIcon size={14} className="text-gold" />
          <span className="latin text-[12px] font-bold text-gold">ATHAR+</span>
        </span>

        <h1 className="mb-2.5 text-[30px] font-bold leading-snug">
          أصدقاؤك يبقون ١٥٠
          <br />
          <span className="brand-text">وكل شي غيرها يكبر</span>
        </h1>
        <p className="mb-5 text-[13px] leading-loose text-muted">
          لا نبيع أصدقاء إضافيين. نبيع ذاكرة أطول وتعبيراً أوسع.
        </p>
      </div>

      <main className="scroll-area px-6">
        {PERKS.map((perk) => (
          <div key={perk.title} className="mb-[18px] flex gap-3.5">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{ background: "var(--color-gold-soft)", color: "var(--color-gold)" }}
            >
              {perk.icon}
            </span>
            <div className="grow">
              <p className="mb-0.5 text-[14px] font-semibold">{perk.title}</p>
              <p className="text-[12px] leading-relaxed text-muted">{perk.body}</p>
            </div>
          </div>
        ))}

        {user.isPlus ? (
          <form action={cancelPlus} className="pt-4">
            <p className="mb-3 text-[13px] text-muted">أنت مشترك في آثار+ حالياً.</p>
            <button
              type="submit"
              className="w-full rounded-xl border border-line text-[14px] font-semibold text-muted"
              style={{ height: 50 }}
            >
              إلغاء الاشتراك
            </button>
          </form>
        ) : (
          <div className="flex gap-2.5 pt-2">
            <form action={monthly} className="grow">
              <button
                type="submit"
                className="w-full rounded-2xl border border-line px-3 py-4 text-center"
              >
                <span className="mb-1.5 block text-[11.5px] text-muted">شهري</span>
                <span className="block text-[26px] font-bold">٢٥</span>
                <span className="block text-[11px] text-faint">ريال / شهر</span>
              </button>
            </form>

            <form action={yearly} className="grow">
              <button
                type="submit"
                className="relative w-full rounded-2xl px-3 py-4 text-center"
                style={{
                  border: "1.5px solid var(--color-gold)",
                  background: "var(--color-gold-soft)",
                }}
              >
                <span
                  className="absolute -top-2.5 right-1/2 translate-x-1/2 whitespace-nowrap rounded-full px-2.5 py-1 text-[9.5px] font-bold"
                  style={{ background: "var(--color-gold)", color: "var(--color-on-brand)" }}
                >
                  وفّر ٣٣٪
                </span>
                <span className="mb-1.5 block text-[11.5px] text-gold">سنوي</span>
                <span className="block text-[26px] font-bold">١٩٩</span>
                <span className="block text-[11px] text-faint">ريال / سنة</span>
              </button>
            </form>
          </div>
        )}
      </main>

      <p className="px-6 pb-8 pt-5 text-center text-[10.5px] leading-loose text-faint">
        في النسخة الحقيقية يمر الدفع عبر متجر آبل أو جوجل إلزامياً · هنا تفعيل تجريبي فقط
      </p>
    </div>
  );
}
