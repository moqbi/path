import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { notifications, type NoteKind } from "@/lib/notifications";
import { ReactionGlyph } from "@/components/reactions";
import { Avatar, Empty, itemPaint } from "@/components/ui";
import { TabBar } from "@/components/tab-bar";
import { AthrPageMark } from "@/components/brand";
import { MessageIcon, SparkIcon, StoreIcon, TagIcon, WithIcon } from "@/components/icons";
import { ar, dayLabel, relative } from "@/lib/format";

const FILTERS = [
  { key: "", label: "الكل" },
  { key: "reactions", label: "التفاعلات" },
  { key: "tags", label: "الإشارات" },
  { key: "messages", label: "الرسائل" },
] as const;

const OF: Record<string, NoteKind[]> = {
  reactions: ["REACTION", "COMMENT"],
  tags: ["TAG"],
  messages: ["MESSAGE"],
};

/** لون دائرة النوع: التفاعل كهرماني، الإشارة مرجانية، الصداقة خضراء. */
const KIND_STYLE: Record<NoteKind, { bg: string; ink: string }> = {
  REACTION: { bg: "var(--color-clay-soft)", ink: "var(--color-clay-ink)" },
  COMMENT: { bg: "var(--color-chip)", ink: "var(--color-ink-2)" },
  TAG: { bg: "var(--color-live-soft)", ink: "var(--color-live)" },
  FRIEND: { bg: "#e3f3e8", ink: "#2f9e58" },
  MESSAGE: { bg: "var(--color-gold-soft)", ink: "var(--color-gold-ink)" },
  GIFT: { bg: "var(--color-gold-soft)", ink: "var(--color-gold-ink)" },
  STORE: { bg: "var(--color-clay-soft)", ink: "var(--color-clay-ink)" },
};

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");

  const { t } = await searchParams;
  const all = await notifications(user.id);
  const kinds = t ? OF[t] : undefined;
  const notes = kinds ? all.filter((note) => kinds.includes(note.kind)) : all;

  const days: { label: string; items: typeof notes }[] = [];
  for (const note of notes) {
    const label = dayLabel(note.at);
    const last = days.at(-1);
    if (last && last.label === label) last.items.push(note);
    else days.push({ label, items: [note] });
  }

  return (
    <div className="screen">
      {/* الإعدادات تُفتح من تبويب «أنا»، فلا ترس هنا. */}
      <header className="chrome flex items-center px-5 pb-3 pt-4">
        <AthrPageMark label="الإشعارات" />
      </header>

      <div className="shrink-0 px-5 pb-1 pt-3">
        <div className="no-bar flex gap-2 overflow-x-auto">
          {FILTERS.map((filter) => {
            const on = (t ?? "") === filter.key;
            return (
              <Link
                key={filter.key || "all"}
                href={filter.key ? `/notifications?t=${filter.key}` : "/notifications"}
                className="shrink-0 rounded-full px-4 py-2 text-[12.5px] font-semibold"
                style={{
                  background: on ? "var(--color-clay)" : "var(--color-card)",
                  color: on ? "var(--color-on-brand)" : "var(--color-ink-2)",
                  border: `1px solid ${on ? "var(--color-clay)" : "var(--color-line)"}`,
                }}
              >
                {filter.label}
              </Link>
            );
          })}
        </div>
      </div>

      <main className="scroll-area px-5 pt-3">
        {notes.length === 0 ? (
          <Empty
            title="ما فيه إشعارات"
            hint="حين يتفاعل أحدٌ من أصدقائك أو يشير إليك، يظهر هنا."
            action={{ href: "/", label: "ارجع للحظات" }}
          />
        ) : (
          days.map((day) => (
            <section key={day.label} className="mb-4">
              <p className="mb-2 px-1 text-[11.5px] font-semibold tracking-wide text-faint">
                {day.label}
              </p>

              <div className="flex flex-col gap-2">
                {day.items.map((note) => {
                  const style = KIND_STYLE[note.kind];
                  return (
                    <Link
                      key={note.id}
                      href={note.href}
                      className="flex items-center gap-3 rounded-2xl border border-line bg-card p-3"
                    >
                      {/* الصورة ومعها دائرة النوع — من فعل، وماذا فعل. */}
                      <span className="relative shrink-0">
                        {note.person ? (
                          <Avatar
                            name={note.person.name}
                            size={44}
                            mediaId={note.person.avatarMediaId}
                          />
                        ) : (
                          /* خبرُ المتجر لا صاحب له، فرسمُ الصنف مكان الصورة. */
                          <span
                            className="block h-11 w-11 rounded-full"
                            style={note.item ? itemPaint(note.item) : { background: "var(--color-chip)" }}
                          />
                        )}
                        <span
                          className="absolute -bottom-1 -left-1 flex h-5 w-5 items-center justify-center rounded-full"
                          style={{ background: style.bg, color: style.ink, border: "1.5px solid var(--color-card)" }}
                        >
                          {note.kind === "REACTION" ? (
                            <ReactionGlyph kind={note.reaction ?? "SMILE"} emoji={note.emoji} size={12} />
                          ) : note.kind === "MESSAGE" ? (
                            <MessageIcon size={11} />
                          ) : note.kind === "TAG" ? (
                            <TagIcon size={11} />
                          ) : note.kind === "FRIEND" ? (
                            <WithIcon size={11} />
                          ) : note.kind === "GIFT" ? (
                            <SparkIcon size={11} />
                          ) : note.kind === "STORE" ? (
                            <StoreIcon size={11} />
                          ) : (
                            <MessageIcon size={11} />
                          )}
                        </span>
                      </span>

                      <span className="min-w-0 grow">
                        <span className="block text-[13.5px] leading-snug">{note.text}</span>
                        <span className="mt-0.5 block text-[11px] text-faint">
                          {relative(note.at)}
                        </span>
                      </span>

                      {note.thumb ? (
                        <span
                          className="h-11 w-11 shrink-0 rounded-xl bg-cover bg-center"
                          style={{ backgroundImage: `url(/api/media/${note.thumb})` }}
                        />
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </main>

      <TabBar active="/notifications" />
    </div>
  );
}
