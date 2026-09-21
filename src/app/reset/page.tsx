import Link from "next/link";
import { ResetForm } from "./form";

export const metadata = { title: "اضبط كلمة المرور · آثار مومنتس" };

/**
 * ضبطُ كلمة المرور بالرابط.
 *
 * والرمزُ يبقى في الشاشة حتى يُرسَل مع النموذج — ولا يُستهلك بمجرّد
 * الفتح: زاحفُ بريدٍ يفتح الروابط ليفحصها، فلو استُهلك عند العرض لوصل
 * صاحبُه إلى رابطٍ «انتهى» قبل أن يلمسه.
 */
export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <div className="screen">
      <main className="scroll-area flex flex-col justify-center px-6 py-10">
        <h1 className="mb-2 text-center text-[20px] font-bold">اضبط كلمة المرور</h1>

        {token ? (
          <>
            <p className="mb-6 text-center text-[13px] leading-relaxed text-muted">
              اختر كلمةً جديدة. بعدها تُغلق كلُّ الجلسات المفتوحة بحسابك.
            </p>
            <ResetForm token={token} />
          </>
        ) : (
          <p className="mx-auto max-w-sm rounded-xl bg-card px-4 py-3 text-center text-[12.5px] leading-relaxed text-muted">
            الرابط ناقص. افتح الرابط من رسالة البريد كما هو، أو اطلب رابطاً جديداً.
          </p>
        )}

        <Link href="/login" className="mt-6 text-center text-[13px] font-semibold text-clay-ink">
          رجوع إلى الدخول
        </Link>
      </main>
    </div>
  );
}
