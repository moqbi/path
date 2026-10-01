"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { momentAudience, setCommentsLock, type AudienceView } from "@/app/actions";
import { EyeIcon, LockIcon, UnlockIcon } from "@/components/icons";
import { ReactionGlyph } from "@/components/reactions";
import { Avatar } from "@/components/ui";
import { ar } from "@/lib/format";

/**
 * لوحةُ صاحب اللحظة — **بقرار المالك** (القاعدة ٢٠٢): قفلُ التعليقات وعددُ
 * من شاهدها. ووجوهُ المشاهدين ليست هنا بل صفٌّ واحد تحت البطاقة ظاهرٌ بلا
 * ضغطة (`AuthorFaces`) — كان صفّاً ثانياً يكرّر ما تحتها. نسخةُ الجوّال.
 */
export function AuthorPanel({
  momentId,
  locked,
  onLocked,
}: {
  momentId: string;
  locked: boolean;
  /** القفلُ يُرى على زرّ التفاعل نفسه، فحالتُه عند الشريط لا هنا. */
  onLocked: (locked: boolean) => void;
}) {
  const [views, setViews] = useState<number | null>(null);
  const [, start] = useTransition();

  useEffect(() => {
    let live = true;
    void momentAudience(momentId).then((said) => {
      if (!live || "error" in said) return;
      setViews(said.views);
      onLocked(said.commentsLocked);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [momentId]);

  const stop = (event: React.SyntheticEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div className="flex items-center gap-2.5">
      <button
        type="button"
        role="switch"
        aria-checked={locked}
        onClick={(event) => {
          stop(event);
          const next = !locked;
          onLocked(next);
          start(async () => {
            const said = await setCommentsLock(momentId, next);
            if (said.error) onLocked(!next);
          });
        }}
        className="flex h-8 items-center gap-1.5 rounded-full border px-3 text-[11.5px] font-bold"
        style={{
          borderColor: locked ? "var(--color-clay)" : "var(--color-line)",
          background: locked ? "var(--color-clay-soft)" : "var(--color-card)",
          color: locked ? "var(--color-clay-ink)" : "var(--color-muted)",
        }}
      >
        {locked ? <LockIcon size={15} /> : <UnlockIcon size={15} />}
        {locked ? "التعليقات مقفلة" : "التعليقات مفتوحة"}
      </button>
      <span className="flex items-center gap-1.5 text-[12px] font-semibold text-muted">
        <EyeIcon size={15} />
        {views === null ? "…" : `${ar(views)} مشاهدة`}
      </span>
    </div>
  );
}

/**
 * وجوهُ لحظتي — لصاحبها وحده، **بقرار المالك**: صفٌّ واحد تحت البطاقة
 * يُرى بلا ضغطة ويُمرَّر أفقياً. من تفاعل بصورته وشارةِ تفاعله، ومن شاهد
 * ولم يتفاعل باهتاً. بدلُ `Reactors` لا إضافةٌ إليه.
 */
export function AuthorFaces({ momentId }: { momentId: string }) {
  const [people, setPeople] = useState<AudienceView["people"]>([]);

  useEffect(() => {
    let live = true;
    void momentAudience(momentId).then((said) => {
      if (live && !("error" in said)) setPeople(said.people);
    });
    return () => {
      live = false;
    };
  }, [momentId]);

  if (people.length === 0) return null;
  return (
    <div className="-m-1 flex gap-2.5 overflow-x-auto p-1 pt-2" style={{ scrollbarWidth: "none" }}>
      {people.map(({ user, reaction }) => (
        <Link
          key={user.id}
          href={`/u/${user.id}`}
          onClick={(event) => event.stopPropagation()}
          aria-label={reaction ? `${user.name} تفاعل` : `${user.name} شاهد`}
          className="relative shrink-0"
          style={{ width: 32, height: 32 }}
        >
          <span className="block" style={{ opacity: reaction ? 1 : 0.38 }}>
            <Avatar name={user.name} mediaId={user.avatarMediaId} size={32} />
          </span>
          {reaction ? (
            <span
              className="absolute flex items-center justify-center rounded-full border border-line bg-card"
              style={{ top: -3, insetInlineStart: -3, width: 20, height: 20 }}
            >
              <ReactionGlyph kind={reaction.kind} emoji={reaction.emoji} size={13} />
            </span>
          ) : null}
        </Link>
      ))}
    </div>
  );
}

/**
 * صفحةُ اللحظة لصاحبها: القفلُ والمشاهدات، ثمّ صفُّ الوجوه تحتهما — الترتيبُ
 * نفسه الذي في البطاقة. وحالةُ القفل هنا لأنّ الصفحة مكوّنُ خادم.
 */
export function AuthorSummary({ momentId, locked: initial }: { momentId: string; locked: boolean }) {
  const [locked, setLocked] = useState(initial);
  return (
    <div className="flex flex-col gap-2.5">
      <AuthorPanel momentId={momentId} locked={locked} onLocked={setLocked} />
      <AuthorFaces momentId={momentId} />
    </div>
  );
}
