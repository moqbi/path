"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { react } from "@/app/actions";
import { LockIcon } from "@/components/icons";
import { ar } from "@/lib/format";

/**
 * ملفات التفاعلات في `public/reactions`. استبدال أيٍّ منها يغيّر شكله في
 * التطبيق كله بلا لمس الكود — ولذلك المفتاح هو الاسم لا رسم بداخل مكوّن.
 */
export const REACTION_SRC: Record<string, string> = {
  SMILE: "/reactions/smile.png",
  LAUGH: "/reactions/laugh.png",
  GASP: "/reactions/gasp.png",
  SAD: "/reactions/sad.png",
  LOVE: "/reactions/love.png",
  // وجه النوم مؤقت حتى يصل ملفه؛ البقية من ملفات العلامة.
  SLEEPY: "/reactions/sleepy.svg",
};

/** الوجوه العامة، ثم النوم — يُعرض لكل اللحظات وهو الأنسب للحظة نوم. */
const FACES = ["SMILE", "LAUGH", "GASP", "SAD", "LOVE", "SLEEPY"] as const;
const CUSTOM = ["🫶", "🔥", "🙏", "👏", "🥹", "☕️"];

type Mine = { kind: string; emoji: string | null } | null;

export function ReactionGlyph({
  kind,
  emoji,
  size = 20,
}: {
  kind: string;
  emoji?: string | null;
  size?: number;
}) {
  if (kind === "CUSTOM") {
    return (
      <span style={{ fontSize: size * 0.92, lineHeight: 1 }} aria-hidden>
        {emoji ?? "🙂"}
      </span>
    );
  }
  const src = REACTION_SRC[kind] ?? REACTION_SRC.SMILE;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" width={size} height={size} style={{ display: "block" }} />;
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
          style={{
            transform: popped ? "scale(1.4)" : "scale(1)",
            transition: "transform 400ms cubic-bezier(.18,1.5,.4,1)",
            opacity: mine ? 1 : 0.5,
            filter: mine ? "none" : "grayscale(.85)",
          }}
        >
          <ReactionGlyph kind={mine?.kind ?? "SMILE"} emoji={mine?.emoji} size={19} />
        </span>
        {count > 0 ? (
          <span className="text-[12.5px] font-semibold text-ink-2">{ar(count)}</span>
        ) : null}
      </button>

      {open ? (
        <div
          className="absolute bottom-full z-20 mb-2 rounded-2xl border border-line p-1"
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
                className="flex h-11 w-9 items-center justify-center rounded-xl hover:bg-chip"
                style={{
                  animation: "athr-pop 320ms cubic-bezier(.18,1.4,.4,1) both",
                  animationDelay: `${index * 34}ms`,
                }}
              >
                <ReactionGlyph kind={kind} size={26} />
              </button>
            ))}

            <span className="mx-0.5 h-6 w-px bg-line" />

            {isPlus ? (
              CUSTOM.slice(0, 2).map((emoji, index) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={(e) => {
                    stop(e);
                    choose("CUSTOM", emoji);
                  }}
                  className="flex h-11 w-9 items-center justify-center rounded-xl text-[22px] leading-none hover:bg-chip"
                  style={{
                    animation: "athr-pop 320ms cubic-bezier(.18,1.4,.4,1) both",
                    animationDelay: `${(FACES.length + index) * 34}ms`,
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
                className="flex h-11 w-9 items-center justify-center rounded-xl"
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

/**
 * من تفاعل: صورته ومعها تفاعله — كما كان في Path.
 * الرقم وحده لا يقول من، وهذا سؤال الدائرة الصغيرة الأول.
 */
export function Reactors({
  reactions,
  size = 26,
}: {
  reactions: { userId: string; kind: string; emoji: string | null; user: { name: string; avatarMediaId: string | null } }[];
  size?: number;
}) {
  if (reactions.length === 0) return null;
  const shown = reactions.slice(0, 5);

  return (
    <div className="flex items-center gap-1.5">
      {shown.map((reaction) => (
        <span key={reaction.userId} className="relative block" title={reaction.user.name}>
          <span
            className="block rounded-full bg-cover bg-center"
            style={{
              width: size,
              height: size,
              backgroundImage: reaction.user.avatarMediaId
                ? `url(/api/media/${reaction.user.avatarMediaId})`
                : undefined,
              background: reaction.user.avatarMediaId ? undefined : "var(--color-chip)",
            }}
          />
          <span
            className="absolute -bottom-1 -left-1 rounded-full"
            style={{ background: "var(--color-card)", padding: 1 }}
          >
            <ReactionGlyph kind={reaction.kind} emoji={reaction.emoji} size={size * 0.52} />
          </span>
        </span>
      ))}
      {reactions.length > shown.length ? (
        <span className="mr-1 text-[12px] text-muted">+{ar(reactions.length - shown.length)}</span>
      ) : null}
    </div>
  );
}
