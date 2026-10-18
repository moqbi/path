"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { pollState, votePoll, type PollState } from "@/app/actions";
import { ar } from "@/lib/format";

/** «باقي ٣ أيام» — نسخةُ `leftText` في الجوّال. */
function leftText(endsAt: Date): string {
  const ms = new Date(endsAt).getTime() - Date.now();
  const hours = Math.ceil(ms / 3_600_000);
  if (hours <= 1) return "باقي أقل من ساعة";
  if (hours < 24) return `باقي ${hours === 2 ? "ساعتين" : `${ar(hours)} ${hours <= 10 ? "ساعات" : "ساعة"}`}`;
  const days = Math.ceil(hours / 24);
  return `باقي ${days === 1 ? "يوم" : days === 2 ? "يومين" : `${ar(days)} ${days <= 10 ? "أيام" : "يوماً"}`}`;
}

/** الرقمُ يعدّ إلى قيمته مع امتداد الشريط (القاعدة ٢٩٠). */
function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const start = performance.now();
    const begin = from.current;
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 750);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = Math.round(begin + (value - begin) * eased);
      setShown(next);
      from.current = next;
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <>{ar(shown)}٪</>;
}

/**
 * استطلاعُ المشرف على خاطرته (القاعدتان ٢٨٩ و٢٩٠) — نسخةُ `components/poll.tsx` في
 * الجوّال: التصويتُ سرّيّ، أزرارٌ بلا أرقام قبل التصويت، ثمّ شريطٌ يمتدّ إلى نسبته
 * والأعلى بلون اللمسة، والنتيجةُ تُسأل كلّ ربع دقيقة فتتحرّك مع الأصوات. وبانتهاء
 * مدّته يُقفل والنتيجةُ للجميع. والضغطةُ توقف الصعود: البطاقةُ قد تجلس داخل رابط (القاعدة ٢٨).
 */
export function Poll({
  momentId,
  options,
  endsAt,
  author,
}: {
  momentId: string;
  options: string[];
  endsAt: Date | null;
  author: boolean;
}) {
  const [state, setState] = useState<PollState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [picking, setPicking] = useState<number | null>(null);
  // الشريطُ يبدأ من الصفر ثمّ يمتدّ: عرضٌ أوّل بلا انتقالٍ لا يُرى يتحرّك.
  const [grown, setGrown] = useState(false);

  const live = Boolean(state?.counts) && !state?.closed;
  useEffect(() => {
    let alive = true;
    const load = () =>
      pollState(momentId).then((result) => {
        if (alive && "poll" in result) setState(result.poll);
      });
    void load();
    const timer = live ? setInterval(load, 15_000) : undefined;
    return () => {
      alive = false;
      if (timer) clearInterval(timer);
    };
  }, [momentId, live]);

  const counts = state?.counts ?? null;
  useEffect(() => {
    if (!counts) return;
    const frame = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(frame);
  }, [counts]);

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

  const end = state?.endsAt ?? endsAt;
  const closed = state?.closed ?? (end ? new Date(end).getTime() <= Date.now() : false);
  const total = state?.total ?? 0;
  const mine = picking ?? state?.mine ?? null;
  const top = counts && total > 0 ? Math.max(...counts) : -1;
  const votes = `${ar(total)} ${total === 1 ? "صوت" : "أصوات"}`;

  return (
    <div className="mb-2.5 flex flex-col gap-2">
      {(state?.options ?? options).map((label, index) => {
        const count = counts?.[index] ?? 0;
        const pct = counts && total > 0 ? Math.round((count / total) * 100) : 0;
        const leading = counts !== null && total > 0 && count === top;
        const chosen = mine === index;
        return (
          <button
            key={index}
            type="button"
            aria-pressed={chosen}
            disabled={author || closed || pending || chosen}
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
                className={`absolute inset-y-0 right-0 transition-[width] duration-700 ease-out motion-reduce:transition-none ${
                  leading ? "bg-clay/55" : "bg-chip"
                }`}
                style={{ width: grown ? `${pct}%` : "0%" }}
              />
            ) : null}
            <span className="relative flex items-center gap-2 px-3.5 py-2.5">
              {chosen ? <span aria-hidden className="text-[13px] font-bold text-ink">✓</span> : null}
              <span dir="auto" className={`min-w-0 flex-1 text-[13.5px] text-ink ${leading || chosen ? "font-bold" : "font-medium"}`}>
                {label}
              </span>
              {counts ? (
                <span className={`text-[12.5px] text-ink ${leading ? "font-extrabold" : "font-semibold"}`}>
                  <CountUp value={pct} />
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
      <p className={`text-[11.5px] ${closed ? "font-bold text-ink-2" : "text-muted"}`}>
        {error
          ? error
          : closed
            ? `انتهى الاستطلاع · ${votes}`
            : counts
              ? `${votes}${end ? ` · ${leftText(end)}` : ""}${author ? "" : " · اضغط خياراً آخر لتغيير صوتك"}`
              : `اختر لترى النتيجة${end ? ` · ${leftText(end)}` : ""}`}
      </p>
    </div>
  );
}
