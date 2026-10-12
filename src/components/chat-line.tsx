import type { ReactNode } from "react";
import { Avatar, NameTag } from "@/components/ui";
import { ar, timeOfDay } from "@/lib/format";

type Worn = { spec: string; mediaId: string | null; frameHole?: number | null } | null;

export type ChatPerson = {
  id: string;
  name: string;
  avatarMediaId: string | null;
  frame?: Worn;
  charm?: { spec: string; mediaId: string | null } | null;
  isPlus?: boolean;
  tag?: { name: string; bg: string; fg: string } | null;
};

/** «٢٠٢٦/١٠/١، ١:٤٠ ص» — ميلاديٌّ بأرقامٍ عربيّة (القاعدة ١١٨)، كالجوّال. */
export function stamp(date: Date): string {
  return `${ar(date.getFullYear())}/${ar(date.getMonth() + 1)}/${ar(date.getDate())}، ${timeOfDay(date)}`;
}

/** رأسُ الرسالة يُعاد إذا تبدّل المرسل أو مضت خمس دقائق. */
export function needsHead(
  line: { senderId: string; createdAt: Date; system?: boolean },
  before: { senderId: string; createdAt: Date; system?: boolean } | undefined,
): boolean {
  if (!before || before.system || before.senderId !== line.senderId) return true;
  return line.createdAt.getTime() - before.createdAt.getTime() > 5 * 60_000;
}

const AVATAR = 40;

/**
 * سطرُ الرسالة — نسخةُ `apps/mobile/components/chat-line.tsx` (القاعدة ٢١٦):
 * صورةُ المرسل بإطاره وتشارمه، وبجانبها اسمُه ووسمُه، وفي الطرف المقابل
 * التاريخُ والساعة، ثمّ الفقاعةُ تحتها. غيري في جهة البداية وأنا في المقابلة
 * (`flex-row-reverse` انعكاسُ جهةٍ مقصود)، والسلسلةُ الواحدة بلا رأسٍ مكرّر.
 */
export function ChatLine({
  person,
  mine,
  at,
  head,
  meta,
  children,
}: {
  person: ChatPerson;
  mine: boolean;
  at: Date;
  head: boolean;
  meta?: ReactNode;
  children: ReactNode;
}) {
  const row = mine ? "flex-row-reverse" : "flex-row";
  return (
    <div className={`flex ${row} items-start gap-2.5`} style={{ marginTop: head ? 12 : 2 }}>
      {head ? (
        <span className="shrink-0">
          <Avatar name={person.name} size={AVATAR} mediaId={person.avatarMediaId} frame={person.frame ?? null} charm={person.charm ?? null} />
        </span>
      ) : (
        <span className="shrink-0" style={{ width: AVATAR }} />
      )}
      <div className="flex min-w-0 grow flex-col gap-1.5">
        {head ? (
          <div className={`flex ${row} items-center gap-2`}>
            <span className={`flex ${row} min-w-0 items-center gap-1.5`}>
              <span dir="auto" className="truncate text-[13.5px] font-bold text-ground-ink">
                {person.name}
              </span>
              <NameTag isPlus={person.isPlus ?? false} tag={person.tag ?? null} size={9} />
            </span>
            <span className="grow" />
            <span className="shrink-0 text-[10.5px] text-ground-faint">{stamp(at)}</span>
          </div>
        ) : null}
        <div className="flex flex-col" style={{ alignItems: mine ? "flex-end" : "flex-start" }}>
          {children}
        </div>
        {meta ? <div className={`flex ${row} items-center gap-1.5 text-[10px] text-ground-faint`}>{meta}</div> : null}
      </div>
    </div>
  );
}
