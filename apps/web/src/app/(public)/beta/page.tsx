import type { Metadata } from "next";
import { ContactForm } from "../contact/form";
import { DocSection, PageBody, PageHero } from "@/components/page-shell";

export const metadata: Metadata = { title: "فريق التجربة · آثار مومنتس" };

const STEPS = [
  {
    title: "سجّل اسمك وجهازك",
    body: "البريدُ الذي على حسابك في آبل أو قوقل: إليه تُرسَل الدعوة.",
  },
  {
    title: "تصلك الدعوة",
    body: "عبر TestFlight على الآيفون، أو اختبار Google Play على أندرويد — حين تُفتح نسخةٌ جديدة.",
  },
  {
    title: "جرّب وقل لنا",
    body: "النسخةُ التجريبية قد تتعثّر. ما تلاحظه يصلنا من «الدعم الفني» داخل التطبيق.",
  },
];

/**
 * «انضمّ إلى فريق التجربة» — من ذيل الموقع. الطلبُ رسالةُ دعمٍ بموضوع
 * `beta` تُقرأ في اللوحة كغيرها، والدعوةُ تُرسَل بيدٍ من TestFlight: لا
 * بابَ آليّ يضيف غريباً إلى نسخةٍ لم تُراجَع.
 */
export default function BetaPage() {
  return (
    <>
      <PageHero
        eyebrow="النسخ التجريبية"
        title="انضم إلى فريق التجربة"
        lead="جرّب ما نبنيه قبل أن يصل إلى الجميع، وكن أوّل من يرى الجديد ويقول رأيه فيه."
      />

      <PageBody narrow>
        <div className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <DocSection key={step.title} index={index + 1} title={step.title}>
              <p>{step.body}</p>
            </DocSection>
          ))}
        </div>

        <section className="doc-card">
          <h2 className="text-[18px] font-bold text-ink" style={{ fontFamily: "var(--font-display)" }}>
            سجّلني
          </h2>
          <p className="mb-4 mt-1 text-[13px] text-muted">المقاعدُ محدودة، ونرسل الدعوات على دفعات.</p>
          <ContactForm mode="beta" />
        </section>
      </PageBody>
    </>
  );
}
