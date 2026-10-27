"use client";

import { useEffect, useState } from "react";
import { linkPreviewOf, type LinkPreviewData } from "@/app/link-actions";

/** أوّلُ رابطٍ في نصّ — نسخةُ `firstUrl` في الخادم والجوّال. */
export function firstUrl(text: string | null | undefined): string | null {
  if (!text) return null;
  const hit = text.match(/https?:\/\/[^\s<>"'«»]+/i);
  if (!hit) return null;
  return hit[0].replace(/[).,!?؛،:]+$/u, "");
}

const seen = new Map<string, LinkPreviewData | null>();

/**
 * معاينةُ أوّل رابطٍ في النصّ (القاعدة ٣٦٦): صورتُه المصغّرة واسمُ موقعه وعنوانُه
 * وسطرٌ من وصفه. **زرٌّ لا `<a>`** يوقف الصعود: قد يجلس داخل رابط اللحظة
 * (القاعدة ٢٨). وما لا معاينةَ له لا يُرسم.
 */
export function LinkPreview({ text, enabled, className = "" }: { text: string | null | undefined; enabled: boolean; className?: string }) {
  const url = enabled ? firstUrl(text) : null;
  const [data, setData] = useState<LinkPreviewData | null>(url ? (seen.get(url) ?? null) : null);

  useEffect(() => {
    if (!url) return;
    if (seen.has(url)) {
      setData(seen.get(url) ?? null);
      return;
    }
    let live = true;
    void linkPreviewOf(url).then((got) => {
      seen.set(url, got);
      if (live) setData(got);
    });
    return () => {
      live = false;
    };
  }, [url]);

  if (!url || !data) return null;

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        window.open(data.url, "_blank", "noopener,noreferrer");
      }}
      className={`flex w-full items-center gap-2.5 rounded-[14px] border border-line bg-paper p-2 text-start hover:opacity-90 ${className}`}
    >
      {data.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={data.image} alt="" className="h-14 w-14 shrink-0 rounded-[10px] bg-chip object-cover" />
      ) : null}
      <span className="flex min-w-0 grow flex-col gap-0.5">
        <span dir="auto" className="truncate text-[10.5px] text-faint">{data.site}</span>
        {data.title ? (
          <span dir="auto" className="line-clamp-2 text-[12.5px] font-bold leading-snug text-ink">{data.title}</span>
        ) : null}
        {data.description ? (
          <span dir="auto" className="truncate text-[11.5px] text-muted">{data.description}</span>
        ) : null}
      </span>
    </button>
  );
}
