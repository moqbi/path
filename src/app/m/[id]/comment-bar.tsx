"use client";

import { useState, useTransition } from "react";
import { addComment } from "@/app/actions";
import { StickerIcon } from "@/components/icons";
import { StickerPanel, useStickersAllowed } from "@/components/sticker-panel";

/** حقلُ التعليق في صفحة اللحظة، ومعه زرُّ الملصقات بجانب الإرسال (القاعدة ٢٩١). */
export function CommentBar({ momentId, isPlus }: { momentId: string; isPlus: boolean }) {
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();
  const allowed = useStickersAllowed();
  const send = addComment.bind(null, momentId);

  return (
    <div className="px-5 pb-8 pt-3">
      <form action={send} className="flex items-center gap-2">
        <input
          name="body"
          required
          maxLength={500}
          placeholder="اكتب تعليق…"
          className="min-w-0 grow rounded-full border border-line bg-card px-5 text-[13.5px] outline-none focus:border-clay"
          style={{ height: 48 }}
        />
        {allowed ? (
          <button
            type="button"
            aria-label="الملصقات"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-line bg-card"
            style={{ color: open ? "var(--color-clay-ink)" : "var(--color-ink-2)" }}
          >
            <StickerIcon size={20} />
          </button>
        ) : null}
        <button
          type="submit"
          className="brand-gradient shrink-0 rounded-full px-5 text-[13.5px] font-bold"
          style={{ height: 48, color: "var(--color-on-brand)" }}
        >
          إرسال
        </button>
      </form>
      {open && allowed ? (
        <div className="mt-2">
          <StickerPanel
            tone="light"
            isPlus={isPlus}
            onPick={(stickerId) => {
              const data = new FormData();
              data.set("stickerId", stickerId);
              setOpen(false);
              start(() => void send(data));
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
