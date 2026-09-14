import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CIRCLE_CAP, circleIds, suggestions } from "@/lib/circle";
import { storyRings } from "@/lib/stories";
import {
  acceptFriend,
  ignoreFriend,
  blockUser,
  removeFriend,
  requestFriend,
  setFriendGroup,
  startConversation,
} from "@/app/actions";
import { SwipeRow } from "@/components/swipe-row";
import { StoryStrip } from "@/components/stories";
import { Avatar, Empty, NameTag } from "@/components/ui";
import { TabBar } from "@/components/tab-bar";
import { CheckIcon, CloseIcon, MessageIcon } from "@/components/icons";
import { AthrPageMark } from "@/components/brand";
import { ar, presence, relative } from "@/lib/format";

const TABS = [
  { key: "friends", label: "أصدقائي" },
  { key: "groups", label: "تصنيفاتي" },
  { key: "suggested", label: "مقترحون" },
] as const;

export default async function CirclePage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; g?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");

  const { t, g } = await searchParams;
  const tab = TABS.some((item) => item.key === t) ? t! : "friends";

  const [ids, suggested, requests, groups, rings] = await Promise.all([
    circleIds(user.id),
    suggestions(user.id),
    prisma.friendship.findMany({
      where: { addresseeId: user.id, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        requester: {
          select: {
            id: true,
            name: true,
            isPlus: true,
            avatarMediaId: true,
            frame: { select: { spec: true } },
            charm: { select: { spec: true, mediaId: true } },
            tag: { select: { name: true, bg: true, fg: true } },
          },
        },
      },
    }),
    prisma.friendGroup.findMany({
      where: { ownerId: user.id },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, members: { select: { userId: true } } },
    }),
    storyRings(user.id),
  ]);

  const members = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      memberNo: true,
      name: true,
      isPlus: true,
      city: true,
      lastSeenAt: true,
      avatarMediaId: true,
      frame: { select: { spec: true } },
      charm: { select: { spec: true, mediaId: true } },
      tag: { select: { name: true, bg: true, fg: true } },
      moments: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { name: "asc" },
  });

  const groupOf = new Map<string, { id: string; name: string }>();
  for (const group of groups) {
    for (const member of group.members) groupOf.set(member.userId, { id: group.id, name: group.name });
  }

  const active = groups.find((group) => group.id === g) ?? null;
  const shown = active ? members.filter((m) => groupOf.get(m.id)?.id === active.id) : members;

  // المتصلون أولاً — من يمكن أن يردّ الآن يستحق أن يُرى أولاً.
  const online = (member: (typeof members)[number]) =>
    member.lastSeenAt && Date.now() - member.lastSeenAt.getTime() < 3 * 60_000;
  const ordered = [...shown].sort((a, b) => {
    const diff = Number(online(b)) - Number(online(a));
    return diff !== 0 ? diff : a.name.localeCompare(b.name, "ar");
  });

  return (
    <div className="screen">
      {/* لا زرّ زائد في الرأس: كان يفتح «مقترحون» وهو تبويبٌ ظاهرٌ تحته. */}
      <header className="chrome flex items-center px-5 pb-3 pt-4">
        <AthrPageMark label="الأصدقاء" />
      </header>

      {/* شريط القصص: قصتك أولاً ثم من عندهم جديد. */}
      <div className="shrink-0" style={{ borderBottom: "1px solid var(--color-line)" }}>
        <StoryStrip
          rings={rings}
          me={{ id: user.id, name: user.name, avatarMediaId: user.avatarMediaId }}
        />
      </div>

      <div className="shrink-0 px-5 pb-1 pt-3">
        <div className="no-bar flex gap-2 overflow-x-auto">
          {TABS.map((item) => {
            const on = tab === item.key;
            return (
              <Link
                key={item.key}
                href={`/circle?t=${item.key}`}
                className="shrink-0 rounded-full px-4 py-2 text-[12.5px] font-semibold"
                style={{
                  background: on ? "var(--color-clay)" : "var(--color-card)",
                  color: on ? "var(--color-on-brand)" : "var(--color-ink-2)",
                  border: `1px solid ${on ? "var(--color-clay)" : "var(--color-line)"}`,
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      <main className="scroll-area px-5 pb-4 pt-3">
        {requests.length > 0 ? (
          <section className="mb-5">
            <p className="mb-2 text-[11.5px] font-semibold tracking-wide text-faint">
              طلبات ({ar(requests.length)})
            </p>
            <div className="flex flex-col gap-2">
              {requests.map((request) => (
                <div
                  key={request.id}
                  className="flex items-center gap-3 rounded-2xl border bg-card p-3"
                  style={{ borderColor: "var(--color-clay)" }}
                >
                  <Avatar
                    name={request.requester.name}
                    size={44}
                    frameSpec={request.requester.frame?.spec}
                    charm={request.requester.charm}
                    mediaId={request.requester.avatarMediaId}
                  />
                  <div className="min-w-0 grow">
                    <p className="flex items-center gap-1.5 truncate text-[14px] font-semibold">
                      {request.requester.name}
                      <NameTag isPlus={request.requester.isPlus} tag={request.requester.tag} size={10} />
                    </p>
                    <p className="text-[11.5px] text-faint">طلب {relative(request.createdAt)}</p>
                  </div>
                  <form action={acceptFriend.bind(null, request.id)} className="shrink-0">
                    <button
                      type="submit"
                      aria-label={`اقبل ${request.requester.name}`}
                      className="flex h-10 w-10 items-center justify-center rounded-full"
                      style={{ background: "var(--color-clay)", color: "var(--color-on-brand)" }}
                    >
                      <CheckIcon size={17} />
                    </button>
                  </form>
                  <form action={ignoreFriend.bind(null, request.id)} className="shrink-0">
                    <button
                      type="submit"
                      aria-label={`تجاهل ${request.requester.name}`}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-muted"
                    >
                      <CloseIcon size={16} />
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {tab === "friends" ? (
          <>
            <div className="mb-2 flex items-baseline justify-between">
              <p className="text-[13.5px] font-bold">
                أصدقاؤك <span className="text-muted">({ar(ids.length)})</span>
              </p>
              <p className="text-[11px] text-faint">
                بقي {ar(CIRCLE_CAP - ids.length)} من {ar(CIRCLE_CAP)}
              </p>
            </div>

            {members.length === 0 ? (
              <Empty
                title="ما عندك أصدقاء بعد"
                hint="الإضافة من أصدقاء أصدقائك — افتح «مقترحون»."
                action={{ href: "/circle?t=suggested", label: "افتح المقترحين" }}
              />
            ) : (
              <div className="overflow-hidden rounded-2xl border border-line bg-card">
                {ordered.map((member, index) => (
                  <SwipeRow
                    key={member.id}
                    confirmLabel="إزالة"
                    onDelete={removeFriend.bind(null, member.id)}
                    secondLabel="حظر"
                    onSecond={blockUser.bind(null, member.id)}
                  >
                    <div
                      className="flex items-center gap-3 p-3"
                      style={{
                        background: "var(--color-card)",
                        borderTop: index === 0 ? "none" : "1px solid var(--color-line)",
                      }}
                    >
                      <Link href={`/u/${member.id}`} aria-label={`ملف ${member.name}`} className="relative shrink-0">
                        <Avatar
                          name={member.name}
                          size={46}
                          frameSpec={member.frame?.spec}
                          charm={member.charm}
                          mediaId={member.avatarMediaId}
                        />
                        {online(member) ? (
                          <span
                            className="absolute bottom-0 left-0 block h-3 w-3 rounded-full"
                            style={{ background: "#3fbf6a", border: "2px solid var(--color-card)" }}
                          />
                        ) : null}
                      </Link>

                      <Link href={`/u/${member.id}`} className="min-w-0 grow">
                        <p className="mb-0.5 flex items-center gap-1.5 truncate text-[14.5px] font-semibold">
                          {member.name}
                          <NameTag isPlus={member.isPlus} tag={member.tag} size={10} />
                          {groupOf.get(member.id) ? (
                            <span
                              className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                              style={{ background: "var(--color-chip)", color: "var(--color-muted)" }}
                            >
                              {groupOf.get(member.id)!.name}
                            </span>
                          ) : null}
                        </p>
                        <p
                          className="truncate text-[11.5px]"
                          style={{ color: online(member) ? "#2f9e58" : "var(--color-faint)" }}
                        >
                          {presence(member.lastSeenAt) || "ما فتح التطبيق بعد"}
                        </p>
                      </Link>

                      <form action={startConversation.bind(null, member.id)} className="shrink-0">
                        <button
                          type="submit"
                          aria-label={`محادثة ${member.name}`}
                          className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-ink-2"
                        >
                          <MessageIcon size={17} />
                        </button>
                      </form>
                    </div>
                  </SwipeRow>
                ))}
              </div>
            )}
          </>
        ) : null}

        {tab === "groups" ? (
          <>
            <div className="no-bar mb-3 flex gap-2 overflow-x-auto pb-1">
              {[{ id: "", name: "الكل" }, ...groups].map((chip) => {
                const on = (g ?? "") === chip.id;
                return (
                  <Link
                    key={chip.id || "all"}
                    href={chip.id ? `/circle?t=groups&g=${chip.id}` : "/circle?t=groups"}
                    className="shrink-0 rounded-full px-4 py-2 text-[12.5px] font-semibold"
                    style={{
                      background: on ? "var(--color-clay)" : "var(--color-card)",
                      color: on ? "var(--color-on-brand)" : "var(--color-ink-2)",
                      border: `1px solid ${on ? "var(--color-clay)" : "var(--color-line)"}`,
                    }}
                  >
                    {chip.name}
                  </Link>
                );
              })}
              <Link
                href="/settings/privacy"
                className="shrink-0 rounded-full border border-dashed border-line px-4 py-2 text-[12.5px] font-semibold text-muted"
              >
                + تصنيف
              </Link>
            </div>

            {groups.length === 0 ? (
              <Empty
                title="لا تصنيفات بعد"
                hint="العائلة، الزملاء… التصنيف لك وحدك ولا يراه أحد."
                action={{ href: "/settings/privacy", label: "أنشئ تصنيفاً" }}
              />
            ) : (
              <div className="overflow-hidden rounded-2xl border border-line bg-card">
                {shown.map((member, index) => (
                  <div
                    key={member.id}
                    className="flex flex-wrap items-center gap-2 p-3"
                    style={{ borderTop: index === 0 ? "none" : "1px solid var(--color-line)" }}
                  >
                    <Avatar
                      name={member.name}
                      size={38}
                      frameSpec={member.frame?.spec}
                          charm={member.charm}
                      mediaId={member.avatarMediaId}
                    />
                    <span className="min-w-0 grow truncate text-[14px] font-semibold">
                      {member.name}
                    </span>
                    <form
                      action={setFriendGroup.bind(null, member.id)}
                      className="flex w-full flex-wrap gap-2"
                    >
                      {groups.map((option) => {
                        const on = groupOf.get(member.id)?.id === option.id;
                        return (
                          <button
                            key={option.id}
                            type="submit"
                            name="groupId"
                            value={option.id}
                            className="h-9 rounded-full px-3 text-[12px] font-semibold"
                            style={{
                              background: on ? "var(--color-clay)" : "transparent",
                              color: on ? "var(--color-on-brand)" : "var(--color-ink-2)",
                              border: `1px solid ${on ? "var(--color-clay)" : "var(--color-line)"}`,
                            }}
                          >
                            {option.name}
                          </button>
                        );
                      })}
                      {groupOf.get(member.id) ? (
                        <button
                          type="submit"
                          name="groupId"
                          value=""
                          className="h-9 rounded-full border border-line px-3 text-[12px] font-semibold text-muted"
                        >
                          بلا تصنيف
                        </button>
                      ) : null}
                    </form>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : null}

        {tab === "suggested" ? (
          <>
            <p className="mb-1 text-[13.5px] font-bold">أشخاص قد تعرفهم</p>
            <p className="mb-3 text-[11.5px] leading-relaxed text-muted">
              لا بحث بالاسم ولا بالبريد — من يظهر هنا يجمعك به صديق مشترك.
            </p>

            {suggested.length === 0 ? (
              <Empty title="ما فيه مقترحون" hint="حين يكبر عدد أصدقائك يظهر هنا من يعرفونهم." />
            ) : (
              <div className="flex flex-col gap-2">
                {suggested.map((person) => (
                  <div
                    key={person.id}
                    className="flex items-center gap-3 rounded-2xl border border-line bg-card p-3"
                  >
                    <Link href={`/u/${person.id}`} aria-label={`ملف ${person.name}`} className="shrink-0">
                      <Avatar
                        name={person.name}
                        size={44}
                        frameSpec={person.frame?.spec}
                        charm={person.charm}
                        mediaId={person.avatarMediaId}
                      />
                    </Link>
                    <Link href={`/u/${person.id}`} className="min-w-0 grow">
                      <p className="flex items-center gap-1.5 truncate text-[14px] font-semibold">
                        {person.name}
                        <NameTag isPlus={person.isPlus} tag={person.tag} size={10} />
                      </p>
                      <p className="truncate text-[11.5px] text-faint">
                        {person.mutual === 1
                          ? "صديق مشترك واحد"
                          : `مشترك معك في ${ar(person.mutual)} أصدقاء`}
                      </p>
                    </Link>
                    <form action={requestFriend.bind(null, person.id)} className="shrink-0">
                      <button
                        type="submit"
                        className="h-10 rounded-xl px-3.5 text-[12.5px] font-bold"
                        style={{ background: "var(--color-clay)", color: "var(--color-on-brand)" }}
                      >
                        إضافة
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : null}
      </main>

      <TabBar active="/circle" />
    </div>
  );
}
