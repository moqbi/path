"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { addComment, react } from "@/app/actions";
import { LockIcon } from "@/components/icons";
import { CUSTOM, FACES, ReactionGlyph } from "@/components/reactions";

type Mine = { kind: string; emoji: string | null } | null;

/**
 * شريط اللحظة: زرّ واحد في يسار المنشور. بالضغط عليه تُفتح الوجوه
 * ومساحة التعليق معاً.
 *
 * ويُغلق نفسه بعد اختيار وجه أو إرسال تعليق، وبالضغط خارجه بلا شيء —
 * فالصندوق المفتوح على كل منشور ضجيج، والعودة إليه ضغطةٌ واحدة.
 */
export function MomentBar({
  momentId,
  mine,
  isPlus,
  head,
  extra,
}: {
  momentId: string;
  mine: Mine;
  isPlus: boolean;
  /** سطر الحدث — يجلس الزرّ في طرفه الأيسر بدل أن يطفو تحته. */
  head?: React.ReactNode;
  /** ما يلي السطر: الصورة وقالب المتفاعلين. */
  extra?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [popped, setPopped] = useState(false);
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  const root = useRef<HTMLDivElement>(null);

  // ضغطةٌ خارج الشريط تطويه — ما لم يكن هناك تعليق نصف مكتوب يضيع.
  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (root.current?.contains(event.target as Node)) return;
      if (body.trim().length > 0) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open, body]);

  // البطاقة قد تكون رابطاً، فيجب أن يقف الحدث هنا وإلا فُتحت اللحظة.
  const stop = (event: React.SyntheticEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  function choose(kind: string, emoji?: string) {
    setPopped(true);
    setTimeout(() => setPopped(false), 420);
    // الوجه فعلٌ كامل بنفسه: يُختار فيُطوى الشريط، ويُفتح ثانيةً لمن أراد
    // أن يكتب بعده.
    setOpen(false);
    start(() => void react(momentId, kind, emoji));
  }

  return (
    <div ref={root} className={head ? "" : "mt-2"} onClick={stop}>
      {/* في RTL يضع `justify-end` الزرَّ في الطرف الأيسر من المنشور. */}
      <div className={head ? "flex items-start gap-2" : "flex justify-end"}>
        {head ? <div className="min-w-0 grow">{head}</div> : null}
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

      {extra}

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
              setOpen(false);
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
