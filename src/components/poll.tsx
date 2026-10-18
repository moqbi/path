"use client";

import { useEffect, useState, useTransition } from "react";
import { pollState, votePoll, type PollState } from "@/app/actions";
import { ar } from "@/lib/format";

/**
 * استطلاعُ المشرف على خاطرته (القاعدة ٢٨٩) — نسخةُ `components/poll.tsx` في
 * الجوّال: أزرارٌ بلا أرقام قبل التصويت، ثمّ شريطٌ لكلّ خيارٍ بنسبته والأعلى
 * بلون اللمسة. والخياراتُ تُرسم من اللحظة فوراً والأعدادُ تُجلب بعدها.
 * والضغطةُ توقف الصعود: البطاقةُ قد تجلس داخل رابط (القاعدة ٢٨).
 */
export function Poll({ momentId, options, author }: { momentId: string; options: string[]; author: boolean }) {
  const [state, setState] = useState<PollState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [picking, setPicking] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    pollState(momentId).then((result) => {
      if (alive && "poll" in result) setState(result.poll);
    });
    return () => {
      alive = false;
    };
  }, [momentId]);

  const vote = (choice: number) => {
    setPicking(choice);
    setError(null);
    start(async () => {
      const result = await votePoll(momentId, choice);
      if ("poll" in result) setState(result.poll);
      else setError(result.error);
      setPicking(null);
    });
  };

  const counts = state?.counts ?? null;
  const total = state?.total ?? 0;
  const mine = picking ?? state?.mine ?? null;
  const top = counts && total > 0 ? Math.max(...counts) : -1;

  return (
    <div className="mb-2.5 flex flex-col gap-2">
      {(state?.options ?? options).map((label, index) => {
        const count = counts?.[index] ?? 0;
        const pct = counts && total > 0 ? Math.round((count / total) * 100) : 0;
        const leading = counts !== null && count === top;
        const chosen = mine === index;
        return (
          <button
            key={index}
            type="button"
            aria-pressed={chosen}
            disabled={author || pending || chosen}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              vote(index);
            }}
            className={`relative min-h-11 overflow-hidden rounded-xl border bg-paper text-start disabled:cursor-default ${
              chosen ? "border-clay" : "border-line"
            }`}
          >
            {counts ? (
              <span
                aria-hidden
                className={`absolute inset-y-0 right-0 ${leading ? "bg-clay/55" : "bg-chip"}`}
                style={{ width: `${pct}%` }}
              />
            ) : null}
            <span className="relative flex items-center gap-2 px-3.5 py-2.5">
              {chosen ? <span aria-hidden className="text-[13px] font-bold text-ink">✓</span> : null}
              <span dir="auto" className={`min-w-0 flex-1 text-[13.5px] text-ink ${leading || chosen ? "font-bold" : "font-medium"}`}>
                {label}
              </span>
              {counts ? (
                <span className={`text-[12.5px] text-ink ${leading ? "font-extrabold" : "font-semibold"}`}>{ar(pct)}٪</span>
              ) : null}
            </span>
          </button>
        );
      })}
      <p className="text-[11.5px] text-muted">
        {error
          ? error
          : counts
            ? `${ar(total)} ${total === 1 ? "صوت" : "أصوات"}${author ? "" : " · اضغط خياراً آخر لتغيير صوتك"}`
            : "اختر لترى النتيجة"}
      </p>
    </div>
  );
}
