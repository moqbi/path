import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { circleCount, timeline } from "@/lib/feed";
import { unreadCount } from "@/lib/dm";
import { MomentCard } from "@/components/moment-card";
import { ComposerFan } from "@/components/composer-fan";
import { Avatar, Empty, TabBar } from "@/components/ui";
import { TimelineHead } from "@/components/timeline-head";
import { AthrHeaderMark } from "@/components/brand";
import { CircleIcon, MessageIcon } from "@/components/icons";
import { ar, dayLabel } from "@/lib/format";

export default async function TimelinePage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const [moments, size, unread] = await Promise.all([
    timeline(user.id),
    circleCount(user.id),
    unreadCount(user.id),
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
    <div className="screen">
      <header className="chrome flex items-center justify-between px-5 py-3">
        <AthrHeaderMark />
        <div className="flex gap-1">
          <Link
            href="/messages"
            aria-label="المحادثات"
            className="relative flex h-11 w-11 items-center justify-center"
            style={{ color: "var(--color-chrome-ink)" }}
          >
            <MessageIcon size={21} />
            {unread > 0 ? (
              <span
                className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold"
                style={{ background: "var(--color-live)", color: "var(--color-on-brand)" }}
              >
                {ar(unread)}
              </span>
            ) : null}
          </Link>
          <Link
            href="/circle"
            aria-label="الدائرة"
            className="flex h-11 w-11 items-center justify-center"
            style={{ color: "var(--color-chrome-ink)" }}
          >
            <CircleIcon size={21} />
          </Link>
        </div>
      </header>

      <TimelineHead
        coverMediaId={user.coverMediaId}
        coverSpec={user.background?.spec ?? null}
        name={user.name}
        avatar={
          <Avatar
            name={user.name}
            size={56}
            frameSpec={user.frame?.spec}
            mediaId={user.avatarMediaId}
            ring="var(--color-paper)"
          />
        }
      >
        {moments.length === 0 ? (
          <Empty
            title="خطك الزمني فارغ"
            hint="اضغط الزائد وانشر لحظتك الأولى، أو انتظر أحداً من دائرتك ينشر."
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
      </TimelineHead>

      <ComposerFan />
      <TabBar active="/" />
    </div>
  );
}
