"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { momentAudience, setCommentsLock, type AudienceView } from "@/app/actions";
import { EyeIcon, LockIcon, UnlockIcon } from "@/components/icons";
import { ReactionGlyph } from "@/components/reactions";
import { Avatar } from "@/components/ui";
import { ar } from "@/lib/format";

/**
 * لوحةُ صاحب اللحظة — **بقرار المالك** (القاعدة ٢٠٢): لا وجوهَ تفاعلٍ يضغطها
 * على لحظته، بل قفلُ التعليقات، وعددُ من شاهدها، ووجوهُهم صفّاً يُمرَّر
 * أفقياً — من تفاعل بصورته كاملةً وشارةِ تفاعله، ومن شاهد ولم يتفاعل
 * بصورةٍ باهتة. نسخةُ `AuthorPanel` في الجوّال.
 */
export function AuthorPanel({ momentId, locked: initial }: { momentId: string; locked: boolean }) {
  const [data, setData] = useState<AudienceView | null>(null);
  const [locked, setLocked] = useState(initial);
  const [, start] = useTransition();

  useEffect(() => {
    let live = true;
    void momentAudience(momentId).then((said) => {
      if (!live || "error" in said) return;
      setData(said);
      setLocked(said.commentsLocked);
    });
    return () => {
      live = false;
    };
  }, [momentId]);

  const stop = (event: React.SyntheticEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          role="switch"
          aria-checked={locked}
          onClick={(event) => {
            stop(event);
            const next = !locked;
            setLocked(next);
            start(async () => {
              const said = await setCommentsLock(momentId, next);
              if (said.error) setLocked(!next);
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
          {data ? `${ar(data.views)} مشاهدة` : "…"}
        </span>
      </div>

      {data && data.people.length === 0 ? (
        <p className="py-1.5 text-[11.5px] text-faint">لم يشاهدها أحدٌ بعد.</p>
      ) : data ? (
        <div className="flex gap-2.5 overflow-x-auto py-1" style={{ scrollbarWidth: "none" }}>
          {data.people.map(({ user, reaction }) => (
            <Link
              key={user.id}
              href={`/u/${user.id}`}
              onClick={(event) => event.stopPropagation()}
              aria-label={reaction ? `${user.name} تفاعل` : `${user.name} شاهد`}
              className="relative flex w-[52px] shrink-0 flex-col items-center gap-1"
            >
              <span style={{ opacity: reaction ? 1 : 0.4 }}>
                <Avatar name={user.name} mediaId={user.avatarMediaId} frame={user.frame} size={44} />
              </span>
              {reaction ? (
                <span
                  className="absolute flex items-center justify-center rounded-full border border-line bg-card"
                  style={{ top: 28, left: 0, width: 22, height: 22 }}
                >
                  <ReactionGlyph kind={reaction.kind} emoji={reaction.emoji} size={15} />
                </span>
              ) : null}
              <span
                dir="auto"
                className="max-w-[52px] truncate text-[10.5px]"
                style={{ color: reaction ? "var(--color-ink)" : "var(--color-faint)" }}
              >
                {user.name}
              </span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
