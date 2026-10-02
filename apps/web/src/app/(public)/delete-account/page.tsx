import type { Metadata } from "next";
import { DeleteForm } from "./form";
import { DocSection, PageBody, PageHero } from "@/components/page-shell";

export const metadata: Metadata = { title: "حذف الحساب · آثار مومنتس" };

/**
 * حذف الحساب من الموقع.
 *
 * شرط جوجل بلاي: طريقٌ إلى الحذف يبلغه من حذف التطبيق من جهازه، فلا
 * يبقى حسابه معلّقاً لأنّه لم يعد يملك الشاشة التي فيها الزرّ.
 */
export default function DeleteAccountPage() {
  return (
    <>
      <PageHero
        eyebrow="حسابك"
        title="حذف الحساب"
        lead="الحذف من هنا كالحذف من داخل التطبيق: فوريٌّ ونهائيّ، ولا يُستعاد شيءٌ بعده."
      />

      <PageBody narrow>
        <section className="doc-card" style={{ borderColor: "var(--color-live)" }}>
          <p>
            يذهب حسابك ومعه لحظاتك وصورك وقصصك وتعليقاتك ورسائلك الخاصة وما
            اشتريته من المتجر. ولو كان التطبيق بين يديك فاحذفه منه: «أنا» ←
            الإعدادات والخصوصية ← حذف الحساب.
          </p>
          <div className="mt-5">
            <DeleteForm />
          </div>
        </section>

        <DocSection index={1} title="ماذا يبقى بعد الحذف">
          <ul>
            <li>
              لا شيء يخصّك: صفُّك يذهب ومعه كلّ ما يشير إليه، وملفاتك تُمسح من
              التخزين السحابيّ لا من القاعدة وحدها.
            </li>
            <li>
              ما كتبه غيرك عنك — تعليقُ صديقٍ في لحظته هو — يبقى لصاحبه، بلا
              رابطٍ إلى حسابك.
            </li>
            <li>صفوفُ البلاغات التي قُدّمت ضدّ محتوى محذوف تبقى سجلّاً بلا اسمك.</li>
          </ul>
        </DocSection>
      </PageBody>
    </>
  );
}
