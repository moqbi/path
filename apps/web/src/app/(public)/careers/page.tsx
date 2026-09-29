import type { Metadata } from "next";
import { ContactForm } from "../contact/form";
import { DocSection, PageBody, PageHero } from "@/components/page-shell";

export const metadata: Metadata = { title: "الوظائف · آثار مومنتس" };

const VALUES = [
  {
    title: "فريقٌ صغير عمداً",
    body: "كلُّ من فيه يكتب أو يرسم أو يقرّر، ولا طبقةَ بينه وبين التطبيق.",
  },
  {
    title: "ما صنعتَه قبل ما كتبتَه",
    body: "رابطٌ لشيءٍ بنيته أو رسمته يقول عنك أكثر من سيرةٍ بصفحتين.",
  },
  {
    title: "نقرأ كلَّ طلب",
    body: "لا شواغر معلنة اليوم — ومن يكتب الآن أوّلُ من نكلّمه حين تُفتح.",
  },
];

export default function CareersPage() {
  return (
    <>
      <PageHero
        eyebrow="انضمّ إلينا"
        title="الوظائف"
        lead="نبني شبكةً اجتماعيةً بدائرةٍ محدودة، من السعودية وللخليج. إن كان هذا يشبهك، عرّفنا بنفسك."
      />

      <PageBody>
        <div className="grid gap-4 sm:grid-cols-3">
          {VALUES.map((value, index) => (
            <DocSection key={value.title} index={index + 1} title={value.title}>
              <p>{value.body}</p>
            </DocSection>
          ))}
        </div>

        <section className="doc-card">
          <h2 className="text-[18px] font-bold text-ink" style={{ fontFamily: "var(--font-display)" }}>
            قدّم طلبك
          </h2>
          <p className="mb-4 mt-1 text-[13px] text-muted">
            سطران عمّا تحسنه، ومعهما سيرتك أو نماذجُ من أعمالك إن شئت.
          </p>
          <ContactForm mode="careers" />
        </section>
      </PageBody>
    </>
  );
}
