"use client";

import { useState, useTransition } from "react";
import { addComment, react } from "@/app/actions";
import { LockIcon } from "@/components/icons";
import { CUSTOM, FACES, ReactionGlyph } from "@/components/reactions";

type Mine = { kind: string; emoji: string | null } | null;

/**
 * شريط اللحظة: زرّ واحد في يسار المنشور. بالضغط عليه تُفتح الوجوه
 * ومساحة التعليق معاً — التفاعل والتعليق فعلان متجاوران، ولا داعي
 * أن يحمل كل منشور حقل كتابة مفتوحاً وهو في الغالب لا يُستعمل.
 */
export function MomentBar({
  momentId,
  mine,
  isPlus,
}: {
  momentId: string;
  mine: Mine;
  isPlus: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [popped, setPopped] = useState(false);
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();

  // البطاقة قد تكون رابطاً، فيجب أن يقف الحدث هنا وإلا فُتحت اللحظة.
  const stop = (event: React.SyntheticEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  function choose(kind: string, emoji?: string) {
    setPopped(true);
    setTimeout(() => setPopped(false), 420);
    start(() => void react(momentId, kind, emoji));
  }

  return (
    <div className="mt-2" onClick={stop}>
      {/* في RTL يضع `justify-end` الزرَّ في الطرف الأيسر من المنشور. */}
      <div className="flex justify-end">
        <button
          type="button"
          aria-label="تفاعل"
          aria-expanded={open}
          onClick={(event) => {
            stop(event);
            setOpen((v) => !v);
          }}
          className="flex h-9 items-center gap-1.5 rounded-full border px-2.5"
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
        </button>
      </div>

      {open ? (
        <div className="mt-2 flex flex-col gap-2">
          <div className="flex items-center gap-0.5">
            {FACES.map((kind, index) => (
              <button
                key={kind}
                type="button"
                aria-label={kind}
                onClick={(event) => {
                  stop(event);
                  choose(kind);
                }}
                className="flex h-10 w-9 items-center justify-center rounded-xl hover:bg-chip"
                style={{
                  animation: "athr-pop 320ms cubic-bezier(.18,1.4,.4,1) both",
                  animationDelay: `${index * 34}ms`,
                }}
              >
                <ReactionGlyph kind={kind} size={25} />
              </button>
            ))}

            <span className="mx-0.5 h-6 w-px bg-line" />

            {isPlus ? (
              CUSTOM.slice(0, 2).map((emoji, index) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={(event) => {
                    stop(event);
                    choose("CUSTOM", emoji);
                  }}
                  className="flex h-10 w-9 items-center justify-center rounded-xl text-[21px] leading-none hover:bg-chip"
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
                className="flex h-10 w-9 items-center justify-center rounded-xl"
                style={{ color: "var(--color-gold-ink)" }}
              >
                <LockIcon size={16} />
              </a>
            )}
          </div>

          <form
            action={() => {
              const text = body.trim();
              if (!text) return;
              const data = new FormData();
              data.set("body", text);
              setBody("");
              start(() => void addComment(momentId, data));
            }}
            className="flex items-center gap-2"
          >
            <input
              name="body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="علّق…"
              maxLength={500}
              aria-label="تعليق"
              autoFocus
              className="h-9 min-w-0 grow rounded-full border border-line bg-paper px-3.5 text-[12.5px] text-ink outline-none placeholder:text-faint focus:border-clay"
            />
            {body.trim() ? (
              <button
                type="submit"
                disabled={pending}
                className="h-9 shrink-0 rounded-full px-3.5 text-[12px] font-bold disabled:opacity-60"
                style={{ background: "var(--color-clay)", color: "var(--color-on-brand)" }}
              >
                إرسال
              </button>
            ) : null}
          </form>
        </div>
      ) : null}
    </div>
  );
}
