import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { notifications, type NoteKind } from "@/lib/notifications";
import { NoteRow } from "@/components/note-row";
import { ClearNotes } from "@/components/note-dismiss";
import { Empty } from "@/components/ui";
import { TabBar } from "@/components/tab-bar";
import { AthrPageMark } from "@/components/brand";
import { dayLabel } from "@/lib/format";

const FILTERS = [
  { key: "", label: "الكل" },
  { key: "reactions", label: "التفاعلات" },
  { key: "tags", label: "الإشارات" },
  { key: "messages", label: "الرسائل" },
  // «آثار»: ما يأتي من التطبيق لا من صديق — جديدُ المتجر وأخباره.
  { key: "athar", label: "آثار" },
] as const;

const OF: Record<string, NoteKind[]> = {
  reactions: ["REACTION", "COMMENT"],
  tags: ["TAG"],
  messages: ["MESSAGE"],
  athar: ["STORE"],
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
      <header className="chrome flex items-center justify-between px-5 pb-3 pt-4">
        <AthrPageMark label="الإشعارات" />
        {all.length > 0 ? <ClearNotes /> : null}
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
                {day.items.map((note) => (
                  <NoteRow key={note.id} note={note} />
                ))}
              </div>
            </section>
          ))
        )}
      </main>

      <TabBar active="/notifications" />
    </div>
  );
}
