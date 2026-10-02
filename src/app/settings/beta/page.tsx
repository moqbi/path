import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { ScreenHeader } from "@/components/ui";
import { BetaForm } from "./form";

/** فريقُ التجارب — من داخل التطبيق، بنموذج `/beta` في الموقع نفسه. */
export default async function BetaPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  return (
    <div className="screen">
      <ScreenHeader title="فريق التجارب" back="/settings" />
      <main className="scroll-area px-5 py-4">
        <div className="rounded-2xl border border-line bg-card p-4">
          <p className="mb-1 text-[13.5px] font-semibold">جرّب آثار قبل الجميع</p>
          <p className="mb-4 text-[11.5px] leading-relaxed text-muted">
            نرسل لك دعوةً إلى النسخ التجريبية عبر TestFlight على الآيفون أو Google Play على
            أندرويد، وملاحظاتك تصلنا قبل أن تصل النسخة للناس.
          </p>
          <BetaForm email={user.email ?? ""} />
        </div>
      </main>
    </div>
  );
}
