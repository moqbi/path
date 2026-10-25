"use client";

import { useEffect, useRef, useState } from "react";
import { CloseIcon } from "@/components/icons";
import { ZoomImage } from "@/components/zoom-image";
import { BASE } from "@/lib/base";
import { ar } from "@/lib/format";
import { PHOTO_RATIO } from "@/lib/photo";

/**
 * صورة اللحظة في إطارٍ ثابت.
 *
 * جُرّب عرضها بنسبتها الحقيقية فكبرت البطاقة مع كل صورة طويلة وتشوّه
 * الخط الزمني. الإطار الثابت يبقي الإيقاع واحداً، والضغط يفتح الصورة
 * كاملة — فلا شيء يضيع بالقصّ.
 */
export function Photo({
  mediaId,
  height,
  rounded = false,
  x = 50,
  y = 50,
  more = [],
}: {
  /** الصورُ بعد الأولى — تُقلَّب يميناً ويساراً (القاعدة ٣٤٣). */
  more?: string[];
  mediaId: string;
  /** ارتفاعٌ ثابت؛ وبدونه يأخذ الإطارُ نسبةَ البطاقة (`PHOTO_RATIO`). */
  height?: number;
  rounded?: boolean;
  /** موضعُ القصّ بالمئة كما ضبطه صاحبُها قبل النشر. */
  x?: number;
  y?: number;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const ids = [mediaId, ...more];
  const strip = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  /** صورةٌ بعد المفتوحة أو قبلها — والصورُ تُقلَّب وهي مفتوحة (القاعدة ٣٤٥). */
  const step = (by: 1 | -1) =>
    setOpen((now) => {
      if (!now) return now;
      const at = ids.indexOf(now) + by;
      return at >= 0 && at < ids.length ? ids[at] : now;
    });

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(null);
      // الأسهمُ بين صور اللحظة: اليسرى التاليةُ في RTL.
      if (event.key === "ArrowLeft") step(1);
      if (event.key === "ArrowRight") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const stop = (event: React.SyntheticEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <>
      {more.length ? (
        /*
          صفٌّ يُمرَّر بالتقاط الصفحة (`scroll-snap`): المتصفّحُ يحسن التمرير الأفقيّ في RTL
          وحده، والإصبعُ والعجلةُ يعملان بلا شيءٍ نكتبه. والرقمُ من موضع التمرير.
        */
        <div className={`relative overflow-hidden ${rounded ? "rounded-2xl" : ""}`} style={{ background: "var(--color-chip)" }}>
          <div
            ref={strip}
            onScroll={(event) => {
              const el = event.currentTarget;
              setIndex(Math.round(Math.abs(el.scrollLeft) / Math.max(1, el.clientWidth)));
            }}
            className="flex snap-x snap-mandatory overflow-x-auto"
            style={{ scrollbarWidth: "none" }}
          >
            {ids.map((id, at) => (
              <button
                key={id}
                type="button"
                aria-label={`افتح الصورة ${at + 1}`}
                onClick={(event) => {
                  stop(event);
                  setOpen(id);
                }}
                className="block w-full shrink-0 snap-center"
                style={{ lineHeight: 0 }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${BASE}/api/media/${id}`}
                  alt=""
                  loading={at === 0 ? undefined : "lazy"}
                  style={{
                    width: "100%",
                    ...(height ? { height } : { aspectRatio: PHOTO_RATIO }),
                    display: "block",
                    objectFit: "cover",
                    objectPosition: at === 0 ? `${x}% ${y}%` : "50% 50%",
                  }}
                />
              </button>
            ))}
          </div>
          <span
            className="pointer-events-none absolute right-2.5 top-2.5 rounded-full px-2 text-[11px] font-bold leading-[22px] text-white"
            style={{ background: "rgba(14,26,36,.55)" }}
          >
            {ar(index + 1)}/{ar(ids.length)}
          </span>
          <span className="pointer-events-none absolute inset-x-0 bottom-2.5 flex justify-center gap-[5px]">
            {ids.map((id, at) => (
              <span
                key={id}
                className="h-1.5 rounded-full transition-all"
                style={{ width: at === index ? 16 : 6, background: at === index ? "#fff" : "rgba(255,255,255,.55)" }}
              />
            ))}
          </span>
        </div>
      ) : (
      <button
        type="button"
        aria-label="افتح الصورة"
        onClick={(event) => {
          stop(event);
          setOpen(mediaId);
        }}
        className={`block w-full overflow-hidden ${rounded ? "rounded-2xl" : ""}`}
        style={{ background: "var(--color-chip)", lineHeight: 0 }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${BASE}/api/media/${mediaId}`}
          alt=""
          style={{
            width: "100%",
            ...(height ? { height } : { aspectRatio: PHOTO_RATIO }),
            display: "block",
            objectFit: "cover",
            objectPosition: `${x}% ${y}%`,
          }}
        />
      </button>
      )}

      {open ? (
        <div
          onClick={(event) => {
            stop(event);
            setOpen(null);
          }}
          className="fixed inset-0 z-40 flex items-center justify-center p-4"
          style={{ background: "rgba(8,14,20,.94)", animation: "athr-veil 160ms ease both" }}
        >
          <ZoomImage key={open} src={`${BASE}/api/media/${open}`} onClose={() => setOpen(null)} onSwipe={ids.length > 1 ? step : undefined} />
          {/*
            صورُ اللحظة كلُّها محمّلةٌ خفيّةً ما دامت مفتوحة: التقليبُ يجد التاليةَ في الذاكرة
            ومفكوكةً، فلا يرمش الإطارُ فارغاً حتى تصل (الصفُّ يحمّل ما بعد الأولى كسولاً).
          */}
          {ids.length > 1
            ? ids.map((id) =>
                id === open ? null : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={id} src={`${BASE}/api/media/${id}`} alt="" aria-hidden decoding="sync" className="pointer-events-none absolute h-px w-px opacity-0" />
                ),
              )
            : null}
          {ids.length > 1 ? (
            <>
              {(
                [
                  [-1, "right-3", "السابقة", "›"],
                  [1, "left-3", "التالية", "‹"],
                ] as const
              ).map(([by, side, label, glyph]) => {
                const at = ids.indexOf(open) + by;
                return at >= 0 && at < ids.length ? (
                  <button
                    key={by}
                    type="button"
                    aria-label={label}
                    onClick={(event) => {
                      stop(event);
                      step(by);
                    }}
                    className={`absolute ${side} top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-[26px] leading-none text-white`}
                    style={{ background: "rgba(255,255,255,.16)" }}
                  >
                    {glyph}
                  </button>
                ) : null;
              })}
              <span className="pointer-events-none absolute inset-x-0 bottom-6 z-10 text-center text-[12.5px] font-bold text-white">
                {ar(ids.indexOf(open) + 1)}/{ar(ids.length)}
              </span>
            </>
          ) : null}
          <button
            type="button"
            aria-label="إغلاق"
            onClick={(event) => {
              stop(event);
              setOpen(null);
            }}
            className="absolute left-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full"
            style={{ background: "rgba(255,255,255,.16)", color: "#fff" }}
          >
            <CloseIcon size={18} />
          </button>
        </div>
      ) : null}
    </>
  );
}
