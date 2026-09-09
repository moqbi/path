import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { circleCount, privateTimeline } from "@/lib/feed";
import { MomentCard } from "@/components/moment-card";
import { Empty, ScreenHeader } from "@/components/ui";
import { TabBar } from "@/components/tab-bar";
import { dayLabel } from "@/lib/format";

/** اللحظات الخاصة: ما لم يُنشر للدائرة كلها — لي، أو لمن اختارني. */
export default async function PrivatePage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const [moments, size] = await Promise.all([privateTimeline(user.id), circleCount(user.id)]);

  const days: { label: string; items: typeof moments }[] = [];
  for (const moment of moments) {
    const label = dayLabel(moment.createdAt);
    const last = days.at(-1);
    if (last && last.label === label) last.items.push(moment);
    else days.push({ label, items: [moment] });
  }

  return (
    <div className="screen">
      <ScreenHeader title="اللحظات الخاصة" back="/" />

      <main className="scroll-area px-5">
        <p className="py-3 text-[11.5px] leading-relaxed text-muted">
          ما نُشر لتصنيفٍ من أصدقائك أو لأشخاص بأعيانهم. غيرهم لا يرى هذه اللحظات
          في خطّه الزمني أصلاً.
        </p>

        {moments.length === 0 ? (
          <Empty
            title="ما فيه لحظات خاصة"
            hint="عند النشر اختر «من يراها» — تصنيفاً من أصدقائك أو أشخاصاً بأعيانهم."
          />
        ) : (
          <div className="spine relative">
            {days.map((day) => (
              <section key={day.label}>
                <div className="relative flex items-center gap-3 py-4">
                  <div className="flex w-14 justify-center">
                    <span className="block h-1.5 w-1.5 rounded-full bg-line" />
                  </div>
                  <h2 className="text-[15px] font-semibold text-muted">{day.label}</h2>
                </div>
                {day.items.map((moment) => (
                  <MomentCard
                    key={moment.id}
                    moment={moment}
                    viewerId={user.id}
                    isPlus={user.isPlus}
                    circleSize={size}
                  />
                ))}
              </section>
            ))}
          </div>
        )}
      </main>

      <TabBar active="/" />
    </div>
  );
}
