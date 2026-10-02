import type { Metadata } from "next";
import { ContactForm } from "./form";
import { DocSection, PageBody, PageHero } from "@/components/page-shell";
import { SITE_URL, hasSite } from "@athar/shared";
import { siteText } from "@/lib/site";

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
  // حسابُ الدعم والأخبار (القاعدة ٢٢١) — رقمُه من اللوحة، والأرقامُ العربيّة تُحوَّل.
  const text = await siteText();
  const digits = text["support.member"].replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).trim();
  const supportNo = /^\d{1,9}$/.test(digits) ? digits : null;
  const supportPath = supportNo ? `/u/${supportNo}` : null;

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
            {/*
              خاتمةُ النموذج: صفحةُ حساب الدعم، ومنها «افتح في التطبيق» —
              فيُضاف ويُراسَل بلا انتظار قبول (القاعدة ٢٢١).
            */}
            {supportPath ? (
              <p className="mt-4 text-[13px] leading-relaxed text-muted">
                لمتابعة آخر الأخبار والتواصل مع الدعم داخل التطبيق{" "}
                <a href={supportPath} dir="ltr" className="font-bold text-clay-ink underline-offset-2 hover:underline">
                  {hasSite() ? `${SITE_URL.replace(/\/+$/, "")}${supportPath}` : supportPath}
                </a>
              </p>
            ) : null}
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
          </div>
        </div>
      </PageBody>
    </>
  );
}
