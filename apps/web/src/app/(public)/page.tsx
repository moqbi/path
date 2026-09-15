import Link from "next/link";
import { AthrMark, TAGLINE_AR, TAGLINE_EN } from "@/components/brand";

const POINTS = [
  {
    title: "دائرةٌ مسقوفة بـ١٥٠",
    body: "عددٌ لا يُباع ولا يُزاد بأي مبلغ. فوقه تصير الشبكةُ جمهوراً، ومع الجمهور يُكتب ما يُعجبه لا ما جرى فعلاً.",
  },
  {
    title: "لا استكشاف ولا اقتراح أشخاص",
    body: "ما تراه يأتي ممّن أضفتَه بنفسك. لا تبويبَ يعرض غرباء، ولا خوارزميةً تختار لك — الأحدث أولاً وكفى.",
  },
  {
    title: "لحظاتٌ لا منشورات",
    body: "مكانٌ حللت به، أغنيةٌ تسمعها، خاطرة، صورة، نومٌ وصحو. سطرٌ صغير يقول أين أنت اليوم، لا مقالٌ يُكتب لأحد.",
  },
  {
    title: "ما يعرفه جهازك لا تكتبه بيدك",
    body: "المكان من إذن الموقع، والأغنية من رابطها، والساعة من الجهاز. أقلّ ما تُدخله بيدك أصدقُ ما يُقرأ عنك.",
  },
];

export default function LandingPage() {
  return (
    <>
      <section className="flex flex-col items-center gap-5 py-10 text-center">
        <AthrMark size={96} />
        <div>
          <h1 className="text-[30px] font-bold" style={{ fontFamily: "var(--font-display)" }}>
            {TAGLINE_AR}
          </h1>
          {/* سطرٌ لاتينيّ كامل: `dir="ltr"` وإلا قفزت نقطته إلى أوّله. */}
          <p dir="ltr" className="latin mt-2 text-[13px] text-muted">
            {TAGLINE_EN}
          </p>
        </div>
        <p className="prose text-center text-[15px] leading-[1.9] text-ink-2">
          شبكةٌ اجتماعية صغيرة بدائرةٍ محدودة: تنشر فيها لحظاتك لمن تعرفهم
          فعلاً، وتعلن حضورك لمن يهمّه. لا استكشاف، ولا غرباء، ولا سباقَ
          متابعين.
        </p>
        {/* لا زرّ تحميلٍ بعد: التطبيق لم يُنشر في المتجرين، ورابطٌ ميّت أسوأ من لا رابط. */}
        <p className="text-[12.5px] text-faint">التطبيق قادم إلى App Store و Google Play.</p>
      </section>

      <section className="grid gap-3 py-6 sm:grid-cols-2">
        {POINTS.map((point) => (
          <article key={point.title} className="rounded-2xl border border-line bg-card p-5">
            <h2 className="mb-2 text-[15px] font-bold">{point.title}</h2>
            <p className="text-[13.5px] leading-[1.9] text-ink-2">{point.body}</p>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-line bg-card p-6 text-center">
        <h2 className="mb-2 text-[16px] font-bold">عندك حساب؟</h2>
        <p className="mb-4 text-[13.5px] text-muted">
          الدخول من التطبيق. ومن الموقع تُفتح لوحة التحكّم للمشرفين، ويُحذف
          الحساب لمن أراد.
        </p>
        <div className="flex flex-wrap justify-center gap-2.5">
          <Link
            href="/contact"
            className="flex h-11 items-center rounded-xl px-5 text-[13px] font-bold"
            style={{ background: "var(--color-clay)", color: "var(--color-on-brand)" }}
          >
            تواصل معنا
          </Link>
          <Link
            href="/delete-account"
            className="flex h-11 items-center rounded-xl border border-line px-5 text-[13px] font-semibold"
          >
            حذف الحساب
          </Link>
        </div>
      </section>
    </>
  );
}
