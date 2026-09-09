import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { circleIds } from "@/lib/circle";
import { circleCount } from "@/lib/feed";
import { friendshipSince, togetherMoments } from "@/lib/together";
import { MomentCard } from "@/components/moment-card";
import { Avatar, Empty, ScreenHeader } from "@/components/ui";
import { ar, dayLabel } from "@/lib/format";

const MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

/**
 * «أثرنا»: خطٌّ زمني واحد لاثنين.
 * العدد أعلى الصفحة ليس عدد لحظاتهما، بل عدد ما جمعهما منها.
 */
export default async function TogetherPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await currentUser();
  if (!user) redirect("/login");
  if (id === user.id) redirect("/me");

  const ids = await circleIds(user.id);
  if (!ids.includes(id)) notFound();

  const [friend, moments, since, size] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        avatarMediaId: true,
        frame: { select: { spec: true } },
      },
    }),
    togetherMoments(user.id, id),
    friendshipSince(user.id, id),
    circleCount(user.id),
  ]);
  if (!friend) notFound();

  const days: { label: string; items: typeof moments }[] = [];
  for (const moment of moments) {
    const label = dayLabel(moment.createdAt);
    const last = days.at(-1);
    if (last && last.label === label) last.items.push(moment);
    else days.push({ label, items: [moment] });
  }

  return (
    <div className="screen">
      <ScreenHeader title={`أنت و${friend.name}`} back="/together" />

      <main className="scroll-area px-5">
        <section className="my-4 rounded-2xl border border-line bg-card p-5 text-center">
          <div className="mb-3 flex items-center justify-center">
            <Avatar name={user.name} size={52} mediaId={user.avatarMediaId} ring="var(--color-card)" />
            <div style={{ marginRight: -14 }}>
              <Avatar
                name={friend.name}
                size={52}
                frameSpec={friend.frame?.spec}
                mediaId={friend.avatarMediaId}
                ring="var(--color-card)"
              />
            </div>
          </div>

          <p className="text-[13px] font-semibold text-clay-ink">أثر مشترك</p>
          <p className="my-1 text-[34px] leading-none" style={{ fontFamily: "var(--font-display)" }}>
            {ar(moments.length)}
          </p>
          <p className="text-[12.5px] text-muted">
            {moments.length === 1 ? "لحظة تجمعكما" : "لحظة تجمعكما"}
            {since
              ? ` منذ ${MONTHS[since.getMonth()]} ${ar(since.getFullYear())}`
              : ""}
          </p>
        </section>

        {moments.length === 0 ? (
          <Empty
            title="ما فيه أثر بعد"
            hint="أشِر إليه في لحظة، أو تفاعل مع لحظاته — وسيبدأ الخطّ المشترك."
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
    </div>
  );
}
