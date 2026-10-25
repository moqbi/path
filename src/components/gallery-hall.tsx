"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BookIcon, LockIcon, MoonIcon, PinIcon, PlaneIcon, SparkIcon, SunIcon } from "@/components/icons";
import { BASE } from "@/lib/base";
import { ar, MONTHS } from "@/lib/format";
import { HALL_SKIN, type HallSkin } from "@/lib/gallery-skin";

/** لوحةٌ في القاعة — يُحسب ما يُكتب عليها في الخادم بتوقيت الرياض فلا يختلف عند الترطيب. */
export type HallPiece = {
  id: string;
  kind: string;
  line: string;
  text: string | null;
  mediaId: string | null;
  photoX: number | null;
  photoY: number | null;
  placeName: string | null;
  placeCity: string | null;
  musicThumb: string | null;
  month: number;
  when: string;
};
type Slot = { type: "rope" } | { type: "piece"; piece: HallPiece };

const WINDOW = 3;

/**
 * قاعةُ السنة على الويب (القاعدة ٣٤٦) — نسخةُ `app/me/hall/[year].tsx`: لوحاتٌ على جدار
 * بترتيبها والتاليةُ في اليسار، **تُسحب بالإصبع أو بالفأرة لا بأسهم**. الضغطُ على الحاليّة
 * يفتح شرحَها، وعلى جارتها يأتي بها، وشريطُ الشهور يقفز. وكلُّ لونٍ من `HALL_SKIN`.
 */
export function GalleryHall({ pieces, hidden }: { pieces: HallPiece[]; hidden: number }) {
  const skin = HALL_SKIN;
  const router = useRouter();
  const slots: Slot[] = [...(hidden > 0 ? [{ type: "rope" } as Slot] : []), ...pieces.map((piece) => ({ type: "piece", piece }) as Slot)];
  const lastMonth = pieces.at(-1)?.month;
  const [index, setIndex] = useState(() => Math.max(0, slots.findIndex((slot) => slot.type === "piece" && slot.piece.month === lastMonth)));
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [detail, setDetail] = useState<HallPiece | null>(null);
  const drag = useRef<{ x: number; y: number; t: number; on: boolean; id: number } | null>(null);
  const moved = useRef(false);
  const [W, setW] = useState(210);
  const H = Math.round(W * 1.28);
  const STEP = W + 34;

  useEffect(() => {
    const fit = () => setW(Math.min(230, Math.round(Math.min(window.innerWidth, 640) * 0.56)));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  const go = (to: number) => setIndex(Math.max(0, Math.min(slots.length - 1, to)));

  const current = slots[index];
  const wallMonth = current?.type === "piece" ? current.piece.month : null;
  const months: { month: number; first: number; count: number }[] = [];
  slots.forEach((slot, at) => {
    if (slot.type !== "piece") return;
    const row = months.at(-1);
    if (row && row.month === slot.piece.month) row.count += 1;
    else months.push({ month: slot.piece.month, first: at, count: 1 });
  });

  // لا يُلتقط المؤشّرُ قبل أن يثبت السحبُ أفقياً (القاعدة ٧٩): وإلّا لم تصل النقرةُ إلى اللوحة.
  const onDown = (event: React.PointerEvent) => {
    drag.current = { x: event.clientX, y: event.clientY, t: Date.now(), on: false, id: event.pointerId };
    moved.current = false;
  };
  const onMove = (event: React.PointerEvent) => {
    const start = drag.current;
    if (!start) return;
    const x = event.clientX - start.x;
    const y = event.clientY - start.y;
    if (!start.on) {
      if (Math.abs(x) < 8 || Math.abs(x) < Math.abs(y)) return;
      start.on = true;
      moved.current = true;
      setDragging(true);
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    }
    // خلف الطرفين مقاومة.
    const past = (index === 0 && x < 0) || (index === slots.length - 1 && x > 0);
    setDx(past ? x * 0.3 : x);
  };
  const onUp = (event: React.PointerEvent) => {
    const start = drag.current;
    drag.current = null;
    if (!start?.on) return;
    const x = event.clientX - start.x;
    const speed = x / Math.max(1, Date.now() - start.t);
    // التاليةُ في اليسار: السحبُ يميناً يأتي بها، والسحبةُ السريعة تعبر أكثر من لوحة.
    const steps = Math.max(-3, Math.min(3, Math.round((x + speed * 160) / STEP)));
    setDragging(false);
    setDx(0);
    go(index + steps);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (detail) {
        if (event.key === "Escape") setDetail(null);
        return;
      }
      if (event.key === "ArrowLeft") setIndex((at) => Math.min(slots.length - 1, at + 1));
      if (event.key === "ArrowRight") setIndex((at) => Math.max(0, at - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detail, slots.length]);

  return (
    <div className="flex min-h-0 grow flex-col" style={{ background: skin.ceiling }}>
      <div style={{ height: 18 }} />
      <div
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className="relative flex min-h-0 grow select-none flex-col justify-evenly overflow-hidden"
        style={{ background: skin.wall, touchAction: "pan-y", cursor: dragging ? "grabbing" : "grab" }}
      >
        <div className="pointer-events-none absolute inset-x-0 bottom-0" style={{ height: 40, background: skin.wallShade }} />
        <div
          className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2"
          style={{ width: W * 2, height: H * 1.5, background: `radial-gradient(ellipse 50% 100% at 50% 0%, ${skin.light}, transparent 100%)`, opacity: 0.9 }}
        />

        <div className="relative flex justify-center">
          {wallMonth !== null ? (
            <div className="rounded-lg px-3.5 py-1 text-center" style={{ background: skin.sign.bg }}>
              <p className="font-display text-[15px] font-extrabold" style={{ color: skin.sign.ink }}>
                جدار {MONTHS[wallMonth]}
              </p>
              <p className="text-[10.5px]" style={{ color: skin.sign.muted }}>
                {ar(months.find((row) => row.month === wallMonth)?.count ?? 0)} لحظة
              </p>
            </div>
          ) : null}
        </div>

        <div className="relative" style={{ height: H + 24 }}>
          {slots.length === 0 ? (
            <p className="pt-20 text-center text-[13px]" style={{ color: skin.sign.muted }}>
              ما في هالسنة لحظات بعد.
            </p>
          ) : null}
          {slots.map((slot, at) => {
            if (Math.abs(at - index) > WINDOW) return null;
            const offset = (index - at) * STEP + dx;
            const near = Math.min(1, Math.abs(offset) / STEP);
            return (
              <button
                key={slot.type === "rope" ? "rope" : slot.piece.id}
                type="button"
                onClick={() => {
                  if (moved.current) return;
                  if (at !== index) return go(at);
                  if (slot.type === "rope") router.push("/subscribe");
                  else setDetail(slot.piece);
                }}
                className="absolute top-3 block"
                style={{
                  width: W,
                  height: H,
                  left: `calc(50% - ${W / 2}px)`,
                  transform: `translateX(${offset}px) scale(${1 - near * 0.2})`,
                  opacity: 1 - near * 0.45,
                  transition: dragging ? "none" : "transform 320ms cubic-bezier(.2,.8,.2,1), opacity 320ms",
                }}
              >
                {slot.type === "rope" ? <Rope skin={skin} hidden={hidden} w={W} h={H} /> : <Piece skin={skin} piece={slot.piece} spin={at === index} />}
              </button>
            );
          })}
        </div>

        <div className="relative flex min-h-[74px] justify-center px-7">
          {current?.type === "piece" ? <Placard skin={skin} piece={current.piece} /> : null}
        </div>
      </div>

      <div style={{ background: skin.floor, borderTop: `3px solid ${skin.floorEdge}` }} className="pb-6 pt-3">
        <div className="flex gap-2 overflow-x-auto px-4" style={{ scrollbarWidth: "none" }}>
          {months.map((row) => {
            const on = row.month === wallMonth;
            return (
              <button
                key={row.month}
                type="button"
                onClick={() => go(row.first)}
                className="h-8 shrink-0 rounded-full px-3.5 text-[12.5px] font-bold"
                style={{ background: on ? skin.accent.bg : "rgba(255,255,255,.14)", color: on ? skin.accent.ink : "#FBF8F1" }}
              >
                {MONTHS[row.month]}
              </button>
            );
          })}
        </div>
        {slots.length > 1 ? (
          <p className="mt-2.5 text-center text-[11.5px]" style={{ color: "rgba(251,248,241,.75)" }}>
            {ar(index + 1)} / {ar(slots.length)} · اسحب لتمشي
          </p>
        ) : null}
      </div>

      {detail ? (
        <div
          onClick={() => setDetail(null)}
          className="shell-fixed inset-0 z-40 flex flex-col items-center justify-center gap-4 p-6"
          style={{ background: "rgba(8,14,20,.9)", animation: "athr-veil 160ms ease both" }}
        >
          <div style={{ width: 280, height: 358 }}>
            <Piece skin={skin} piece={detail} spin />
          </div>
          <Placard skin={skin} piece={detail} wide />
          <Link
            href={`/m/${detail.id}`}
            onClick={(event) => event.stopPropagation()}
            className="flex h-[42px] items-center rounded-full px-5 text-[14px] font-extrabold"
            style={{ background: skin.accent.bg, color: skin.accent.ink }}
          >
            افتح اللحظة
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function Placard({ skin, piece, wide = false }: { skin: HallSkin; piece: HallPiece; wide?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-lg px-3.5 py-2 text-center" style={{ background: skin.placard.bg, maxWidth: wide ? 320 : 260 }}>
      <p className="text-[10.5px] font-bold" style={{ color: skin.placard.muted }}>
        {piece.when}
      </p>
      {piece.line && piece.kind !== "THOUGHT" ? (
        <p className={`${wide ? "line-clamp-3" : "line-clamp-2"} text-[12.5px] leading-[19px]`} style={{ color: skin.placard.ink }}>
          {piece.line}
        </p>
      ) : null}
      {piece.kind === "PHOTO" && piece.text ? (
        <p className={`${wide ? "line-clamp-4" : "line-clamp-2"} text-[12.5px] leading-[19px]`} style={{ color: skin.placard.ink }}>
          {piece.text}
        </p>
      ) : null}
    </div>
  );
}

const SHADOW = "0 8px 18px rgba(0,0,0,.28)";

function Piece({ skin, piece, spin }: { skin: HallSkin; piece: HallPiece; spin: boolean }) {
  if (piece.kind === "PHOTO" && piece.mediaId) {
    return (
      <div className="h-full w-full" style={{ background: skin.photo.frame, padding: skin.photo.width, boxShadow: SHADOW }}>
        <div className="h-full w-full" style={{ background: skin.photo.mat, padding: skin.photo.matWidth }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${BASE}/api/media/${piece.mediaId}`}
            alt=""
            draggable={false}
            className="h-full w-full object-cover"
            style={{ objectPosition: `${piece.photoX ?? 50}% ${piece.photoY ?? 50}%` }}
          />
        </div>
      </div>
    );
  }
  if (piece.kind === "MUSIC") {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div
          className={`relative flex aspect-square w-[96%] items-center justify-center rounded-full ${spin ? "animate-spin" : ""}`}
          style={{ background: skin.vinyl.disc, boxShadow: SHADOW, animationDuration: "6s" }}
        >
          {[86, 72, 58].map((ring) => (
            <span key={ring} className="absolute rounded-full" style={{ width: `${ring}%`, height: `${ring}%`, border: `1px solid ${skin.vinyl.groove}` }} />
          ))}
          <span className="relative block aspect-square w-[40%] overflow-hidden rounded-full" style={{ background: skin.accent.bg }}>
            {piece.musicThumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={piece.musicThumb} alt="" draggable={false} className="h-full w-full object-cover" />
            ) : null}
          </span>
          <span className="absolute h-2 w-2 rounded-full" style={{ background: skin.wall }} />
        </div>
      </div>
    );
  }
  if (piece.kind === "PLACE") {
    return (
      <div className="flex h-full w-full items-center">
        <div className="flex w-full flex-col items-center gap-2 rounded-md px-3.5 py-5 text-center" style={{ background: skin.brass.bg, border: `3px solid ${skin.brass.edge}`, color: skin.brass.ink, boxShadow: SHADOW }}>
          <PinIcon size={26} />
          <p className="font-display line-clamp-3 text-[18px] font-extrabold">{piece.placeName ?? "مكان"}</p>
          {piece.placeCity ? <p className="text-[12px] opacity-80">{piece.placeCity}</p> : null}
        </div>
      </div>
    );
  }
  const Icon = piece.kind === "CITY" ? PlaneIcon : piece.kind === "SLEEP" ? MoonIcon : piece.kind === "WAKE" ? SunIcon : BookIcon;
  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-3 rounded p-[18px] text-center"
      style={{ background: skin.plaque.bg, border: `1px solid ${skin.plaque.edge}`, color: skin.plaque.ink, boxShadow: SHADOW }}
    >
      <Icon size={22} />
      <p className={`font-display line-clamp-7 font-bold ${piece.line.length > 90 ? "text-[14.5px] leading-[22px]" : "text-[17px] leading-[26px]"}`}>{piece.line}</p>
    </div>
  );
}

function Rope({ skin, hidden, w, h }: { skin: HallSkin; hidden: number; w: number; h: number }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-end pb-1.5">
      <div className="mb-5 flex flex-col items-center gap-1.5 text-center" style={{ color: skin.sign.ink }}>
        <LockIcon size={22} />
        <p className="font-display text-[16px] font-extrabold">{ar(hidden)} لحظة أقدم خلف الحبل</p>
        <span className="flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-extrabold" style={{ background: skin.accent.bg, color: skin.accent.ink }}>
          <SparkIcon size={14} /> افتحها مع آثار+
        </span>
      </div>
      <div className="relative flex items-end justify-between" style={{ width: w, height: h * 0.32 }}>
        <span className="block h-full w-2.5 rounded-full" style={{ background: skin.rope.post }} />
        <span className="block h-full w-2.5 rounded-full" style={{ background: skin.rope.post }} />
        <span
          className="absolute inset-x-1.5 top-1.5"
          style={{ height: h * 0.16, borderBottom: `6px solid ${skin.rope.cord}`, borderBottomLeftRadius: w, borderBottomRightRadius: w }}
        />
      </div>
    </div>
  );
}
