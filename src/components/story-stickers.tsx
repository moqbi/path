"use client";

import { ClockIcon, MusicIcon, PinIcon } from "@/components/icons";
import { mapsUrl } from "@/lib/maps";
import { ar } from "@/lib/format";

/**
 * ملصقاتُ القصة على الويب (القاعدة ٢٣٨) — للعرض وحده كالنصوص، والكتابةُ في
 * التطبيق. نسخةُ `apps/mobile/components/story-stickers.tsx` بوحدة عرض الحاوية
 * (`cqw`): المقاسُ بنقاطِ شاشةٍ عرضُها ٣٩٠ × مقاسِ الملصق.
 */
export type StorySticker =
  | { kind: "place"; x: number; y: number; scale: number; name: string; city?: string; lat?: number; lng?: number }
  | { kind: "time"; x: number; y: number; scale: number; style: "digital" | "clock" | "pill" | "date" }
  | { kind: "music"; x: number; y: number; scale: number; label?: string };

const BASE = 390;
const DAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

/** نقاطُ شاشةٍ عرضُها ٣٩٠ إلى وحدة عرض الحاوية. */
const u = (points: number, k: number) => `${((points * k) / BASE) * 100}cqw`;

function clock(at: Date) {
  const h = at.getHours();
  const m = at.getMinutes();
  return { text: `${ar(h % 12 || 12)}:${ar(String(m).padStart(2, "0"))}`, half: h < 12 ? "ص" : "م", h, m };
}

type TimeStyle = Extract<StorySticker, { kind: "time" }>["style"];

function TimeFace({ style, at, k }: { style: TimeStyle; at: Date; k: number }) {
  const time = clock(at);
  if (style === "clock") {
    const hand = (length: number, deg: number, width: number, color: string) => (
      <span
        className="absolute left-1/2 top-1/2"
        style={{
          width: u(width, k),
          height: u(length, k),
          marginLeft: `calc(${u(width, k)} / -2)`,
          background: color,
          borderRadius: 99,
          transformOrigin: "50% 100%",
          transform: `translateY(-100%) rotate(${deg}deg)`,
        }}
      />
    );
    return (
      <span
        className="relative block rounded-full"
        style={{ width: u(74, k), height: u(74, k), background: "#FDFCF8", border: `${u(3, k)} solid #0E1A24`, boxShadow: "0 2px 6px rgba(0,0,0,.25)" }}
      >
        {hand(18, (time.h % 12) * 30 + time.m * 0.5, 4, "#0E1A24")}
        {hand(26, time.m * 6, 3, "#FF7A5A")}
        <span className="absolute left-1/2 top-1/2 rounded-full" style={{ width: u(8, k), height: u(8, k), transform: "translate(-50%,-50%)", background: "#0E1A24" }} />
      </span>
    );
  }
  if (style === "pill") {
    return (
      <span className="flex items-center rounded-full font-extrabold" style={{ gap: u(7, k), padding: `${u(8, k)} ${u(14, k)}`, background: "#FDFCF8", color: "#0E1A24", fontSize: u(19, k) }}>
        <ClockIcon size={18} />
        {time.text} {time.half}
      </span>
    );
  }
  if (style === "date") {
    return (
      <span className="block overflow-hidden text-center" style={{ borderRadius: u(16, k), minWidth: u(120, k), background: "#FDFCF8" }}>
        <span className="block font-extrabold" style={{ background: "#FF7A5A", color: "#fff", fontSize: u(12.5, k), padding: `${u(4, k)} ${u(12, k)}` }}>
          {DAYS[at.getDay()]}
        </span>
        <span className="block font-extrabold" style={{ color: "#0E1A24", fontSize: u(24, k), padding: `${u(6, k)} ${u(12, k)} 0` }}>
          {ar(at.getDate())} {MONTHS[at.getMonth()]}
        </span>
        <span className="block font-bold" style={{ color: "#4A5560", fontSize: u(13, k), paddingBottom: u(6, k) }}>
          {time.text} {time.half}
        </span>
      </span>
    );
  }
  return (
    <span className="flex items-end font-extrabold" style={{ gap: u(4, k), color: "#fff", textShadow: "0 1px 5px rgba(0,0,0,.45)" }}>
      <span style={{ fontSize: u(44, k), lineHeight: 1.15 }}>{time.text}</span>
      <span style={{ fontSize: u(17, k), marginBottom: u(7, k) }}>{time.half}</span>
    </span>
  );
}

export function StoryStickers({
  stickers,
  at,
  muted,
  onMusic,
}: {
  stickers: StorySticker[] | null | undefined;
  at: Date;
  muted: boolean;
  onMusic: () => void;
}) {
  if (!stickers?.length) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-[5]" style={{ containerType: "inline-size" }}>
      {stickers.map((item, i) => {
        const k = item.scale;
        const seat = {
          left: `${item.x * 100}%`,
          top: `${item.y * 100}%`,
          transform: "translate(-50%, -50%)",
        } as const;
        if (item.kind === "time") {
          return (
            <span key={i} className="absolute" style={seat}>
              <TimeFace style={item.style} at={at} k={k} />
            </span>
          );
        }
        if (item.kind === "place") {
          const href = mapsUrl({ lat: item.lat, lng: item.lng, placeName: item.name, placeCity: item.city });
          return (
            <a
              key={i}
              href={href ?? undefined}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
              className="pointer-events-auto absolute flex items-center"
              style={{ ...seat, gap: u(8, k), maxWidth: u(260, k), padding: `${u(8, k)} ${u(13, k)}`, borderRadius: u(14, k), background: "#FDFCF8", boxShadow: "0 2px 6px rgba(0,0,0,.2)" }}
            >
              <span className="flex shrink-0 items-center justify-center rounded-full" style={{ width: u(26, k), height: u(26, k), background: "#FF7A5A", color: "#fff" }}>
                <PinIcon size={15} />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-extrabold" style={{ color: "#0E1A24", fontSize: u(15, k) }}>{item.name}</span>
                {item.city ? <span className="block truncate font-semibold" style={{ color: "#4A5560", fontSize: u(11, k) }}>{item.city}</span> : null}
              </span>
            </a>
          );
        }
        return (
          <button
            key={i}
            type="button"
            aria-label={muted ? "شغّل الصوت" : "اكتم الصوت"}
            onClick={(event) => {
              event.stopPropagation();
              onMusic();
            }}
            className="pointer-events-auto absolute flex items-center rounded-full font-bold"
            style={{ ...seat, gap: u(8, k), maxWidth: u(240, k), padding: `${u(9, k)} ${u(13, k)}`, background: "rgba(14,26,36,.82)", color: "#fff", fontSize: u(14, k), opacity: muted ? 0.7 : 1 }}
          >
            <MusicIcon size={17} />
            <span className="truncate">{item.label || "صوت"}</span>
            <span aria-hidden className="story-bars" data-on={muted ? "0" : "1"}>
              <i />
              <i />
              <i />
            </span>
          </button>
        );
      })}
    </div>
  );
}
