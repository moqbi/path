"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CloseIcon } from "@/components/icons";
import { useSwipeDown } from "@/components/nav";
import { BASE } from "@/lib/base";
import { PHOTO_RATIO } from "@/lib/photo";

/**
 * مقطعُ اللحظة (القاعدة ٤٣٤) في إطار صورتها: غلافُه وزرُّ تشغيل، والضغطةُ تفتحه بملء الشاشة
 * (القاعدة ٤٣٧) بـ«×» وEscape والسحب إلى أسفل. والبطاقةُ قد تجلس داخل رابط اللحظة (القاعدة ٢٨)،
 * فالحاويةُ توقف الصعود، والنافذةُ على جسد الصفحة (القاعدة ٩٢).
 */
export function MomentVideo({ videoId, posterId, ratio = PHOTO_RATIO }: { videoId: string; posterId: string | null; ratio?: number }) {
  const [open, setOpen] = useState(false);
  const poster = posterId ? `${BASE}/api/media/${posterId}` : undefined;
  const swipe = useSwipeDown(() => setOpen(false));
  useEffect(() => {
    if (!open) return;
    const key = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [open]);
  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl bg-[#0E1A24]"
      style={{ aspectRatio: ratio }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <button type="button" aria-label="شغّل المقطع" onClick={() => setOpen(true)} className="absolute inset-0 h-full w-full">
        {poster ? <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover" /> : null}
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(14,26,36,.62)] ps-1 text-[22px] text-white">▶</span>
        </span>
        <VideoBadge />
      </button>
      {open
        ? createPortal(
            <div ref={swipe} className="fixed inset-0 z-[90] flex items-center justify-center bg-black" onClick={(event) => event.stopPropagation()}>
              <video src={`${BASE}/api/media/${videoId}`} poster={poster} autoPlay controls playsInline className="max-h-full max-w-full" />
              <button
                type="button"
                aria-label="أغلق"
                onClick={() => setOpen(false)}
                className="absolute flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(0,0,0,.55)] text-white"
                style={{ top: "calc(env(safe-area-inset-top, 0px) + 12px)", right: 16 }}
              >
                <CloseIcon size={18} />
              </button>
            </div>,
            document.body,
          )
        : null}
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
