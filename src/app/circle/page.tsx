import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CIRCLE_CAP, circleIds, suggestions } from "@/lib/circle";
import { plusTag, tagOf } from "@/lib/tags";
import {
  acceptFriend,
  ignoreFriend,
  removeFriend,
  requestFriend,
  setFriendGroup,
  startConversation,
} from "@/app/actions";
import { SwipeRow } from "@/components/swipe-row";
import { Avatar, Empty, TagPill } from "@/components/ui";
import { TabBar } from "@/components/tab-bar";
import { CheckIcon, CloseIcon, MessageIcon, SparkIcon } from "@/components/icons";
import { ar, relative } from "@/lib/format";

/** حروف العربية بترتيب الهجاء، والاسم يُنسب إلى أول حرف منه. */
function letterOf(name: string): string {
  const first = name.trim().charAt(0);
  if (first === "أ" || first === "إ" || first === "آ") return "ا";
  return first || "…";
}

export default async function CirclePage({
  searchParams,
}: {
  searchParams: Promise<{ g?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");

  const { g } = await searchParams;

  const [ids, auto, suggested, requests, groups] = await Promise.all([
    circleIds(user.id),
    plusTag(),
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
            city: true,
            isPlus: true,
            avatarMediaId: true,
            frame: { select: { spec: true } },
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
  ]);

  const members = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      memberNo: true,
      name: true,
      isPlus: true,
      city: true,
      avatarMediaId: true,
      frame: { select: { spec: true } },
      tag: { select: { name: true, bg: true, fg: true } },
      moments: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { name: "asc" },
  });

  // تصنيف كل صديق: صفٌّ واحد لكل عضوية، فالبحث في خريطة أسرع من استعلام.
  const groupOf = new Map<string, { id: string; name: string }>();
  for (const group of groups) {
    for (const member of group.members) {
      groupOf.set(member.userId, { id: group.id, name: group.name });
    }
  }

  const active = groups.find((group) => group.id === g) ?? null;
  const shown = active
    ? members.filter((member) => groupOf.get(member.id)?.id === active.id)
    : members;

  // أقسام بحرف الاسم — تُقرأ الدائرة كدفتر أسماء لا كقائمة متصلة.
  const sections: { letter: string; people: typeof members }[] = [];
  for (const member of shown) {
    const letter = letterOf(member.name);
    const last = sections.at(-1);
    if (last && last.letter === letter) last.people.push(member);
    else sections.push({ letter, people: [member] });
  }

  const filled = Math.min(1, ids.length / CIRCLE_CAP);

  return (
    <div className="screen">
      <header className="chrome flex items-center justify-between px-5 pb-4 pt-5">
        <h1 className="text-[16px] font-bold" style={{ color: "var(--color-chrome-ink)" }}>
          الأصدقاء
        </h1>
        <span className="text-[12px]" style={{ color: "var(--color-chrome-ink)", opacity: 0.72 }}>
          {ar(ids.length)} من {ar(CIRCLE_CAP)}
        </span>
      </header>

      <main className="scroll-area px-5 pb-4 pt-4">
        {/* العدّاد: شريط واحد يقول كم بقي، بلا حلقة تأكل نصف الشاشة. */}
        <section className="mb-5 rounded-2xl border border-line bg-card p-4">
          <div className="mb-2.5 flex items-end justify-between">
            <p className="text-[13px] text-muted">
              بقي لك <span className="font-semibold text-ink">{ar(CIRCLE_CAP - ids.length)}</span> مقعداً
            </p>
            <p className="text-[26px] leading-none" style={{ fontFamily: "var(--font-display)" }}>
              {ar(ids.length)}
              <span className="text-[13px] text-faint"> / {ar(CIRCLE_CAP)}</span>
            </p>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--color-chip)" }}>
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.max(filled * 100, 2)}%`, background: "linear-gradient(90deg,#f6b93b,#ff7a5a)" }}
            />
          </div>
          <p className="mt-2.5 text-[11.5px] leading-relaxed text-muted">
            السقف {ar(CIRCLE_CAP)} ولا يُشترى.
          </p>
        </section>

        {suggested.length > 0 ? (
          <section className="mb-6">
            <p className="mb-1 text-[11.5px] font-semibold tracking-wide text-faint">
              تعرفهم عن طريق أصدقائك
            </p>
            <p className="mb-2.5 text-[11px] leading-relaxed text-muted">
              لا بحث بالاسم ولا بالبريد — من يظهر هنا يجمعك به صديق مشترك.
            </p>
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
                      mediaId={person.avatarMediaId}
                    />
                  </Link>
                  <Link href={`/u/${person.id}`} className="min-w-0 grow">
                    <p className="flex items-center gap-1.5 truncate text-[14px] font-semibold">
                      {person.name}
                      <TagPill tag={tagOf(person, auto)} size={10} />
                    </p>
                    <p className="truncate text-[11.5px] text-faint">
                      {person.mutual === 1
                        ? "صديق مشترك واحد"
                        : `${ar(person.mutual)} أصدقاء مشتركين`}
                      {person.city ? ` · ${person.city}` : ""}
                    </p>
                  </Link>
                  <form action={requestFriend.bind(null, person.id)} className="shrink-0">
                    <button
                      type="submit"
                      className="h-10 rounded-xl px-3.5 text-[12.5px] font-bold"
                      style={{ background: "var(--color-clay)", color: "var(--color-on-brand)" }}
                    >
                      أضف
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {requests.length > 0 ? (
          <section className="mb-6">
            <p className="mb-2.5 text-[11.5px] font-semibold tracking-wide text-faint">
              طلبات ({ar(requests.length)})
            </p>
            <div className="flex flex-col gap-2">
              {requests.map((request) => (
                <div
                  key={request.id}
                  className="flex items-center gap-3 rounded-2xl border border-line bg-card p-3"
                  style={{ borderColor: "var(--color-clay)" }}
                >
                  <Avatar
                    name={request.requester.name}
                    size={44}
                    frameSpec={request.requester.frame?.spec}
                    mediaId={request.requester.avatarMediaId}
                  />
                  <div className="min-w-0 grow">
                    <p className="flex items-center gap-1.5 truncate text-[14px] font-semibold">
                      {request.requester.name}
                      <TagPill tag={tagOf(request.requester, auto)} size={10} />
                    </p>
                    <p className="text-[11.5px] text-faint">
                      طلب {relative(request.createdAt)}
                    </p>
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

        {/* شرائح التصنيف — «الكل» ثم تصنيفاتك، كما في المخطط. */}
        <div className="no-bar mb-3 flex gap-2 overflow-x-auto pb-1">
          {[{ id: "", name: "الكل" }, ...groups].map((chip) => {
            const on = (g ?? "") === chip.id;
            return (
              <Link
                key={chip.id || "all"}
                href={chip.id ? `/circle?g=${chip.id}` : "/circle"}
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

        {shown.length === 0 && members.length > 0 ? (
          <Empty title="ما فيه أحد في هذا التصنيف" hint="افتح «تصنيف» تحت أي صديق وضعه فيه." />
        ) : null}

        {members.length === 0 ? (
          <Empty
            title="ما عندك أصدقاء بعد"
            hint="الإضافة تكون من أصدقاء أصدقائك — أول صديق يفتح لك الباب."
          />
        ) : (
          sections.map((section) => (
            <section key={section.letter} className="mb-4">
              <p className="mb-1.5 px-1 text-[12px] font-bold text-clay-ink">{section.letter}</p>
              <div className="overflow-hidden rounded-2xl border border-line bg-card">
                {section.people.map((member, index) => {
                  const group = groupOf.get(member.id) ?? null;
                  return (
                    <SwipeRow
                      key={member.id}
                      confirmLabel="إزالة"
                      onDelete={removeFriend.bind(null, member.id)}
                    >
                    <details
                      style={{
                        borderTop: index === 0 ? "none" : "1px solid var(--color-line)",
                        background: "var(--color-card)",
                      }}
                    >
                      <summary className="flex cursor-pointer list-none items-center gap-3 p-3">
                        <Link
                          href={`/u/${member.id}`}
                          aria-label={`ملف ${member.name}`}
                          className="shrink-0"
                        >
                          <Avatar
                            name={member.name}
                            size={46}
                            frameSpec={member.frame?.spec}
                            mediaId={member.avatarMediaId}
                          />
                        </Link>
                        <span className="min-w-0 grow">
                          <span className="mb-0.5 flex items-center gap-1.5 truncate text-[14.5px] font-semibold">
                            {member.name}
                            {member.isPlus ? <SparkIcon size={13} className="shrink-0 text-gold" /> : null}
                            <TagPill tag={tagOf(member, auto)} size={10} />
                            {group ? (
                              <span
                                className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                                style={{ background: "var(--color-chip)", color: "var(--color-muted)" }}
                              >
                                {group.name}
                              </span>
                            ) : null}
                          </span>
                          <span className="block truncate text-[11.5px] text-faint">
                            عضوية {ar(member.memberNo)}
                            {member.city ? ` · ${member.city}` : ""}
                            {member.moments[0]
                              ? ` · آخر لحظة ${relative(member.moments[0].createdAt)}`
                              : ""}
                          </span>
                        </span>
                      </summary>

                      <div className="flex flex-wrap items-center gap-2 px-3 pb-3">
                        <form action={startConversation.bind(null, member.id)}>
                          <button
                            type="submit"
                            className="flex h-9 items-center gap-1.5 rounded-full border border-line px-3 text-[12px] font-semibold text-ink-2"
                          >
                            <MessageIcon size={15} />
                            محادثة
                          </button>
                        </form>

                        <form
                          action={setFriendGroup.bind(null, member.id)}
                          className="flex flex-wrap items-center gap-2"
                        >
                          {groups.map((option) => {
                            const on = group?.id === option.id;
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
                          {group ? (
                            <button
                              type="submit"
                              name="groupId"
                              value=""
                              className="h-9 rounded-full border border-line px-3 text-[12px] font-semibold text-muted"
                            >
                              بلا تصنيف
                            </button>
                          ) : null}
                          {groups.length === 0 ? (
                            <Link
                              href="/settings/privacy"
                              className="h-9 rounded-full border border-dashed border-line px-3 py-2 text-[12px] font-semibold text-muted"
                            >
                              أنشئ تصنيفاً أولاً
                            </Link>
                          ) : null}
                        </form>
                      </div>
                    </details>
                    </SwipeRow>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </main>

      <TabBar active="/circle" />
    </div>
  );
}
