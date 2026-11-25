import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { VerifyForm } from "./form";

/**
 * التحقّقُ الثنائيّ قبل اللوحة (القاعدة ٤٩٣): رمزٌ من تطبيق الرموز، أو ضبطُه أوّلَ مرّة.
 */
export default async function VerifyPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!user.panelPending) redirect("/admin");

  return (
    <div className="screen">
      <main className="scroll-area admin-narrow flex flex-col justify-center px-6 py-10">
        <VerifyForm setup={!user.hasTotp} name={user.name} />
      </main>
    </div>
  );
}
