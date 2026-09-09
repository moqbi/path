"use client";

import { useEffect, useState, useTransition } from "react";
import { addComment, markSeen, react } from "@/app/actions";
import { PlusIcon, LockIcon, ReactionFace } from "@/components/icons";

const FACES = ["SMILE", "LAUGH", "GASP", "SAD", "LOVE"] as const;

/** إيموجي جاهزة تقوم مقام فتح كيبورد النظام في نموذج الويب. */
const CUSTOM_CHOICES = ["🫶", "🔥", "😭", "🙏", "☕️", "🌙", "👏", "🥹"];

export function ReactionBar({
  momentId,
  mine,
  isPlus,
}: {
  momentId: string;
  mine: { kind: string; emoji: string | null } | null;
  isPlus: boolean;
}) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-line bg-card px-3.5 py-2.5">
      <div className="flex items-center justify-between">
        <div className="flex gap-0.5">
          {FACES.map((kind) => {
            const on = mine?.kind === kind;
            return (
              <button
                key={kind}
                type="button"
                aria-label={kind}
                disabled={pending}
                onClick={() => start(() => void react(momentId, kind))}
                className="flex h-11 w-11 items-center justify-center rounded-full transition-colors"
                style={{
                  background: on
                    ? kind === "LOVE"
                      ? "var(--color-live-soft)"
                      : "var(--color-chip)"
                    : "transparent",
                }}
              >
                <ReactionFace
                  kind={kind}
                  size={kind === "LOVE" ? 24 : 26}
                  color={kind === "LOVE" ? "#ff7a7a" : "#94a3b8"}
                />
              </button>
            );
          })}
        </div>

        <span className="mx-1 block h-6 w-px bg-line" />

        <button
          type="button"
          aria-label="إيموجي حر"
          onClick={() => setOpen((v) => !v)}
          className="relative flex h-11 w-11 items-center justify-center rounded-full border border-dashed"
          style={{
            borderColor: "var(--color-line)",
            background: mine?.kind === "CUSTOM" ? "var(--color-chip)" : "transparent",
          }}
        >
          {mine?.kind === "CUSTOM" ? (
            <span className="text-[19px] leading-none">{mine.emoji}</span>
          ) : (
            <PlusIcon size={17} className="text-faint" />
          )}
          {!isPlus ? (
            <span
              className="absolute -left-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full"
              style={{ background: "var(--color-gold)" }}
            >
              <LockIcon size={9} className="text-card" />
            </span>
          ) : null}
        </button>
      </div>

      {open ? (
        isPlus ? (
          <div className="mt-2.5 flex flex-wrap gap-1 border-t border-line pt-2.5">
            {CUSTOM_CHOICES.map((emoji) => (
              <button
                key={emoji}
                type="button"
                disabled={pending}
                onClick={() => {
                  setOpen(false);
                  start(() => void react(momentId, "CUSTOM", emoji));
                }}
                className="flex h-11 w-11 items-center justify-center rounded-full text-[21px] leading-none hover:bg-chip"
              >
                {emoji}
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-2.5 border-t border-line pt-2.5 text-[12px] leading-relaxed text-muted">
            التفاعل بأي إيموجي من ميزات{" "}
            <a href="/subscribe" className="font-semibold text-gold">
              أثر+
            </a>
            . الوجوه الخمسة تبقى مفتوحة للجميع دائماً.
          </p>
        )
      ) : null}
    </div>
  );
}

/** يسجّل المشاهدة مرة واحدة عند فتح اللحظة — إيصال القراءة يعتمد عليه. */
export function SeenTracker({ momentId }: { momentId: string }) {
  useEffect(() => {
    void markSeen(momentId);
  }, [momentId]);
  return null;
}

/** حقل تعليق داخل بطاقة الخط الزمني، فلا يُفتح شيء لكتابة سطر. */
export function InlineComment({ momentId, viewerId }: { momentId: string; viewerId: string }) {
  const [pending, start] = useTransition();
  const [body, setBody] = useState("");

  return (
    <form
      action={() => {
        const text = body.trim();
        if (!text) return;
        const data = new FormData();
        data.set("body", text);
        setBody("");
        start(() => void addComment(momentId, data));
      }}
      className="mt-2 flex items-center gap-2"
    >
      <input
        name="body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="علّق…"
        maxLength={500}
        aria-label="تعليق"
        className="h-9 grow rounded-full border border-line bg-paper px-3.5 text-[12.5px] text-ink outline-none placeholder:text-faint focus:border-clay"
      />
      {body.trim() ? (
        <button
          type="submit"
          disabled={pending}
          data-viewer={viewerId}
          className="h-9 shrink-0 rounded-full px-3.5 text-[12px] font-bold disabled:opacity-60"
          style={{ background: "var(--color-clay)", color: "var(--color-on-brand)" }}
        >
          إرسال
        </button>
      ) : null}
    </form>
  );
}
