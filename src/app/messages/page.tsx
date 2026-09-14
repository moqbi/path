import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { conversationsFor, KEEP_DAYS } from "@/lib/dm";
import { Avatar, Empty, NameTag } from "@/components/ui";
import { TabBar } from "@/components/tab-bar";
import { AthrHeaderMark } from "@/components/brand";
import { ClockIcon, SearchIcon } from "@/components/icons";
import { ar, timeOfDay } from "@/lib/format";
import { SwipeRow } from "@/components/swipe-row";
import { deleteConversation, markDelivered } from "@/app/actions";
import { Ticks, receiptOf } from "@/components/receipt";

/** سطر المعاينة: الصوت والصورة لا نصّ لهما، فيُقال ما هما. */
function preview(last: { kind: string; body: string; seconds: number | null }): string {
  if (last.kind === "VOICE") return `رسالة صوتية · ${ar(last.seconds ?? 0)}″`;
  if (last.kind === "PHOTO") return "صورة";
  return last.body;
}

const FILTERS = [
  { key: "", label: "الكل" },
  { key: "unread", label: "غير مقروءة" },
  { key: "online", label: "متصلون" },
] as const;

/**
 * المحادثات: العلامة في الرأس، ثم بحث، ثم مرشّحات، ثم الصفوف —
 * الاسم والوقت في سطر، وآخر رسالة تحته، وشارة تقول كم ينتظر.
 * محادثاتٌ فقط: قائمة الأصدقاء لها تبويبها، ومنه تُفتح محادثة جديدة.
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

  const conversations = await conversationsFor(user.id);

  const online = (at: Date | null | undefined) =>
    Boolean(at && Date.now() - at.getTime() < 3 * 60_000);
  const match = (name: string) => !term || name.includes(term);

  const threads = conversations
    .filter((row) => match(row.other.name))
    .filter((row) =>
      filter === "unread" ? row.unseen > 0 : filter === "online" ? online(row.other.lastSeenAt) : true,
    );
  const unreadTotal = conversations.reduce((sum, row) => sum + row.unseen, 0);

  return (
    <div className="screen">
      {/*
        الرأس علامةٌ وبحث، بلا أيقونة «محادثة جديدة»: كانت تفتح الأصدقاء،
        وهم تبويبٌ في الشريط تحت — وهذه الشاشة صارت محادثاتٍ فقط.
      */}
      <header className="chrome px-4 pb-3 pt-4">
        <div className="mb-3 flex items-center justify-between">
          <AthrHeaderMark />
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
        {threads.length === 0 ? (
          <Empty
            title={term || filter ? "ما فيه شيء هنا" : "ما عندك محادثات"}
            hint={term || filter ? undefined : "افتح أصدقائك واضغط أيقونة الرسالة بجانب صاحبك."}
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
                      <NameTag isPlus={conversation.other.isPlus} tag={conversation.other.tag} size={10} />
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
                          ? `${conversation.last.senderId === user.id ? "أنت: " : ""}${preview(conversation.last)}`
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

        {threads.length > 0 ? (
          <p className="flex items-center justify-center gap-2 pb-6 pt-2 text-center text-[11px] text-faint">
            <ClockIcon size={13} />
            المحادثات تُحذف بعد {ar(KEEP_DAYS)} يوماً — لا نحتفظ بها
          </p>
        ) : null}
      </main>

      <TabBar active="/messages" />
    </div>
  );
}
