"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { react } from "@/app/actions";
import { LockIcon } from "@/components/icons";
import { ar } from "@/lib/format";

/**
 * التفاعلات الخمسة الأساسية — إيموجي حقيقية لا رسوم.
 * الرسم اليدوي كان يبدو غريباً بجانب إيموجي النظام في التعليقات؛ والإيموجي
 * الحقيقية تُعرض بخط النظام فتتطابق مع ما يعرفه المستخدم على جهازه.
 */
export const FACE_EMOJI: Record<string, string> = {
  SMILE: "😊",
  LAUGH: "😂",
  GASP: "😮",
  SAD: "😢",
  LOVE: "❤️",
};

const FACES = ["SMILE", "LAUGH", "GASP", "SAD", "LOVE"] as const;
const CUSTOM = ["🫶", "🔥", "🙏", "👏", "🥹", "☕️"];

type Mine = { kind: string; emoji: string | null } | null;

export function reactionGlyph(kind: string, emoji: string | null): string {
  return kind === "CUSTOM" ? (emoji ?? "🙂") : (FACE_EMOJI[kind] ?? "🙂");
}

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
  const [popped, setPopped] = useState(false);
  const [pending, start] = useTransition();
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  function choose(kind: string, emoji?: string) {
    setPopped(true);
    setTimeout(() => setPopped(false), 420);
    setOpen(false);
    start(() => void react(momentId, kind, emoji));
  }

  // البطاقة رابط، فيجب أن يقف الحدث هنا وإلا فتحت اللحظة مع كل ضغطة.
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
        className="flex h-9 items-center gap-1.5 rounded-full border px-2.5 disabled:opacity-60"
        style={{
          background: mine ? "var(--color-clay-soft)" : "transparent",
          borderColor: mine ? "var(--color-clay)" : "var(--color-line)",
        }}
      >
        <span
          className="text-[17px] leading-none"
          style={{
            transform: popped ? "scale(1.4)" : "scale(1)",
            transition: "transform 400ms cubic-bezier(.18,1.5,.4,1)",
            filter: mine ? "none" : "grayscale(1) opacity(.55)",
          }}
        >
          {mine ? reactionGlyph(mine.kind, mine.emoji) : "😊"}
        </span>
        {count > 0 ? (
          <span className="text-[12.5px] font-semibold text-ink-2">{ar(count)}</span>
        ) : null}
      </button>

      {open ? (
        <div
          className="absolute bottom-full z-20 mb-2 rounded-2xl border border-line p-1.5"
          style={{
            background: "var(--color-card)",
            right: 0,
            boxShadow: "0 10px 30px rgba(14,26,36,.18)",
          }}
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
                className="flex h-11 w-10 items-center justify-center rounded-xl text-[24px] leading-none hover:bg-chip"
                style={{
                  animation: "athr-pop 320ms cubic-bezier(.18,1.4,.4,1) both",
                  animationDelay: `${index * 36}ms`,
                }}
              >
                {FACE_EMOJI[kind]}
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
                  className="flex h-11 w-10 items-center justify-center rounded-xl text-[22px] leading-none hover:bg-chip"
                  style={{
                    animation: "athr-pop 320ms cubic-bezier(.18,1.4,.4,1) both",
                    animationDelay: `${(FACES.length + index) * 36}ms`,
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
                className="flex h-11 w-10 items-center justify-center rounded-xl"
                style={{ color: "var(--color-gold-ink)" }}
              >
                <LockIcon size={16} />
              </a>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
