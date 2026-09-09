"use client";

import { useEffect, useState, useTransition } from "react";
import { markSeen, react, toggleJoin } from "@/app/actions";
import { CheckIcon, PlusIcon, LockIcon, ReactionFace } from "@/components/icons";

export function JoinButton({ momentId, joined }: { momentId: string; joined: boolean }) {
  const [pending, start] = useTransition();
  // حالة متفائلة: الزر يستجيب فوراً ثم يصحّحه الخادم عند إعادة التحقق.
  const [on, setOn] = useState(joined);

  useEffect(() => setOn(joined), [joined]);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        setOn((v) => !v);
        start(() => void toggleJoin(momentId));
      }}
      className="flex h-11 grow items-center justify-center gap-2 rounded-xl text-[14px] font-semibold transition-opacity disabled:opacity-70"
      style={{
        background: on ? "var(--color-live)" : "var(--color-live-soft)",
        color: on ? "var(--color-card)" : "var(--color-live)",
        border: on ? "none" : "1px solid var(--color-live)",
      }}
    >
      <CheckIcon size={16} />
      {on ? "جاي" : "أجي؟"}
    </button>
  );
}

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
