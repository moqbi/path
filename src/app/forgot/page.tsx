import Link from "next/link";
import { ForgotForm } from "./form";

export const metadata = { title: "نسيت كلمة المرور · آثار مومنتس" };

/**
 * «نسيت كلمة المرور»: بريدٌ واحد، والجوابُ واحدٌ مهما كان.
 * صفحةٌ عامّة بلا جلسة — من نسي كلمته لا يستطيع الدخول ليطلبها.
 */
export default function ForgotPage() {
  return (
    <div className="screen">
      <main className="scroll-area flex flex-col justify-center px-6 py-10">
        <h1 className="mb-2 text-center text-[20px] font-bold">نسيت كلمة المرور</h1>
        <p className="mb-6 text-center text-[13px] leading-relaxed text-muted">
          اكتب بريدك ونرسل لك رابطاً تضبط منه كلمةً جديدة. الرابط يعمل ساعةً واحدة.
        </p>

        <ForgotForm />

        <Link href="/login" className="mt-6 text-center text-[13px] font-semibold text-clay-ink">
          رجوع إلى الدخول
        </Link>
      </main>
    </div>
  );
}
