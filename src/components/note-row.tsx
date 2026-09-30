import Link from "next/link";
import type { Note, NoteKind } from "@/lib/notifications";
import { ReactionGlyph } from "@/components/reactions";
import { Avatar, itemPaint } from "@/components/ui";
import { MessageIcon, SparkIcon, StoreIcon, TagIcon, WithIcon } from "@/components/icons";
import { relative } from "@/lib/format";
import { BASE } from "@/lib/base";
import { NoteDismiss } from "@/components/note-dismiss";

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

/**
 * صفُّ إشعارٍ واحد — في تبويب الإشعارات وفي عمود «أنا» على سطح المكتب
 * معاً، فلا يختلف شكلُ الخبر بين مكانيه.
 */
export function NoteRow({ note }: { note: Note }) {
  const style = KIND_STYLE[note.kind];
  return (
    <div className="flex items-center gap-1 rounded-2xl border border-line bg-card p-3 ps-3 pe-1">
    <Link href={note.href} className="flex min-w-0 grow items-center gap-3">
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
          style={{ backgroundImage: `url(${BASE}/api/media/${note.thumb})` }}
        />
      ) : null}
    </Link>
    <NoteDismiss id={note.id} />
    </div>
  );
}
