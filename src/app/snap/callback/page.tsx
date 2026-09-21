import { SITE_URL } from "@/lib/site-url";

export const metadata = { title: "العودة إلى آثار" };

/**
 * صفحةُ الارتداد إلى التطبيق بعد الدخول بسناب.
 *
 * **سناب تقبل عنوان HTTPS ولا تقبل مخطّطَ التطبيق** (`athar://`)، فتعود
 * إلى هذه الصفحة، وهي تردّ المستخدم إلى التطبيق بمخطّطه ومعه ما جاء من
 * سناب كما هو.
 *
 * والارتدادُ في المتصفّح لا تحويلٌ من الخادم: `Location` إلى مخطّطٍ
 * غير http يُسقط بعض المتصفّحات، والصفحةُ تُبقي زرّاً لمن لم يرتدّ به
 * جهازُه — عودةٌ صامتةٌ لا تحدث أسوأ من شاشةٍ فيها زرّ.
 */
export default async function SnapCallback({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") query.set(key, value);
  }
  const deep = `athar://snap?${query.toString()}`;

  return (
    <div className="screen">
      <main className="scroll-area flex flex-col items-center justify-center gap-4 px-6 py-10 text-center">
        <p className="text-[15px] font-semibold">نرجعك إلى آثار…</p>
        <a
          href={deep}
          className="brand-gradient flex items-center justify-center rounded-xl px-6 text-[14.5px] font-bold"
          style={{ height: 50, color: "var(--color-on-brand)" }}
        >
          افتح التطبيق
        </a>
        <p className="text-[11.5px] text-muted">
          إن لم يفتح من نفسه، اضغط الزرّ. ومن فتح هذه الصفحة على حاسوبه يكمل من جواله.
        </p>

        {/*
           والارتدادُ بعد أن تُرسم الصفحة لا قبلها: مخطّطٌ غير http
           يُعلّق بعض المتصفّحات على شاشةٍ بيضاء، فتُرسم أوّلاً ويبقى
           الزرُّ ظاهراً لمن لم يرتدّ به جهازُه.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `setTimeout(function(){location.href=${JSON.stringify(deep)}},400)`,
          }}
        />
        {SITE_URL ? null : null}
      </main>
    </div>
  );
}
