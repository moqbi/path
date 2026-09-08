import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { circleCount, pendingTags, timeline } from "@/lib/feed";
import { MomentCard } from "@/components/moment-card";
import { Empty, TabBar } from "@/components/ui";
import { CircleIcon, PlusIcon, SearchIcon } from "@/components/icons";
import { dayLabel } from "@/lib/format";
import { TagApproval } from "@/components/tag-approval";

export default async function TimelinePage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const [moments, size, tags] = await Promise.all([
    timeline(user.id),
    circleCount(user.id),
    pendingTags(user.id),
  ]);

  // اللحظات تُجمَّع تحت فواصل الأيام، فالخط الزمني يُقرأ كيوميات لا كتدفق.
  const days: { label: string; items: typeof moments }[] = [];
  for (const moment of moments) {
    const label = dayLabel(moment.createdAt);
    const last = days.at(-1);
    if (last && last.label === label) last.items.push(moment);
    else days.push({ label, items: [moment] });
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-line px-5 py-3">
        <span
          className="text-[27px] font-bold tracking-wide"
          style={{ fontFamily: "var(--font-display)" }}
        >
          أثر
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            aria-label="بحث"
            className="flex h-11 w-11 items-center justify-center text-ink-2"
          >
            <SearchIcon size={21} />
          </button>
          <Link
            href="/circle"
            aria-label="الدائرة"
            className="flex h-11 w-11 items-center justify-center text-ink-2"
          >
            <CircleIcon size={21} />
          </Link>
        </div>
      </header>

      <main className="relative grow px-5">
        {tags.length > 0 ? <TagApproval tags={tags} /> : null}

        {moments.length === 0 ? (
          <Empty
            title="خطك الزمني فارغ"
            hint="انشر لحظتك الأولى، أو انتظر أحداً من دائرتك ينشر."
          />
        ) : (
          <div className="spine relative">
            {days.map((day) => (
              <section key={day.label}>
                <div className="relative flex items-center gap-3 py-4">
                  <div className="flex w-14 justify-center">
                    <span className="block h-1.5 w-1.5 rounded-full bg-[#c9c0b4]" />
                  </div>
                  <h2
                    className="text-[16px] tracking-wide text-muted"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {day.label}
                  </h2>
                </div>
                {day.items.map((moment) => (
                  <MomentCard
                    key={moment.id}
                    moment={moment}
                    viewerId={user.id}
                    circleSize={size}
                  />
                ))}
              </section>
            ))}
          </div>
        )}
      </main>

      <div className="sticky bottom-20 z-10 h-0">
        <div className="flex justify-start px-5">
          <Link
            href="/compose"
            aria-label="لحظة جديدة"
            className="flex h-14 w-14 -translate-y-14 items-center justify-center rounded-full text-paper shadow-lg"
            style={{ background: "var(--color-clay)", boxShadow: "0 6px 18px rgba(176,83,47,.32)" }}
          >
            <PlusIcon size={24} />
          </Link>
        </div>
      </div>

      <TabBar active="/" />
    </div>
  );
}

