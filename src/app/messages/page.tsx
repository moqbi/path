import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { circleIds } from "@/lib/circle";
import { conversationsFor } from "@/lib/dm";
import { Avatar, Empty, TagPill } from "@/components/ui";
import { TabBar } from "@/components/tab-bar";
import { AthrHeaderMark } from "@/components/brand";
import { SearchIcon, TextIcon } from "@/components/icons";
import { plusTag, tagOf } from "@/lib/tags";
import { ar, timeOfDay } from "@/lib/format";
import { SwipeRow } from "@/components/swipe-row";
import { deleteConversation, markDelivered, startConversation } from "@/app/actions";
import { Ticks, receiptOf } from "@/components/receipt";

const FILTERS = [
  { key: "", label: "الكل" },
  { key: "unread", label: "غير مقروءة" },
  { key: "online", label: "متصلون" },
] as const;

/**
 * المحادثات: العلامة في الرأس، ثم بحث، ثم مرشّحات، ثم الصفوف —
 * الاسم والوقت في سطر، وآخر رسالة تحته، وشارة تقول كم ينتظر.
 * وتحتها أصدقاؤك لتبدأ محادثة بضغطة، فالسؤال «مع من أتحدّث؟».
 */
export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; f?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");

  const { q, f } = await searchParams;
  const term = (q ?? "").trim();
  const filter = FILTERS.some((item) => item.key === f) ? f! : "";

  // فتحُ الشاشة يعني أنّ ما وصلني قد وصل فعلاً: نكتب التسليم قبل القراءة.
  await markDelivered();

  const [conversations, auto, ids] = await Promise.all([
    conversationsFor(user.id),
    plusTag(),
    circleIds(user.id),
  ]);

  const talking = new Set(conversations.map((row) => row.other.id));
  const rest = await prisma.user.findMany({
    where: { id: { in: ids.filter((id) => !talking.has(id)) } },
    select: {
      id: true,
      name: true,
      isPlus: true,
      lastSeenAt: true,
      avatarMediaId: true,
      frame: { select: { spec: true } },
      charm: { select: { spec: true, mediaId: true } },
      tag: { select: { name: true, bg: true, fg: true } },
    },
    orderBy: { name: "asc" },
  });

  const online = (at: Date | null | undefined) =>
    Boolean(at && Date.now() - at.getTime() < 3 * 60_000);
  const match = (name: string) => !term || name.includes(term);

  const threads = conversations
    .filter((row) => match(row.other.name))
    .filter((row) =>
      filter === "unread" ? row.unseen > 0 : filter === "online" ? online(row.other.lastSeenAt) : true,
    );
  const others = rest
    .filter((person) => match(person.name))
    .filter((person) => (filter === "online" ? online(person.lastSeenAt) : filter !== "unread"));

  const unreadTotal = conversations.reduce((sum, row) => sum + row.unseen, 0);

  return (
    <div className="screen">
      <header className="chrome px-4 pb-3 pt-4">
        <div className="mb-3 flex items-center justify-between">
          <AthrHeaderMark />
          <Link
            href="/circle"
            aria-label="محادثة جديدة"
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{ background: "var(--color-chrome-2)", color: "var(--color-chrome-ink)" }}
          >
            <TextIcon size={18} />
          </Link>
        </div>

        <form
          action="/messages"
          className="flex items-center gap-2 rounded-xl px-3"
          style={{ background: "var(--color-chrome-2)", height: 40 }}
        >
          <span style={{ color: "var(--color-chrome-muted)" }}>
            <SearchIcon size={17} />
          </span>
          <input
            name="q"
            defaultValue={term}
            suppressHydrationWarning
            placeholder="تحدّث مع… ابحث باسم صاحبك"
            aria-label="ابحث"
            className="min-w-0 grow bg-transparent text-[13px] outline-none"
            style={{ color: "var(--color-chrome-ink)" }}
          />
        </form>
      </header>

      <div className="shrink-0 px-4 pb-1 pt-3">
        <div className="no-bar flex gap-2 overflow-x-auto">
          {FILTERS.map((item) => {
            const on = filter === item.key;
            const badge = item.key === "unread" && unreadTotal > 0 ? unreadTotal : 0;
            return (
              <Link
                key={item.key || "all"}
                href={item.key ? `/messages?f=${item.key}` : "/messages"}
                className="flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] font-semibold"
                style={{
                  background: on ? "var(--color-clay)" : "var(--color-card)",
                  color: on ? "var(--color-on-brand)" : "var(--color-ink-2)",
                  border: `1px solid ${on ? "var(--color-clay)" : "var(--color-line)"}`,
                }}
              >
                {item.label}
                {badge > 0 ? (
                  <span
                    className="flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold"
                    style={{
                      background: on ? "var(--color-on-brand)" : "var(--color-clay)",
                      color: on ? "var(--color-clay)" : "var(--color-on-brand)",
                    }}
                  >
                    {ar(badge)}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      </div>

      <main className="scroll-area px-4 pt-2">
        {threads.length === 0 && others.length === 0 ? (
          <Empty
            title={term || filter ? "ما فيه شيء هنا" : "ما عندك محادثات"}
            hint={term || filter ? undefined : "اختر أحداً من أصدقائك تحت لتبدأ معه."}
            action={term || filter ? undefined : { href: "/circle", label: "افتح أصدقائي" }}
          />
        ) : null}

        {threads.length > 0 ? (
          <div className="mb-4 overflow-hidden rounded-2xl border border-line bg-card">
            {threads.map((conversation, index) => (
              <SwipeRow key={conversation.id} onDelete={deleteConversation.bind(null, conversation.id)}>
                <Link
                  href={`/messages/${conversation.id}`}
                  className="flex items-center gap-3 p-3"
                  style={{
                    background: "var(--color-card)",
                    borderTop: index === 0 ? "none" : "1px solid var(--color-line)",
                  }}
                >
                  <span className="relative shrink-0">
                    <Avatar
                      name={conversation.other.name}
                      size={48}
                      frameSpec={conversation.other.frame?.spec}
                      charm={conversation.other.charm}
                      mediaId={conversation.other.avatarMediaId}
                    />
                    {online(conversation.other.lastSeenAt) ? (
                      <span
                        className="absolute bottom-0 left-0 block h-3 w-3 rounded-full"
                        style={{ background: "#3fbf6a", border: "2px solid var(--color-card)" }}
                      />
                    ) : null}
                  </span>

                  <span className="min-w-0 grow">
                    <span className="flex items-baseline gap-1.5">
                      <span className="truncate text-[14.5px] font-bold">
                        {conversation.other.name}
                      </span>
                      <TagPill tag={tagOf(conversation.other, auto)} size={10} />
                      <span className="grow" />
                      {conversation.last ? (
                        <span className="flex shrink-0 items-center gap-1 text-[10.5px] text-faint">
                          {conversation.last.senderId === user.id ? (
                            <Ticks state={receiptOf(conversation.last)} size={14} />
                          ) : null}
                          {timeOfDay(conversation.last.createdAt)}
                        </span>
                      ) : null}
                    </span>

                    <span className="mt-0.5 flex items-center gap-2">
                      <span
                        className="min-w-0 grow truncate text-[12.5px]"
                        style={{
                          color: conversation.unseen > 0 ? "var(--color-ink)" : "var(--color-muted)",
                          fontWeight: conversation.unseen > 0 ? 600 : 400,
                        }}
                      >
                        {conversation.last
                          ? `${conversation.last.senderId === user.id ? "أنت: " : ""}${conversation.last.body}`
                          : "ابدأ الحديث"}
                      </span>
                      {conversation.unseen > 0 ? (
                        <span
                          className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1 text-[10.5px] font-bold"
                          style={{ background: "var(--color-clay)", color: "var(--color-on-brand)" }}
                        >
                          {ar(conversation.unseen)}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </Link>
              </SwipeRow>
            ))}
          </div>
        ) : null}

        {others.length > 0 ? (
          <>
            <p className="mb-1.5 px-1 text-[11.5px] font-semibold tracking-wide text-faint">
              ابدأ محادثة
            </p>
            <div className="overflow-hidden rounded-2xl border border-line bg-card">
              {others.map((person, index) => (
                <form
                  key={person.id}
                  action={startConversation.bind(null, person.id)}
                  style={{ borderTop: index === 0 ? "none" : "1px solid var(--color-line)" }}
                >
                  <button type="submit" className="flex w-full items-center gap-3 p-3 text-right">
                    <span className="relative shrink-0">
                      <Avatar
                        name={person.name}
                        size={42}
                        frameSpec={person.frame?.spec}
                        charm={person.charm}
                        mediaId={person.avatarMediaId}
                      />
                      {online(person.lastSeenAt) ? (
                        <span
                          className="absolute bottom-0 left-0 block h-2.5 w-2.5 rounded-full"
                          style={{ background: "#3fbf6a", border: "2px solid var(--color-card)" }}
                        />
                      ) : null}
                    </span>
                    <span className="flex min-w-0 grow items-center gap-1.5">
                      <span className="truncate text-[14px] font-semibold">{person.name}</span>
                      <TagPill tag={tagOf(person, auto)} size={10} />
                    </span>
                    <span className="shrink-0 text-[12px] font-semibold text-clay-ink">تحدّث</span>
                  </button>
                </form>
              ))}
            </div>
          </>
        ) : null}
      </main>

      <TabBar active="/messages" />
    </div>
  );
}
