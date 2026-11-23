import type { Metadata } from "next";
import { ContactForm } from "./form";
import { DocSection, PageBody, PageHero } from "@/components/page-shell";

export const metadata: Metadata = { title: "تواصل معنا · آثار مومنتس" };

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}

/**
 * تواصل معنا: عمودان على الشاشة العريضة — الطرقُ إلينا ومتى نردّ، ثمّ
 * النموذج في بطاقته — وعمودٌ واحد على الهاتف والنموذجُ أوّلاً: من فتح
 * الصفحة جاء ليكتب.
 */
export default async function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="الدعم"
        title="تواصل معنا"
        lead="مشكلةٌ أو اقتراحٌ أو سؤالٌ عن بياناتك — اكتب لنا، ونردّ على بريدك."
      />

      <PageBody>
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <section className="doc-card">
            <h2 className="mb-4 text-[18px] font-bold text-ink" style={{ fontFamily: "var(--font-display)" }}>
              اكتب رسالتك
            </h2>
            <ContactForm />
          </section>

          <div className="flex flex-col gap-4">
            <DocSection
              icon={
                <Icon>
                  <rect x="6" y="2.5" width="12" height="19" rx="3" />
                  <path d="M10.5 18.5h3" />
                </Icon>
              }
              title="عندك حساب؟"
            >
              <p>
                أسرعُ طريقٍ هو «الدعم الفني» داخل التطبيق (أنا ← الإعدادات): رسالتُك
                تصلنا وتقرأ ردّنا في مكان سؤالك.
              </p>
            </DocSection>

            <DocSection
              icon={
                <Icon>
                  <circle cx="12" cy="12" r="8.5" />
                  <path d="M12 7.5V12l3 2" />
                </Icon>
              }
              title="متى نردّ"
            >
              <p>
                نقرأ كل ما يصل، وما يخصّ بلاغاً عن محتوى يُعالَج أوّلاً. ومن هنا يكتب
                من لا حساب له — أو من حُذف حسابه فلم يبقَ له باب.
              </p>
            </DocSection>

            {/* نظامُ التذاكر (القاعدة ٤٨٠): كلُّ رسالةٍ طلبٌ برقمه وحاله، ويُتابَع من هنا. */}
            <DocSection
              icon={
                <Icon>
                  <path d="M4 7.5A1.5 1.5 0 0 1 5.5 6h13A1.5 1.5 0 0 1 20 7.5v2a2.5 2.5 0 0 0 0 5v2a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5v-2a2.5 2.5 0 0 0 0-5Z" />
                  <path d="M14 6v12" strokeDasharray="2 2.2" />
                </Icon>
              }
              title="نظام التذاكر"
            >
              <p>
                كلُّ رسالةٍ تصلنا من التطبيق طلبٌ برقمه: تتابع حاله وتقرأ ردودنا وتعلّق عليها
                بحسابك في آثار.
              </p>
              <a
                href="/tickets"
                className="brand-gradient mt-3 flex items-center justify-center rounded-xl text-[14px] font-bold"
                style={{ height: 44, color: "var(--color-on-brand)" }}
              >
                افتح نظام التذاكر
              </a>
            </DocSection>
          </div>
        </div>
      </PageBody>
    </>
  );
}
