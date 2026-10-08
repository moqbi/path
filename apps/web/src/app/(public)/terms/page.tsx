import Link from "next/link";
import type { Metadata } from "next";
import { DocIndex, DocSection, EnglishSummary, PageBody, PageHero } from "@/components/page-shell";

export const metadata: Metadata = { title: "شروط الاستخدام · Terms of Service · آثار مومنتس ATHAR Moments" };

export default function TermsPage() {
  return (
    <>
      <PageHero eyebrow="القانوني" title="شروط الاستخدام" lead="ما لك وما عليك في آثار: حسابك، وما يُنشر، والمتجر والاشتراك.">
        <p lang="en" dir="ltr" className="mt-3 text-[13px]" style={{ color: "#cfd8df", fontFamily: "var(--font-latin)" }}>
          ATHAR Moments — Terms of Service · <a href="#english" className="underline">English summary</a>
        </p>
      </PageHero>
      <PageBody narrow>
        <p className="doc-card text-[14px] leading-[1.9] text-ink-2">
          هذه شروط استخدام تطبيق <strong>«آثار مومنتس» (ATHAR Moments)</strong> على iPhone
          وAndroid، والموقع atharmts.com وتطبيق الويب فيه.
        </p>

        <EnglishSummary title="ATHAR Moments — Terms of Service (English summary)" updated="October 2026">
          <p>
            These Terms govern your use of the <strong>ATHAR Moments</strong> app (&ldquo;ATHAR&rdquo;,
            &ldquo;we&rdquo;) for iPhone and Android and the website atharmts.com. By creating an account or
            signing in to ATHAR Moments you agree to these Terms and to our{" "}
            <Link href="/privacy" className="underline">Privacy Policy</Link>. The Arabic text below is the
            authoritative version.
          </p>
          <ul>
            <li>
              <strong>Your account:</strong> one account per person. You are responsible for what is posted
              from it. You must be at least 13 years old.
            </li>
            <li>
              <strong>Prohibited content:</strong> harassment, threats or doxxing; hate, violence or sexual
              content; spam and automated accounts; anything that violates the laws of Saudi Arabia.{" "}
              <strong>There is zero tolerance for objectionable content or abusive users.</strong>
            </li>
            <li>
              <strong>Reporting and blocking:</strong> any moment, story, comment or message can be reported
              in the app, and any user can be blocked. We review reports within 24 hours, remove violating
              content and suspend or delete the offending account.
            </li>
            <li>
              <strong>Your content:</strong> what you post remains yours. You grant us permission to store it
              and show it only to the people you choose; this ends when you delete it or your account. Do not
              post material you do not have the right to share.
            </li>
            <li>
              <strong>Store and subscription:</strong> store items (frames, themes, charms) are digital
              cosmetics with no cash value. ATHAR+ is an auto-renewing subscription purchased and cancelled
              through the App Store or Google Play; refunds follow that store&rsquo;s policy. The 150-friend
              circle limit is never sold.
            </li>
            <li>
              <strong>Termination:</strong> you may delete your account at any time in the app or at{" "}
              <Link href="/delete-account" className="underline">atharmts.com/delete-account</Link>. We may
              suspend accounts that break these Terms and will tell you why.
            </li>
            <li>
              <strong>No absolute warranties:</strong> we work to keep the service available and your data
              safe, but cannot guarantee zero downtime or errors.
            </li>
            <li>
              <strong>Governing law:</strong> the laws of the Kingdom of Saudi Arabia.
            </li>
            <li>
              <strong>Contact:</strong> support@atharmts.com ·{" "}
              <Link href="/contact" className="underline">atharmts.com/contact</Link>.
            </li>
          </ul>
        </EnglishSummary>

        <DocIndex
          updated="أكتوبر ٢٠٢٦"
          sections={[
            { id: "terms-1", title: "حسابك" },
            { id: "terms-2", title: "ما لا يُنشر" },
            { id: "terms-3", title: "ما تنشره يبقى لك" },
            { id: "terms-4", title: "المتجر والاشتراك" },
            { id: "terms-5", title: "إيقاف الخدمة" },
            { id: "terms-6", title: "بلا ضمانات مطلقة" },
            { id: "terms-7", title: "النظام الحاكم" },
          ]}
        />

        <DocSection id="terms-1" index={1} title="حسابك">
          <p>
            حسابٌ واحد لشخصٍ واحد، ببريدٍ تملكه وكلمةِ مرورٍ تحفظها. أنت مسؤولٌ
            عمّا يُنشر منه، فإن ضاع منك جهازُك غيّر كلمة مرورك. وآثار ليست لمن هم دون
            الثالثة عشرة.
          </p>
        </DocSection>

        <DocSection id="terms-2" index={2} title="ما لا يُنشر">
          <ul>
            <li>ما يسيء إلى شخصٍ بعينه أو يهدّده أو يكشف بياناته.</li>
            <li>الكراهية والعنف والمحتوى الجنسي.</li>
            <li>الإعلان والإزعاج والحسابات الآلية.</li>
            <li>ما يخالف أنظمة المملكة العربية السعودية.</li>
          </ul>
          <p>
            <strong>لا تسامح مطلقاً مع المحتوى المسيء أو المستخدمين المسيئين.</strong>{" "}
            بإنشاء حسابٍ أو الدخول إلى آثار توافق على هذه الشروط.
          </p>
          <p>
            ويُبلَّغ عن أي لحظةٍ أو قصةٍ أو تعليقٍ أو رسالة من داخل التطبيق، ويُحظر
            أيُّ حساب — والحظر في الاتجاهين، فيختفي محتوى المحظور عنك في الحال.
            نقرأ البلاغات بأنفسنا خلال ٢٤ ساعة: نحذف المحتوى المخالف ونوقف حسابَ
            صاحبه أو نحذفه. ولا حذفَ تلقائيّاً ببلاغٍ واحد، فالإبلاغُ الذي يحذف
            يصير سلاحاً يُسكت به الناسُ بعضهم.
          </p>
        </DocSection>

        <DocSection id="terms-3" index={3} title="ما تنشره يبقى لك">
          <p>
            لحظاتك وصورك ملكك. وبنشرها تأذن لنا بتخزينها وعرضها لمن اخترتَهم —
            لهذا الغرض وحده، وينتهي الإذن بحذفك لها أو لحسابك.
          </p>
          <p>
            وأنت مسؤولٌ عمّا تضيفه إلى قصصك ولحظاتك من صوتٍ أو موسيقى أو صورٍ ليست
            لك: لا تنشر ما لا تملك حقّ نشره. ونحذف ما يُبلَّغ عنه أنّه ينتهك حقوق
            غيرك — صاحبُ الحقّ يراسلنا من «تواصل معنا».
          </p>
        </DocSection>

        <DocSection id="terms-4" index={4} title="المتجر والاشتراك">
          <ul>
            <li>
              ما يُشترى في المتجر — إطارٌ أو ثيمٌ أو تميمة — زينةٌ رقمية لحسابك،
              لا سلعةٌ تُسترجع قيمتها ولا تُحوَّل إلى مال.
            </li>
            <li>
              «آثار+» اشتراكٌ يتجدّد بمدّته، ويُلغى من إعدادات المتجر الذي اشتُري
              منه (App Store أو Google Play). والاسترجاع يخضع لسياسة ذلك المتجر
              لا لسياستنا.
            </li>
            <li>
              سقفُ الدائرة مئةٌ وخمسون، ولا يُزاد بشراءٍ ولا باشتراك — ولن
              نبيعه.
            </li>
          </ul>
        </DocSection>

        <DocSection id="terms-5" index={5} title="إيقاف الخدمة">
          <p>
            تستطيع حذف حسابك متى شئت، من التطبيق أو{" "}
            <Link href="/delete-account" className="font-semibold text-clay-ink">
              من هنا
            </Link>
            . ونستطيع إيقاف حسابٍ يخالف هذه الشروط، ونخبرك بالسبب حين نفعل.
          </p>
        </DocSection>

        <DocSection id="terms-6" index={6} title="بلا ضمانات مطلقة">
          <p>
            نبذل ما نستطيع لتبقى الخدمة عاملةً وبياناتك سليمة، ولا نضمن انقطاعاً
            صفراً ولا خلوّاً تامّاً من الخطأ. وما تحتفظ به من نسخ لصورك عندك
            يبقى مسؤوليتك.
          </p>
        </DocSection>

        <DocSection id="terms-7" index={7} title="النظام الحاكم">
          <p>
            تخضع هذه الشروط لأنظمة المملكة العربية السعودية، وما ينشأ عنها من
            خلافٍ تنظره محاكمها المختصّة.
          </p>
        </DocSection>
      </PageBody>
    </>
  );
}
