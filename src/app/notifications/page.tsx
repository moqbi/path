import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { notifications, type NoteKind } from "@/lib/notifications";
import { ReactionGlyph } from "@/components/reactions";
import { Avatar, Empty, ScreenHeader } from "@/components/ui";
import { TabBar } from "@/components/tab-bar";
import { MessageIcon, TagIcon, WithIcon } from "@/components/icons";
import { relative } from "@/lib/format";

const FILTERS = [
  { key: "", label: "الكل" },
  { key: "reactions", label: "تفاعلات" },
  { key: "tags", label: "إشارات" },
  { key: "messages", label: "رسائل" },
] as const;

const OF: Record<string, NoteKind[]> = {
  reactions: ["REACTION", "COMMENT"],
  tags: ["TAG"],
  messages: ["MESSAGE"],
};

/** الإشعارات مشتقّة من الجداول القائمة — `lib/notifications`. */
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

  return (
    <div className="screen">
      <ScreenHeader title="الإشعارات" back="/" />

      <main className="scroll-area px-5">
        <div className="no-bar flex gap-2 overflow-x-auto py-3">
          {FILTERS.map((filter) => {
            const on = (t ?? "") === filter.key;
            return (
              <Link
                key={filter.key}
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

        {notes.length === 0 ? (
          <Empty title="ما فيه إشعارات" hint="حين يتفاعل أحدٌ من دائرتك أو يشير إليك، يظهر هنا." />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-line bg-card">
            {notes.map((note, index) => (
              <Link
                key={note.id}
                href={note.href}
                className="flex items-center gap-3 p-3"
                style={{ borderTop: index === 0 ? "none" : "1px solid var(--color-line)" }}
              >
                <Avatar name={note.person.name} size={42} mediaId={note.person.avatarMediaId} />
                <span className="min-w-0 grow">
                  <span className="block truncate text-[13.5px] leading-snug">{note.text}</span>
                  <span className="block text-[11px] text-faint">{relative(note.at)}</span>
                </span>
                <span className="shrink-0 text-muted">
                  {note.kind === "REACTION" ? (
                    <ReactionGlyph kind={note.reaction ?? "SMILE"} emoji={note.emoji} size={20} />
                  ) : note.kind === "MESSAGE" ? (
                    <MessageIcon size={18} />
                  ) : note.kind === "TAG" ? (
                    <TagIcon size={18} />
                  ) : note.kind === "FRIEND" ? (
                    <WithIcon size={18} />
                  ) : (
                    <MessageIcon size={18} />
                  )}
                </span>
              </Link>
            ))}
          </div>
        )}
      </main>

      <TabBar active="/notifications" />
    </div>
  );
}
