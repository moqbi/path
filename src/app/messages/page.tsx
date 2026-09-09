import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { circleIds } from "@/lib/circle";
import { conversationsFor } from "@/lib/dm";
import { Avatar, Empty, TagPill } from "@/components/ui";
import { TabBar } from "@/components/tab-bar";
import { BackIcon, SearchIcon } from "@/components/icons";
import { plusTag, tagOf } from "@/lib/tags";
import { timeOfDay } from "@/lib/format";
import { SwipeRow } from "@/components/swipe-row";
import { deleteConversation, startConversation } from "@/app/actions";

/**
 * «تحدّث مع…» — كما كان في Path: شريطٌ فيه بحث، ثم المحادثات القائمة،
 * ثم بقية الأصدقاء لتبدأ معهم. البحث يمرّ على الاثنين معاً، فالسؤال
 * واحد: «مع من أتحدّث؟» لا «أين محادثتي؟».
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
      avatarMediaId: true,
      frame: { select: { spec: true } },
      tag: { select: { name: true, bg: true, fg: true } },
    },
    orderBy: { name: "asc" },
  });

  const match = (name: string) => !term || name.includes(term);
  const threads = conversations.filter((row) => match(row.other.name));
  const others = rest.filter((person) => match(person.name));

  return (
    <div className="screen">
      <header className="chrome px-4 pb-3 pt-4">
        <div className="mb-3 flex items-center gap-2">
          <Link
            href="/"
            aria-label="رجوع"
            className="flex h-9 w-9 items-center justify-center"
            style={{ color: "var(--color-chrome-ink)" }}
          >
            <BackIcon size={19} />
          </Link>
          <h1 className="grow text-center text-[17px] font-bold" style={{ color: "var(--color-chrome-ink)" }}>
            تحدّث مع…
          </h1>
          <span className="w-9" />
        </div>

        <form action="/messages" className="flex items-center gap-2 rounded-xl px-3" style={{ background: "var(--color-chrome-2)", height: 40 }}>
          <span style={{ color: "var(--color-chrome-muted)" }}>
            <SearchIcon size={17} />
          </span>
          <input
            name="q"
            defaultValue={term}
            // المتصفح يعيد ما كُتب في الحقل بعد التنقل، فيختلف عن قيمة
            // الخادم لحظة الترطيب — والاختلاف هنا متوقّع لا خلل.
            suppressHydrationWarning
            placeholder="ابحث باسم صاحبك"
            aria-label="ابحث"
            className="min-w-0 grow bg-transparent text-[13px] outline-none"
            style={{ color: "var(--color-chrome-ink)" }}
          />
        </form>
      </header>

      <main className="scroll-area px-4 pt-2">
        {threads.length === 0 && others.length === 0 ? (
          <Empty
            title={term ? "ما فيه أحد بهذا الاسم" : "ما عندك محادثات"}
            hint={term ? undefined : "اختر أحداً من أصدقائك تحت لتبدأ معه."}
            action={term ? undefined : { href: "/circle", label: "افتح أصدقائي" }}
          />
        ) : null}

        {threads.map((conversation) => (
          <SwipeRow key={conversation.id} onDelete={deleteConversation.bind(null, conversation.id)}>
            <Link
              href={`/messages/${conversation.id}`}
              className="flex items-start gap-3 py-3"
              style={{ background: "var(--color-paper)" }}
            >
              <Avatar
                name={conversation.other.name}
                size={48}
                frameSpec={conversation.other.frame?.spec}
                mediaId={conversation.other.avatarMediaId}
              />

              <span className="min-w-0 grow">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-[15px] font-bold">{conversation.other.name}</span>
                  <TagPill tag={tagOf(conversation.other, auto)} size={10} />
                </span>

                {/* آخر رسالة في فقاعة، كما في Path — تُقرأ كأنها قيلت للتوّ. */}
                <span
                  className="mt-1 inline-block max-w-full truncate rounded-2xl px-3 py-1.5 text-[13px]"
                  style={{
                    background: conversation.unread ? "var(--color-clay-soft)" : "var(--color-card)",
                    color: conversation.unread ? "var(--color-clay-ink)" : "var(--color-ink-2)",
                    fontWeight: conversation.unread ? 700 : 400,
                    border: "1px solid var(--color-line)",
                  }}
                >
                  {conversation.last?.body ?? "ابدأ الحديث"}
                </span>

                {conversation.last ? (
                  <span className="mt-1 block text-[11px] text-faint">
                    {timeOfDay(conversation.last.createdAt)}
                    {conversation.last.senderId === user.id ? " · أرسلتها" : ""}
                  </span>
                ) : null}
              </span>

              {conversation.unread ? (
                <span
                  className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: "var(--color-live)" }}
                />
              ) : null}
            </Link>
          </SwipeRow>
        ))}

        {others.length > 0 ? (
          <>
            <p className="mb-1 mt-4 px-1 text-[11.5px] font-semibold tracking-wide text-faint">
              أصدقاؤك
            </p>
            <div className="overflow-hidden rounded-2xl border border-line bg-card">
              {others.map((person, index) => (
                <form
                  key={person.id}
                  action={startConversation.bind(null, person.id)}
                  style={{ borderTop: index === 0 ? "none" : "1px solid var(--color-line)" }}
                >
                  <button type="submit" className="flex w-full items-center gap-3 p-3 text-right">
                    <Avatar
                      name={person.name}
                      size={42}
                      frameSpec={person.frame?.spec}
                      mediaId={person.avatarMediaId}
                    />
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
