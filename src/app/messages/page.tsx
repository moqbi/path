import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { conversationsFor, KEEP_DAYS } from "@/lib/dm";
import { Avatar, Empty, NameTag } from "@/components/ui";
import { TabBar } from "@/components/tab-bar";
import { AthrPageMark } from "@/components/brand";
import { ClockIcon, SearchIcon, StarIcon } from "@/components/icons";
import { ar, relative, timeOfDay } from "@/lib/format";
import { deleteConversation, markDelivered } from "@/app/actions";
import { Ticks, receiptOf } from "@/components/receipt";
import { groupsFor } from "@/lib/groups";
import { GroupFace } from "@/components/group-face";
import { PinRow } from "./pin-row";

/** سطر المعاينة: الصوت والصورة لا نصّ لهما، فيُقال ما هما. */
function preview(last: { kind: string; body: string; seconds: number | null }): string {
  if (last.kind === "VOICE") return `رسالة صوتية · ${ar(last.seconds ?? 0)}″`;
  if (last.kind === "PHOTO") return "صورة";
  return last.body;
}

/**
 * المحادثات: العلامة في الرأس، ثم بحث، ثم مرشّحات، ثم الصفوف —
 * الاسم والوقت في سطر، وآخر رسالة تحته، وشارة تقول كم ينتظر.
 * محادثاتٌ فقط: قائمة الأصدقاء لها تبويبها، ومنه تُفتح محادثة جديدة.
 */
export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");

  const { q } = await searchParams;
  const term = (q ?? "").trim();

  // فتحُ الشاشة يعني أنّ ما وصلني قد وصل فعلاً: نكتب التسليم قبل القراءة.
  await markDelivered();

  const [conversations, groups] = await Promise.all([conversationsFor(user.id), groupsFor(user.id)]);

  const match = (name: string) => !term || name.includes(term);

  const threads = conversations.filter((row) => match(row.other.name));

  // ثلاثةُ أقسامٍ كالجوّال (القاعدتان ٢٢٠ و٢٦٤): المفضّلةُ بترتيب تثبيتها، فالمجموعات، فالبقيّة.
  const pinned = threads
    .filter((row) => row.pinnedAt)
    .sort((a, b) => a.pinnedAt!.getTime() - b.pinnedAt!.getTime());
  const rest = threads.filter((row) => !row.pinnedAt);
  const groupRows = groups.filter((row) => match(row.name));

  return (
    <div className="screen">
      {/*
        رأسٌ كالجوّال (القاعدة ٨٦): العلامةُ ثمّ اسمُ الشاشة، والبحثُ حقلٌ على
        الورق تحته — بلا مرشّحات: الأقسامُ تطوي ما لا يُراد.
      */}
      <header className="chrome flex items-center px-5 pb-3 pt-4">
        <AthrPageMark label="المحادثات" />
      </header>

      <main className="scroll-area px-4 pt-3">
        <form
          action="/messages"
          className="mb-2 flex items-center gap-2 rounded-2xl border border-line bg-card px-4"
          style={{ height: 46 }}
        >
          <span className="text-muted">
            <SearchIcon size={18} />
          </span>
          <input
            name="q"
            defaultValue={term}
            suppressHydrationWarning
            placeholder="ابحث باسم صديق"
            aria-label="ابحث"
            className="min-w-0 grow bg-transparent text-[14px] text-ink outline-none"
          />
        </form>

        {threads.length === 0 && groupRows.length === 0 ? (
          <Empty
            title={term ? "ما فيه شيء هنا" : "ما عندك محادثات"}
            hint={term ? undefined : "افتح أصدقائك واضغط أيقونة الرسالة بجانب صاحبك."}
            action={term ? undefined : { href: "/circle", label: "افتح أصدقائي" }}
          />
        ) : null}

        {pinned.length > 0 ? (
          <Section title="المفضّلة" count={pinned.length}>
            {pinned.map((conversation) => (
              <ConversationRow key={conversation.id} conversation={conversation} meId={user.id} />
            ))}
          </Section>
        ) : null}

        {groupRows.length > 0 ? (
          <Section title="المجموعات" count={groupRows.length}>
            {groupRows.map((group) => (
              <Link
                key={group.id}
                href={`/group/${group.id}`}
                className="flex items-center gap-3 px-1 py-2.5"
              >
                <GroupFace photoMediaId={group.photoMediaId} size={48} />
                <span className="min-w-0 grow">
                  <span className="flex items-baseline gap-1.5">
                    <span dir="auto" className="truncate text-[15px] font-bold text-ground-ink">{group.name}</span>
                    <span className="shrink-0 text-[11px] text-faint">{ar(group.members)} عضو</span>
                    <span className="grow" />
                    {group.last ? (
                      <span className="shrink-0 text-[10.5px] text-faint">{timeOfDay(group.last.createdAt)}</span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 flex items-center gap-2">
                    <span
                      className="min-w-0 grow truncate text-[12.5px]"
                      style={{
                        color: group.unseen > 0 ? "var(--color-ground-ink)" : "var(--color-ground-muted)",
                        fontWeight: group.unseen > 0 ? 600 : 400,
                      }}
                    >
                      {group.last
                        ? group.last.system
                          ? group.last.body
                          : `${group.last.senderId === user.id ? "أنت" : group.last.sender.name}: ${preview(group.last)}`
                        : "ابدأ الحديث"}
                    </span>
                    {group.unseen > 0 ? (
                      <span
                        className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1 text-[10.5px] font-bold"
                        style={{ background: "var(--color-clay)", color: "var(--color-on-brand)" }}
                      >
                        {ar(group.unseen)}
                      </span>
                    ) : null}
                  </span>
                </span>
              </Link>
            ))}
          </Section>
        ) : null}

        {rest.length > 0 ? (
          <Section title="المحادثات" count={rest.length}>
            {rest.map((conversation) => (
              <ConversationRow key={conversation.id} conversation={conversation} meId={user.id} />
            ))}
          </Section>
        ) : null}

        {threads.length + groupRows.length > 0 ? (
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

/** قسمٌ يُطوى ويُفتح — كقسمَي الأصدقاء (القاعدة ١٦١)، و`details` يحفظ حالته بلا جافاسكربت. */
function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <details open className="group mb-3">
      <summary className="flex cursor-pointer list-none items-center gap-2 py-3 [&::-webkit-details-marker]:hidden">
        <span className="grow text-[15px] font-bold text-ground-ink">
          {title} ({ar(count)})
        </span>
        <span className="text-[12.5px] font-semibold text-ground-ink-2 group-open:hidden">إظهار</span>
        <span className="hidden text-[12.5px] font-semibold text-ground-ink-2 group-open:inline">إخفاء</span>
      </summary>
      <div>{children}</div>
    </details>
  );
}

type Row = Awaited<ReturnType<typeof conversationsFor>>[number];

function ConversationRow({ conversation, meId }: { conversation: Row; meId: string }) {
  const online = Boolean(conversation.other.lastSeenAt && Date.now() - conversation.other.lastSeenAt.getTime() < 3 * 60_000);
  return (
    <PinRow
      conversationId={conversation.id}
      pinned={Boolean(conversation.pinnedAt)}
      onDelete={deleteConversation.bind(null, conversation.id)}
    >
      <Link
        href={`/messages/${conversation.id}`}
        className="flex items-center gap-3 px-1 py-2.5"
      >
        <span className="relative shrink-0">
          <Avatar
            name={conversation.other.name}
            size={48}
            frame={conversation.other.frame}
            charm={conversation.other.charm}
            mediaId={conversation.other.avatarMediaId}
          />
          {online ? (
            <span
              className="absolute bottom-0 left-0 block h-3 w-3 rounded-full"
              style={{ background: "#3fbf6a", border: "2px solid var(--color-card)" }}
            />
          ) : null}
        </span>

        <span className="min-w-0 grow">
          <span className="flex items-baseline gap-1.5">
            <span dir="auto" className="truncate text-[15px] font-bold text-ground-ink">{conversation.other.name}</span>
            <NameTag isPlus={conversation.other.isPlus} tag={conversation.other.tag} size={10} />
            {conversation.pinnedAt ? (
              <span className="shrink-0 text-clay-ink" aria-label="مفضّلة">
                <StarIcon size={12} />
              </span>
            ) : null}
            {conversation.last ? (
              <span className="shrink-0 text-[11px] text-ground-muted">{relative(conversation.last.createdAt)}</span>
            ) : null}
          </span>

          <span className="mt-0.5 flex items-center gap-1.5">
            {conversation.last?.senderId === meId ? <Ticks state={receiptOf(conversation.last)} size={14} /> : null}
            <span
              className="min-w-0 grow truncate text-[13px]"
              style={{
                color: conversation.unseen > 0 ? "var(--color-ground-ink)" : "var(--color-ground-muted)",
                fontWeight: conversation.unseen > 0 ? 600 : 400,
              }}
            >
              {conversation.last ? preview(conversation.last) : "ابدأ الحديث"}
            </span>
          </span>
        </span>

        {conversation.unseen > 0 ? (
          <span
            className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1 text-[10.5px] font-bold"
            style={{ background: "var(--color-clay)", color: "var(--color-on-brand)" }}
          >
            {ar(conversation.unseen)}
          </span>
        ) : null}
      </Link>
    </PinRow>
  );
}
