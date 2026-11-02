"use client";

import { useState, useTransition } from "react";
import { addComment } from "@/app/actions";
import { SendIcon, StickerIcon } from "@/components/icons";
import { StickerPanel, useStickersAllowed } from "@/components/sticker-panel";

/** حقلُ التعليق في صفحة اللحظة، ومعه زرُّ الملصقات بجانب الإرسال (القاعدة ٢٩١). */
export function CommentBar({ momentId, isPlus }: { momentId: string; isPlus: boolean }) {
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();
  const allowed = useStickersAllowed();
  const send = addComment.bind(null, momentId);

  return (
    <div className="px-5 pb-8 pt-3">
      {/*
        قرصٌ واحد كحقل الجوّال (القاعدة ٢٩٥): الحقلُ، فالملصقات، فالإرسالُ دائرةً باللمسة — لا ثلاثُ
        قطعٍ متجاورة يُقرأ كلٌّ وحده.
      */}
      <form action={send} className="flex h-12 items-center gap-1 rounded-full border border-line bg-card pe-1.5 ps-5 focus-within:border-clay">
        <input
          name="body"
          required
          maxLength={500}
          placeholder="اكتب تعليق…"
          className="h-full min-w-0 grow bg-transparent text-[13.5px] outline-none"
        />
        {allowed ? (
          <button
            type="button"
            aria-label="الملصقات"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            style={{ color: open ? "var(--color-clay-ink)" : "var(--color-ink-2)" }}
          >
            <StickerIcon size={20} />
          </button>
        ) : null}
        <button
          type="submit"
          aria-label="إرسال"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          style={{ background: "var(--color-clay)", color: "var(--color-on-brand)" }}
        >
          <SendIcon size={17} />
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
