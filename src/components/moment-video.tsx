"use client";

import { useState } from "react";
import { BASE } from "@/lib/base";
import { PHOTO_RATIO } from "@/lib/photo";

/**
 * مقطعُ اللحظة (القاعدة ٤٣٤) في إطار صورتها: غلافُه وزرُّ تشغيل، والضغطةُ تشغّله في
 * مكانه. والبطاقةُ قد تجلس داخل رابط اللحظة (القاعدة ٢٨)، فالحاويةُ توقف الصعود.
 */
export function MomentVideo({ videoId, posterId }: { videoId: string; posterId: string | null }) {
  const [playing, setPlaying] = useState(false);
  const poster = posterId ? `${BASE}/api/media/${posterId}` : undefined;
  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl bg-[#0E1A24]"
      style={{ aspectRatio: PHOTO_RATIO }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      {playing ? (
        <video
          src={`${BASE}/api/media/${videoId}`}
          poster={poster}
          autoPlay
          controls
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <button type="button" aria-label="شغّل المقطع" onClick={() => setPlaying(true)} className="absolute inset-0 h-full w-full">
          {poster ? <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover" /> : null}
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(14,26,36,.62)] ps-1 text-[22px] text-white">▶</span>
          </span>
          <VideoBadge />
        </button>
      )}
    </div>
  );
}

/** علامةُ الفيديو على غلافه حيث لا يُشغَّل — الكتابُ والمعرضُ والأرشيف (القاعدة ٤٣٤). */
export function VideoBadge({ small = false }: { small?: boolean }) {
  return (
    <span
      className={`pointer-events-none absolute flex items-center gap-1 rounded-full bg-[rgba(14,26,36,.66)] font-bold text-white ${
        small ? "bottom-1.5 left-1.5 px-1.5 py-0.5 text-[9px]" : "bottom-2 left-2 px-2 py-0.5 text-[10.5px]"
      }`}
    >
      ▶{small ? null : <span>فيديو</span>}
    </span>
  );
}
