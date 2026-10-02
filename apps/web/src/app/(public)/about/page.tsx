import type { Metadata } from "next";
import { DocSection, PageBody, PageHero } from "@/components/page-shell";

export const metadata: Metadata = { title: "عن آثار مومنتس · ATHAR Moments" };

/*
  لا تُذكر تطبيقاتٌ أخرى في صفحات الموقع — **بقرار المالك**: آثار تُعرَّف بما
  هي، لا بمقارنتها بغيرها.
*/
const ICON = {
  name: <path d="M4 19c4-1 6-5 8-9s4-6 8-6M8 19h12" />,
  circle: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2.5" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </>
  ),
  bag: (
    <>
      <path d="M5 8h14l-1 12H6Z" />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11Z" />
      <circle cx="12" cy="10" r="2.3" />
    </>
  ),
};

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="عن آثار"
        title="لحظاتك، مع ناسك"
        lead="شبكةٌ اجتماعية حميمية بدائرةٍ محدودة: مئةٌ وخمسون شخصاً لا أكثر، تنشر لهم لحظاتك وتعلن لهم حضورك — مبنيّةٌ على كيف يُستعمل الهاتف في الخليج فعلاً."
      />

      <PageBody>
        <DocSection icon={<Icon>{ICON.name}</Icon>} title="لماذا هذا الاسم">
          <p>
            الاسم الكامل <strong>آثار مومنتس</strong> —{" "}
            <span className="latin" dir="ltr">
              ATHAR Moments
            </span>
            . و<strong>الأثر</strong> ما يبقى بعد مرور الشيء: علامةُ قدمٍ على رمل،
            وخبرٌ يُروى عمّن سبق. و<strong>آثار</strong> جمعُه — فما تنشره هنا ليس
            منشوراً يُستهلك في ثانية، بل أثرٌ يبقى في خطٍّ زمنيٍّ تعود إليه بعد سنة
            فتقرأ سنتك.
          </p>
          <p className="latin" dir="ltr" style={{ textAlign: "left", letterSpacing: "normal" }}>
            <strong>ATHAR Moments</strong> — the Arabic word <em>athar</em> means a
            trace: the mark a thing leaves behind. Not a feed. A record of the moments
            you lived, kept for the hundred and fifty people who were there for them.
          </p>
        </DocSection>

        <div className="grid gap-4 sm:grid-cols-2">
          <DocSection icon={<Icon>{ICON.circle}</Icon>} title="لماذا سقفٌ للدائرة">
            <p>
              لأنّ ما فوق المئة والخمسين ليس دائرةً بل جمهور. والجمهورُ يغيّر ما
              يُكتب: تُنشر الصورةُ التي تُعجب لا اليومُ الذي جرى. السقف هو المنتج،
              ولا يُباع بأي مبلغ ولا يُزاد باشتراك.
            </p>
          </DocSection>

          <DocSection icon={<Icon>{ICON.lock}</Icon>} title="لماذا لا استكشاف">
            <p>
              ما تراه في آثار يأتي ممّن أضفته بنفسك وقبلتَ إضافته. لا بحثَ بالاسم
              ولا بالبريد، ولا صفحةَ تعرض لحظاتك لغرباء — والإضافةُ برابطٍ تعطيه
              لمن تعرف، فلا يصلك غريب.
            </p>
          </DocSection>

          <DocSection icon={<Icon>{ICON.bag}</Icon>} title="ما تبيعه آثار">
            <p>
              إطاراتٌ وثيماتٌ وتمائم — أشياء تزيّن حسابك ولا تنقص قيمة التطبيق لمن
              حولك. ولا صناديق عشوائية: السعر مكتوبٌ وما تشتريه تراه قبل أن تدفع.
            </p>
          </DocSection>

          <DocSection icon={<Icon>{ICON.pin}</Icon>} title="أين نحن">
            <p>
              فريقٌ صغير في السعودية. البيانات في قاعدةٍ نملكها ونستطيع نقلها إلى
              خادمٍ داخل المملكة في يوم، والملفات في تخزينٍ لا يحبسنا فيه أحد.
            </p>
          </DocSection>
        </div>
      </PageBody>
    </>
  );
}
