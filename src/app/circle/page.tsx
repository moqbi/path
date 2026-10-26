import { maskPresence } from "@/lib/presence";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CIRCLE_CAP, circleIds } from "@/lib/circle";
import { storyRings } from "@/lib/stories";
import { acceptFriend, ignoreFriend } from "@/app/actions";
import { FriendRow } from "@/components/friend-row";
import { AddFriendButton } from "@/components/add-sheet";
import { CircleStrip } from "@/components/circle-strip";
import { listNotes } from "@/lib/notes";
import { Avatar, Empty, NameTag } from "@/components/ui";
import { TabBar } from "@/components/tab-bar";
import { CheckIcon, CloseIcon } from "@/components/icons";
import { AthrPageMark } from "@/components/brand";
import { ar, presence, relative } from "@/lib/format";

export default async function CirclePage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const [ids, requests, groups, rings, notes] = await Promise.all([
    circleIds(user.id),
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
            frame: { select: { spec: true, mediaId: true, frameHole: true } },
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
    listNotes(user.id),
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
      hideOnline: true,
      avatarMediaId: true,
      frame: { select: { spec: true, mediaId: true, frameHole: true } },
      charm: { select: { spec: true, mediaId: true } },
      tag: { select: { name: true, bg: true, fg: true } },
      moments: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { name: "asc" },
  }).then(maskPresence);

  const groupOf = new Map<string, { id: string; name: string }>();
  for (const group of groups) {
    for (const member of group.members) groupOf.set(member.userId, { id: group.id, name: group.name });
  }

  // المتصلون أوّلاً — من يمكن أن يردّ الآن يستحقّ أن يُرى أوّلاً.
  const online = (member: (typeof members)[number]) =>
    Boolean(member.lastSeenAt && Date.now() - member.lastSeenAt.getTime() < 3 * 60_000);
  const byName = (a: (typeof members)[number], b: (typeof members)[number]) => a.name.localeCompare(b.name, "ar");
  const live = members.filter(online).sort(byName);
  const away = members.filter((member) => !online(member)).sort(byName);
  const options = groups.map((group) => ({ id: group.id, name: group.name }));

  // سطرُ الصديق: «المدينة | آخر ظهور» كالجوّال (القاعدة ٣١).
  const row = (member: (typeof members)[number]) => {
    const seen = presence(member.lastSeenAt) || "ما فتح التطبيق بعد";
    return (
      <FriendRow key={member.id} id={member.id} name={member.name} group={groupOf.get(member.id) ?? null} groups={options}>
        <span className="relative shrink-0">
          <Avatar
            name={member.name}
            size={46}
            frame={member.frame}
            charm={member.charm}
            mediaId={member.avatarMediaId}
          />
          {online(member) ? (
            <span
              className="absolute bottom-0 left-0 block h-3 w-3 rounded-full"
              style={{ background: "#3fbf6a", border: "2px solid var(--color-card)" }}
            />
          ) : null}
        </span>
        <span className="min-w-0 grow">
          <span className="mb-0.5 flex items-center gap-1.5 text-[15px] font-bold text-ink">
            <span dir="auto" className="truncate">{member.name}</span>
            <NameTag isPlus={member.isPlus} tag={member.tag} size={10} />
          </span>
          <span
            className="block truncate text-[12px]"
            style={{ color: online(member) ? "#2f9e58" : "var(--color-faint)" }}
          >
            {/* «المدينة | آخر ظهور | التصنيف» كالجوّال — والتصنيفُ لصاحبه وحده (القاعدة ٢٢). */}
            {[member.city, seen, groupOf.get(member.id)?.name].filter(Boolean).join("  |  ")}
          </span>
        </span>
      </FriendRow>
    );
  };

  return (
    <div className="screen">
      {/* رأسُ الجوّال (القاعدة ٢٦٨): ما بقي من السقف وزرُّ الإضافة. */}
      <header className="chrome flex items-center justify-between px-5 pb-3 pt-4">
        <AthrPageMark label="الأصدقاء" />
        <div className="flex items-center gap-2.5">
          <span className="text-[12px]" style={{ color: "var(--color-chrome-muted)" }}>
            بقي {ar(Math.max(0, CIRCLE_CAP - ids.length))}
          </span>
          <AddFriendButton
            me={{
              name: user.name,
              memberNo: user.memberNo,
              avatarMediaId: user.avatarMediaId,
              frame: user.frame,
              charm: user.charm,
            }}
          />
        </div>
      </header>

      {/*
        قائمةٌ واحدة — **بقرار المالك**، كالجوّال: القصصُ والنوت في أعلاها، ثمّ
        الطلبات، ثمّ الأصدقاء متصلاً وغيرَ متصل بقسمين يُطويان. والتصنيفُ فعلٌ
        في سحبة الصفّ لا تبويب.
      */}
      <main className="scroll-area px-5 pb-4">
        <div className="-mx-5 mb-2">
          <CircleStrip
            rings={rings}
            notes={notes}
            me={{ id: user.id, name: user.name, avatarMediaId: user.avatarMediaId }}
            groups={groups.map((group) => ({ id: group.id, name: group.name }))}
          />
        </div>

        {requests.length > 0 ? (
          <Fold label="طلبات الصداقة" count={requests.length} dot="var(--color-clay)">
            {requests.map((request) => (
              <div
                key={request.id}
                className="flex items-center gap-3 rounded-2xl border bg-card p-3"
                style={{ borderColor: "var(--color-clay)" }}
              >
                <Link href={`/u/${request.requester.id}`} className="flex min-w-0 grow items-center gap-3">
                  <Avatar
                    name={request.requester.name}
                    size={44}
                    frame={request.requester.frame}
                    charm={request.requester.charm}
                    mediaId={request.requester.avatarMediaId}
                  />
                  <div className="min-w-0 grow">
                    <p className="flex items-center gap-1.5 truncate text-[14px] font-semibold">
                      <span dir="auto" className="truncate">{request.requester.name}</span>
                      <NameTag isPlus={request.requester.isPlus} tag={request.requester.tag} size={10} />
                    </p>
                    <p className="text-[11.5px] text-faint">طلب {relative(request.createdAt)}</p>
                  </div>
                </Link>
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
          </Fold>
        ) : null}

        {members.length === 0 ? (
          <Empty title="ما عندك أصدقاء بعد" hint="اضغط زرّ الإضافة في الأعلى وشارك رابط ملفك مع من تعرفهم." />
        ) : (
          <>
            <Fold label="متصل" count={live.length} dot="var(--color-live)">
              {live.map((member) => row(member))}
            </Fold>
            <Fold label="غير متصل" count={away.length} dot="var(--color-faint)">
              {away.map((member) => row(member))}
            </Fold>
          </>
        )}
      </main>

      <TabBar active="/circle" />
    </div>
  );
}

/** قسمٌ يُطوى ويُفتح كالجوّال (القاعدة ١٦١) — و`details` يحفظ حالتَه بلا جافاسكربت. */
function Fold({
  label,
  count,
  dot,
  children,
}: {
  label: string;
  count: number;
  dot: string;
  children: React.ReactNode;
}) {
  return (
    <details open className={`group ${count > 0 ? "mb-4" : "mb-0"}`}>
      <summary className="flex cursor-pointer list-none items-center gap-2 py-3 [&::-webkit-details-marker]:hidden">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: dot }} />
        <span className="grow text-[15px] font-bold text-ground-ink">
          {label} ({ar(count)})
        </span>
        <span className="text-[12.5px] font-semibold text-ground-ink-2 group-open:hidden">إظهار</span>
        <span className="hidden text-[12.5px] font-semibold text-ground-ink-2 group-open:inline">إخفاء</span>
      </summary>
      {count > 0 ? <div className="flex flex-col gap-2.5">{children}</div> : null}
    </details>
  );
}
