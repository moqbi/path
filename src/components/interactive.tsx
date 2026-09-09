"use client";

import { useEffect, useState, useTransition } from "react";
import { addComment, markSeen } from "@/app/actions";


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
