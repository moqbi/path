import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "الوظائف · ATHAR Moments" };

export default function CareersPage() {
  return (
    <article className="prose">
      <h1 className="text-[24px] font-bold" style={{ fontFamily: "var(--font-display)" }}>
        الوظائف
      </h1>

      <p>
        لا شواغر معلنة اليوم. والفريق صغيرٌ عمداً: كلُّ من فيه يكتب أو يرسم
        أو يقرّر، ولا طبقةَ بينهم وبين التطبيق.
      </p>

      <h2>إن أردت أن تكون أوّل من نكلّمه</h2>
      <p>
        أرسل لنا سطرين عمّا تحسنه ورابطاً لشيءٍ صنعته — لا سيرةً ذاتية
        بصفحتين. نقرأ كل ما يصل، ونردّ على ما يناسبنا.
      </p>
      <p>
        <Link href="/contact" className="font-semibold text-clay-ink">
          اكتب لنا من هنا ←
        </Link>
      </p>
    </article>
  );
}
