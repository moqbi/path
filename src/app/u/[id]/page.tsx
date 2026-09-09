
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { circleIds } from "@/lib/circle";
import { momentShape } from "@/lib/feed";
import { plusTag, tagOf } from "@/lib/tags";
import { startConversation } from "@/app/actions";
import { MomentCard } from "@/components/moment-card";
import { Avatar, coverStyle, Empty, ScreenHeader, TagPill } from "@/components/ui";
import { MessageIcon, SparkIcon } from "@/components/icons";
import { ar, dayLabel } from "@/lib/format";

const MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

/** ملف صديق: مخططه ولحظاته — لا يفتحه إلا من هو في دائرته. */
export default async function FriendProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const viewer = await currentUser();
  if (!viewer) redirect("/login");
  if (id === viewer.id) redirect("/me");

  const ids = await circleIds(viewer.id);
  if (!ids.includes(id)) notFound();

  const person = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      memberNo: true,
      name: true,
      city: true,
      isPlus: true,
      createdAt: true,
      avatarMediaId: true,
      coverMediaId: true,
      frame: { select: { spec: true } },
      background: { select: { spec: true } },
      tag: { select: { name: true, bg: true, fg: true } },
    },
  });
  if (!person) notFound();

  const [moments, theirCircle, auto] = await Promise.all([
    prisma.moment.findMany({
      where: { authorId: id },
      select: momentShape,
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    circleIds(id),
    plusTag(),
  ]);

  const joined = `${MONTHS[person.createdAt.getMonth()]} ${ar(person.createdAt.getFullYear())}`;

  const days: { label: string; items: typeof moments }[] = [];
  for (const moment of moments) {
    const label = dayLabel(moment.createdAt);
    const last = days.at(-1);
    if (last && last.label === label) last.items.push(moment);
    else days.push({ label, items: [moment] });
  }

  return (
    <div className="screen">
      <ScreenHeader title={person.name} back="/" />

      <div className="scroll-area">
        <div
          className="relative shrink-0"
          style={{ height: 140, ...coverStyle(person.coverMediaId, person.background?.spec) }}
        />

        <div className="relative px-5" style={{ marginTop: -34 }}>
          <div className="mb-3 flex items-end justify-between">
            <Avatar
              name={person.name}
              size={78}
              frameSpec={person.frame?.spec}
              mediaId={person.avatarMediaId}
            />
            <form action={startConversation.bind(null, person.id)} className="pb-1.5">
              <button
                type="submit"
                className="flex items-center gap-2 rounded-xl border border-line bg-card px-4 text-[13px] font-semibold text-ink-2"
                style={{ height: 42 }}
              >
                <MessageIcon size={17} />
                محادثة
              </button>
            </form>
          </div>

          <h1 className="mb-1 flex flex-wrap items-center gap-2 text-[19px] font-bold">
            {person.name}
            {person.isPlus ? <SparkIcon size={16} className="text-gold" /> : null}
            <TagPill tag={tagOf(person, auto)} size={11} />
          </h1>
          <p className="mb-4 text-[12.5px] text-muted">
            عضوية رقم {ar(person.memberNo)} · {person.city ? `${person.city} · ` : null}
            معك من {joined} · {ar(theirCircle.length)} في دائرته
          </p>
        </div>

        <div className="px-5">
          {moments.length === 0 ? (
            <Empty title="ما نشر شي بعد" />
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
                      viewerId={viewer.id}
                      isPlus={viewer.isPlus}
                      circleSize={ids.length}
                    />
                  ))}
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

