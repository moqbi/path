import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { SignInForm } from "./form";

/**
 * باب اللوحة.
 *
 * لا شاشةَ إقلاعٍ ولا مزوّدين كما في التطبيق: هذه أداةُ عملٍ يفتحها من
 * يعرف بريده وكلمته. ومن دخل وليس مشرفاً تردّه `/admin` نفسها — الفحص
 * هناك لا هنا، فالإخفاء ليس حماية.
 */
export default async function LoginPage() {
  const user = await currentUser();
  if (user) redirect("/admin");

  return (
    <div className="screen">
      <main className="scroll-area flex flex-col justify-center px-6">
        <SignInForm />
      </main>
    </div>
  );
}
