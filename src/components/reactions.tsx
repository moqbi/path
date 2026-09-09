"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { react } from "@/app/actions";
import { LockIcon, ReactionFace } from "@/components/icons";
import { ar } from "@/lib/format";

const FACES = ["SMILE", "LAUGH", "GASP", "SAD", "LOVE"] as const;
const CUSTOM = ["🫶", "🔥", "😭", "🙏", "☕️", "🌙", "👏", "🥹"];

type Mine = { kind: string; emoji: string | null } | null;

/**
 * شريط التفاعل داخل بطاقة الخط الزمني.
 *
 * التفاعل لا يفتح اللحظة: البطاقة رابط، فيجب أن يقف الحدث هنا قبل أن
 * يصعد إليه، وإلا انتقلت الصفحة عند كل ضغطة. والوجوه تظهر متتابعة عند
 * الفتح، والمختار ينبض نبضة واحدة عند الاختيار.
 */
export function Reactions({
  momentId,
  mine,
  count,
  isPlus,
}: {
  momentId: string;
  mine: Mine;
  count: number;
  isPlus: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [popped, setPopped] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const root = useRef<HTMLDivElement>(null);

  // اللمس خارج الشريط يغلقه، فلا يبقى مفتوحاً فوق بقية اللحظات.
  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  function choose(kind: string, emoji?: string) {
    setPopped(emoji ?? kind);
    setTimeout(() => setPopped(null), 420);
    setOpen(false);
    start(() => void react(momentId, kind, emoji));
  }

  const stop = (event: React.SyntheticEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div ref={root} className="relative" onClick={stop}>
      <button
        type="button"
        aria-label="تفاعل"
        aria-expanded={open}
        disabled={pending}
        onClick={(e) => {
          stop(e);
          setOpen((v) => !v);
        }}
        className="flex items-center gap-1.5 rounded-full px-2 py-1 disabled:opacity-60"
        style={{ background: mine ? "var(--color-chip)" : "transparent" }}
      >
        <span
          className="flex h-7 w-7 items-center justify-center rounded-full"
          style={{
            background: mine ? "var(--color-card)" : "var(--color-chip)",
            transform: popped ? "scale(1.35)" : "scale(1)",
            transition: "transform 380ms cubic-bezier(.18,1.5,.4,1)",
          }}
        >
          {mine?.kind === "CUSTOM" ? (
            <span className="text-[15px] leading-none">{mine.emoji}</span>
          ) : (
            <ReactionFace
              kind={(mine?.kind as (typeof FACES)[number]) ?? "SMILE"}
              size={mine?.kind === "LOVE" ? 15 : 17}
              color={mine ? (mine.kind === "LOVE" ? "#e2593a" : "#b8801a") : "#6b7784"}
            />
          )}
        </span>
        {count > 0 ? <span className="text-[12px] text-muted">{ar(count)}</span> : null}
      </button>

      {open ? (
        <div
          className="absolute bottom-full z-20 mb-2 rounded-full border border-line px-1.5 py-1 shadow-lg"
          style={{ background: "var(--color-card)", right: 0, boxShadow: "0 8px 26px rgba(14,26,36,.16)" }}
        >
          <div className="flex items-center gap-0.5">
            {FACES.map((kind, index) => (
              <button
                key={kind}
                type="button"
                aria-label={kind}
                onClick={(e) => {
                  stop(e);
                  choose(kind);
                }}
                className="flex h-11 w-9 items-center justify-center rounded-full"
                style={{
                  animation: `athr-pop 320ms cubic-bezier(.18,1.4,.4,1) both`,
                  animationDelay: `${index * 38}ms`,
                }}
              >
                <ReactionFace
                  kind={kind}
                  size={kind === "LOVE" ? 21 : 23}
                  color={kind === "LOVE" ? "#e2593a" : "#6b7784"}
                />
              </button>
            ))}

            <span className="mx-1 h-6 w-px bg-line" />

            {isPlus ? (
              CUSTOM.slice(0, 3).map((emoji, index) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={(e) => {
                    stop(e);
                    choose("CUSTOM", emoji);
                  }}
                  className="flex h-11 w-9 items-center justify-center rounded-full text-[19px] leading-none"
                  style={{
                    animation: `athr-pop 320ms cubic-bezier(.18,1.4,.4,1) both`,
                    animationDelay: `${(FACES.length + index) * 38}ms`,
                  }}
                >
                  {emoji}
                </button>
              ))
            ) : (
              <a
                href="/subscribe"
                aria-label="الإيموجي الحر لمشتركي أثر+"
                onClick={(e) => e.stopPropagation()}
                className="flex h-11 w-9 items-center justify-center rounded-full"
                style={{ color: "var(--color-gold-ink)" }}
              >
                <LockIcon size={15} />
              </a>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
