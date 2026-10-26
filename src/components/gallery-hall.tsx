"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BackIcon, BookIcon, CalendarIcon, ClockIcon, CloseIcon, LockIcon, MoonIcon, PinIcon, PlaneIcon, SparkIcon, SunIcon } from "@/components/icons";
import { AthrMark } from "@/components/brand";
import { BASE } from "@/lib/base";
import { ar, MONTHS, relative } from "@/lib/format";
import { hallEcho, type HallComment, type HallReaction } from "@/app/hall-actions";
import { HALL_SKIN, hallSkinOf, type HallSkin } from "@/lib/gallery-skin";
import { ReactionGlyph } from "@/components/reactions";
import { Avatar } from "@/components/ui";

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
  /** ما بعد الأولى بمواضعها — تُرسم كومةً (القاعدة ٣٤٩). */
  morePhotos: string[];
  morePhotoPos: { x: number; y: number }[];
  /** صدى اللحظة: كم تفاعلاً وتعليقاً، وأحدثُ من تفاعل بوجهه. */
  echo: { reactions: number; comments: number; faces: { kind: string; emoji: string | null; name: string; avatarMediaId: string | null }[] } | null;
  month: number;
  when: string;
  /** الساعةُ والتاريخُ لبطاقة الشرح — منفصلين بخطّ. */
  time: string;
  date: string;
};
type Slot = { type: "rope" } | { type: "piece"; piece: HallPiece };

const WINDOW = 2;
/** دورةُ نقش الجدار والأرضيّة — والأرضيّةُ أقربُ إلى العين فتمرّ أسرع (القاعدة ٣٥٠). */
const WALL_TILE = 220;
const FLOOR_TILE = 160;
const FLOOR_SPEED = 1.45;
const EASE = "cubic-bezier(.2,.8,.2,1)";
/** ارتفاعُ السقف وإفريزه، ومنه تتدلّى المصابيح؛ ثمّ لافتةُ الشهر، والأرضيّة. */
const CROWN = 16;
const HEAD_TOP = 64;
const FLOOR_H = 116;

/** إطارُ الثوب المرسوم إن رُفع — يقرؤه كلُّ `PhotoFrame` بلا تمريرٍ في كلّ طبقة. */
const FrameImage = createContext<string | null>(null);

export type HallImages = { wall: string | null; floor: string | null; frame: string | null };

/**
 * قاعةُ السنة على الويب (القاعدتان ٣٤٦ و٣٥٠) — نسخةُ `app/me/hall/[year].tsx`: لوحاتٌ معلّقة على
 * **جدارٍ حقيقيّ** — نقشٌ يتّصل ولوحٌ خشبيّ وقاعدة، وفوق كلّ لوحةٍ مصباحُها — والجدارُ يمرّ معها
 * بسرعتها والأرضيّةُ أسرع. بلا دورانٍ ثلاثيّ. والتاليةُ في اليسار، **تُسحب بالإصبع أو بالفأرة**.
 * الضغطُ على الحاليّة يفتح نافذتَها، وعلى جارتها يأتي بها، وشريطُ الشهور يقفز.
 */
export function GalleryHall({
  pieces,
  hidden,
  skin: worn,
  images,
}: {
  pieces: HallPiece[];
  hidden: number;
  skin: string | null;
  images: HallImages | null;
}) {
  // ثوبُ القاعة الملبوس من المتجر (القاعدة ٣٤٨)، وبلاه الكلاسيكيّة.
  const skin = worn ? hallSkinOf(worn) : HALL_SKIN;
  const router = useRouter();
  const slots: Slot[] = [...(hidden > 0 ? [{ type: "rope" } as Slot] : []), ...pieces.map((piece) => ({ type: "piece", piece }) as Slot)];
  const lastMonth = pieces.at(-1)?.month;
  const [index, setIndex] = useState(() => Math.max(0, slots.findIndex((slot) => slot.type === "piece" && slot.piece.month === lastMonth)));
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [detail, setDetail] = useState<{ piece: HallPiece; tab: Tab } | null>(null);
  const drag = useRef<{ x: number; y: number; t: number; on: boolean; id: number } | null>(null);
  const moved = useRef(false);
  const [grid, setGrid] = useState(false);
  const [W, setW] = useState(220);
  const H = Math.round(W * 1.25);
  // الجارتان تُطلّان من الحافّتين: يُرى أنّ الجدارَ يمتدّ.
  const STEP = W + 44;
  const frameTop = HEAD_TOP + 96;
  const [wallH, setWallH] = useState(0);
  // اللوحُ الخشبيّ يبدأ تحت البطاقة، ولا يقلّ ولا يأكل الجدار.
  const wainscot = wallH ? Math.round(Math.max(64, Math.min(wallH * 0.24, wallH - (frameTop + H + 104)))) : 80;

  useEffect(() => {
    // اللوحةُ بما يتّسع له الجدار: نافذةٌ قصيرة تصغّرها ولا تدفع البطاقةَ تحت الأرض.
    const fit = () => {
      const room = window.innerHeight - frameTop - FLOOR_H - 124;
      setW(Math.round(Math.max(150, Math.min(250, Math.min(window.innerWidth, 640) * 0.62, room / 1.25))));
      setWallH(Math.max(0, window.innerHeight - FLOOR_H));
    };
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

  /** شهرٌ قبل أو بعد: إلى أوّل لوحةٍ فيه. */
  const shiftMonth = (by: number) => {
    if (!months.length) return;
    let now = 0;
    months.forEach((row, at) => {
      if (row.first <= index) now = at;
    });
    const next = months[Math.max(0, Math.min(months.length - 1, now + by))];
    if (next) go(next.first);
  };

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
    if (!start) return;
    if (!start.on) {
      // سحبةٌ عموديّة: إلى أعلى شهرٌ أحدث، وإلى أسفل أقدم — كما يصعد السهمُ في التلميح.
      const y = event.clientY - start.y;
      if (Math.abs(y) > 40 && Math.abs(y) > Math.abs(event.clientX - start.x) * 1.4) {
        moved.current = true;
        shiftMonth(y < 0 ? 1 : -1);
      }
      return;
    }
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
      if (detail) return;
      if (event.key === "ArrowLeft") setIndex((at) => Math.min(slots.length - 1, at + 1));
      if (event.key === "ArrowRight") setIndex((at) => Math.max(0, at - 1));
      if (event.key === "ArrowUp") shiftMonth(1);
      if (event.key === "ArrowDown") shiftMonth(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detail, slots.length]);

  const shift = index * STEP + dx;
  const glide = dragging ? "none" : `background-position 320ms ${EASE}, transform 320ms ${EASE}`;
  const piece = current?.type === "piece" ? current.piece : null;
  const monthPieces = slots.flatMap((slot, at) => (slot.type === "piece" && slot.piece.month === wallMonth ? [{ at, piece: slot.piece }] : []));

  return (
    <FrameImage.Provider value={images?.frame ?? null}>
      <div className="flex min-h-0 grow flex-col" style={{ background: skin.wall }}>
        <div
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          className="relative min-h-[520px] grow select-none overflow-hidden"
          style={{ backgroundColor: skin.wall, touchAction: "none", cursor: dragging ? "grabbing" : "grab" }}
        >
          {/* الجدار: نقشٌ مرفوع يتكرّر، وبلاه ورقُ جدارٍ بخطوطٍ خافتة — يمرّ مع اللوحات بسرعتها. */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              top: CROWN,
              backgroundImage: images?.wall
                ? `url(${BASE}/api/media/${images.wall})`
                : `repeating-linear-gradient(90deg, transparent 0 54px, ${skin.wallShade} 54px 55px, transparent 55px 61px, ${skin.wallShade} 61px 62px)`,
              backgroundSize: images?.wall ? `${WALL_TILE}px ${WALL_TILE}px` : undefined,
              backgroundPositionX: `${shift}px`,
              opacity: images?.wall ? 1 : 0.32,
              transition: glide,
            }}
          />
          {/* اللوحُ الخشبيّ: حاجزٌ بارزٌ في أعلاه، ثمّ ألواحٌ محفورة بإطارٍ داخليّ. */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0"
            style={{
              height: wainscot,
              backgroundColor: skin.wall,
              borderTop: `2px solid rgba(255,255,255,.55)`,
              boxShadow: `inset 0 7px 0 ${skin.wallShade}, inset 0 9px 0 rgba(0,0,0,.14), inset 0 15px 0 rgba(0,0,0,.05)`,
            }}
          >
            <div
              className="absolute inset-x-0"
              style={{
                top: 26,
                bottom: 24,
                backgroundImage: `linear-gradient(90deg, transparent 9px, rgba(0,0,0,.13) 9px 11px, transparent 11px 17px, rgba(0,0,0,.07) 17px 18px, transparent 18px ${WALL_TILE / 2 - 18}px, rgba(0,0,0,.07) ${WALL_TILE / 2 - 18}px ${WALL_TILE / 2 - 17}px, transparent ${WALL_TILE / 2 - 17}px ${WALL_TILE / 2 - 11}px, rgba(255,255,255,.5) ${WALL_TILE / 2 - 11}px ${WALL_TILE / 2 - 9}px, transparent ${WALL_TILE / 2 - 9}px)`,
                backgroundSize: `${WALL_TILE / 2}px 100%`,
                backgroundPositionX: `${shift}px`,
                borderTop: "2px solid rgba(0,0,0,.1)",
                borderBottom: "2px solid rgba(255,255,255,.45)",
                transition: glide,
              }}
            />
          </div>
          {/* الضوءُ والعمق: سقفٌ يُظلّ أعلاه، وضوءٌ يبهت إلى أسفل، والحافّتان أعتم. */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(0,0,0,.16), transparent 14%, transparent 70%, rgba(0,0,0,.14)), radial-gradient(ellipse 70% 72% at 50% 45%, transparent 60%, rgba(0,0,0,.26))",
            }}
          />
          {/* السقف ثمّ إفريزٌ مدرّج: ضوءٌ فوق ظلٍّ فوق ضوء. */}
          <div className="pointer-events-none absolute inset-x-0 top-0" style={{ height: CROWN - 8, background: skin.ceiling }} />
          <div
            className="pointer-events-none absolute inset-x-0"
            style={{
              top: CROWN - 8,
              height: 13,
              background: `linear-gradient(180deg, rgba(255,255,255,.4) 0 2px, ${skin.wallShade} 2px 5px, rgba(255,255,255,.55) 5px 7px, rgba(0,0,0,.18) 7px 8px, rgba(0,0,0,.05) 8px 13px)`,
            }}
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0" style={{ height: 9, background: skin.floorEdge, boxShadow: "0 -2px 0 rgba(255,255,255,.4)" }} />

          {slots.length === 0 ? (
            <p className="absolute inset-x-0 text-center text-[13px]" style={{ top: frameTop + H / 2 - 10, color: skin.sign.muted }}>
              ما في هالسنة لحظات بعد.
            </p>
          ) : null}
          {slots.map((slot, at) => {
            if (Math.abs(at - index) > WINDOW) return null;
            const offset = (index - at) * STEP + dx;
            const near = Math.min(1, Math.abs(offset) / STEP);
            const badge = at !== index && slot.type === "piece" ? slot.piece.echo?.faces[0] ?? null : null;
            const coneH = frameTop + H * 0.75 - CROWN;
            return (
              <div
                key={slot.type === "rope" ? "rope" : slot.piece.id}
                className="pointer-events-none absolute top-0"
                style={{ width: W, height: frameTop + H + 12, left: `calc(50% - ${W / 2}px)`, transform: `translateX(${offset}px)`, transition: dragging ? "none" : `transform 320ms ${EASE}` }}
              >
                {/* المخروط: ضوءٌ دافئ يبدأ ضيّقاً عند المصباح ويتّسع على اللوحة ويذوب تحتها. */}
                <span
                  className="absolute"
                  style={{
                    top: CROWN + 10,
                    left: -W * 0.25,
                    width: W * 1.5,
                    height: coneH,
                    clipPath: "polygon(47% 0, 53% 0, 92% 100%, 8% 100%)",
                    background: `linear-gradient(180deg, ${skin.light}, color-mix(in srgb, ${skin.light} 38%, transparent) 55%, transparent)`,
                    opacity: (1 - near * 0.55) * 0.85,
                    transition: dragging ? "none" : "opacity 320ms",
                  }}
                />
                {/* المصباحُ في السقف: ساقٌ ورأسٌ داكنٌ بحافّةٍ نحاسيّة، ووهجٌ عند فوهته. */}
                <span className="absolute flex flex-col items-center" style={{ top: CROWN - 4, left: W / 2 - 8, width: 16 }}>
                  <span className="block h-[5px] w-[3px]" style={{ background: skin.brass.edge }} />
                  <span className="block h-[11px] w-4" style={{ background: skin.sign.ink, border: `1px solid ${skin.brass.edge}`, borderRadius: "4px 4px 7px 7px" }} />
                  <span className="-mt-px block h-[3px] w-2.5 rounded" style={{ background: skin.light }} />
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (moved.current) return;
                    if (at !== index) return go(at);
                    if (slot.type === "rope") router.push("/subscribe");
                    else setDetail({ piece: slot.piece, tab: "art" });
                  }}
                  className="pointer-events-auto absolute block"
                  style={{ top: frameTop, left: 0, width: W, height: H }}
                >
                  {slot.type === "rope" ? <Rope skin={skin} hidden={hidden} w={W} h={H} /> : <Piece skin={skin} piece={slot.piece} spin={at === index} />}
                  {badge ? (
                    <span className="absolute flex h-[30px] w-[30px] items-center justify-center rounded-full" style={{ left: -6, bottom: -8, background: skin.placard.bg, boxShadow: SOFT }}>
                      <ReactionGlyph kind={badge.kind} emoji={badge.emoji} size={22} />
                    </span>
                  ) : null}
                </button>
              </div>
            );
          })}

          {/* لافتةُ الشهر: اسمُ الجدار، ثمّ لمن هو، ثمّ كم فيه. */}
          <div className="pointer-events-none absolute inset-x-0 flex flex-col items-center gap-1" style={{ top: HEAD_TOP }}>
            {wallMonth !== null ? (
              <>
                <p className="font-display text-[30px] font-extrabold leading-[40px]" style={{ color: skin.sign.ink }}>
                  جدار {MONTHS[wallMonth]}
                </p>
                <p className="flex items-center gap-1.5 text-[12.5px] font-bold" style={{ color: skin.sign.muted }}>
                  <LockIcon size={12} /> خاص بك
                </p>
                <p className="text-[12px] opacity-85" style={{ color: skin.sign.muted }}>
                  {ar(months.find((row) => row.month === wallMonth)?.count ?? 0)} لحظة
                </p>
              </>
            ) : null}
          </div>

          {/* صدى الحاليّة فوق كلّ طبقة، فوق إطارها. */}
          {piece?.echo?.faces.length && !detail ? <EchoRise key={piece.id} echo={piece.echo} w={W} top={frameTop + H * 0.78} rise={H * 0.9} /> : null}

          <div className="absolute inset-x-6 flex justify-center" style={{ top: frameTop + H + 22 }}>
            {piece ? <Placard skin={skin} piece={piece} onEcho={() => setDetail({ piece, tab: "echo" })} /> : null}
          </div>

          {/* زرٌّ عائم على اللوح الخشبيّ: يفتح اللوحةَ الحاليّة بنافذتها. */}
          {piece ? (
            <button
              type="button"
              aria-label="عرض اللحظة"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => setDetail({ piece, tab: "art" })}
              className="absolute bottom-3.5 right-4 z-20 h-[66px] w-[66px] rounded-full p-[3px]"
              style={{ background: skin.placard.bg, border: `1px solid ${skin.photo.frame}`, boxShadow: SHADOW }}
            >
              <span className="flex h-full w-full flex-col items-center justify-center gap-px rounded-full" style={{ border: `1px solid ${skin.photo.frame}`, color: skin.placard.ink }}>
                <ImageGlyph />
                <span className="text-[8.5px] font-extrabold">عرض اللحظة</span>
              </span>
            </button>
          ) : null}

          {/* أعلى الجدار: الرجوعُ و«عرض اللحظات» يميناً، والعلامةُ و«آثار» يساراً. */}
          <div className="absolute inset-x-4 top-2 z-20 flex items-center justify-between" onPointerDown={(event) => event.stopPropagation()}>
            <div className="flex items-center gap-2">
              <Link
                href="/archive"
                aria-label="رجوع"
                className="flex h-[38px] w-[38px] items-center justify-center rounded-full"
                style={{ background: skin.placard.bg, color: skin.placard.ink, boxShadow: SOFT }}
              >
                <span className="block -scale-x-100">
                  <BackIcon size={18} />
                </span>
              </Link>
              {months.length ? (
                <button
                  type="button"
                  onClick={() => setGrid(true)}
                  className="flex h-[38px] items-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-extrabold"
                  style={{ background: skin.placard.bg, color: skin.placard.ink, boxShadow: SOFT }}
                >
                  <GridGlyph /> عرض اللحظات
                </button>
              ) : null}
            </div>
            <div className="flex flex-col items-center">
              <span className="flex items-center gap-1.5">
                <span className="font-display text-[24px] font-extrabold leading-8" style={{ color: skin.sign.ink }}>
                  آثار
                </span>
                <AthrMark size={28} />
              </span>
              <span className="latin -mt-1 text-[8.5px] font-bold tracking-[4.5px]" style={{ color: skin.sign.muted }}>
                ATHAR
              </span>
            </div>
          </div>
        </div>

        {/* الأرضيّة: ألواحُ خشبٍ بدرجاتٍ وفواصلَ متخالفة تمرّ أسرع من الجدار، والشهورُ عليها. */}
        <div
          className="relative pb-5 pt-3.5"
          style={{
            height: FLOOR_H,
            backgroundColor: skin.floor,
            backgroundImage: images?.floor
              ? `linear-gradient(180deg, rgba(0,0,0,.42), rgba(0,0,0,.05) 30%, rgba(0,0,0,.3)), url(${BASE}/api/media/${images.floor})`
              : `linear-gradient(180deg, rgba(0,0,0,.42), rgba(0,0,0,.05) 30%, rgba(0,0,0,.3)), radial-gradient(ellipse 55% 60% at 50% 20%, rgba(255,233,194,.22), transparent), repeating-linear-gradient(90deg, transparent 0 ${FLOOR_TILE / 2 - 1}px, ${skin.floorEdge} ${FLOOR_TILE / 2 - 1}px ${FLOOR_TILE / 2}px), repeating-linear-gradient(180deg, rgba(255,236,200,.06) 0 21px, ${skin.floorEdge} 21px 22px, rgba(0,0,0,.07) 22px 43px, ${skin.floorEdge} 43px 44px)`,
            backgroundSize: images?.floor ? `100% 100%, ${FLOOR_TILE}px ${FLOOR_TILE}px` : undefined,
            backgroundPositionX: images?.floor ? `0, ${shift * FLOOR_SPEED}px` : `0, 0, ${shift * FLOOR_SPEED}px, 0`,
            transition: glide,
          }}
        >
          <div className="flex items-center">
            <div className="flex min-w-0 grow gap-2 overflow-x-auto px-4" style={{ scrollbarWidth: "none" }}>
              {months.map((row) => {
                const on = row.month === wallMonth;
                return (
                  <button key={row.month} type="button" onClick={() => go(row.first)} className="flex shrink-0 flex-col items-center gap-1">
                    <span
                      className="flex h-[34px] items-center rounded-full px-4 text-[13px] font-extrabold"
                      style={{
                        background: on ? skin.accent.bg : "rgba(251,248,241,.16)",
                        border: `1px solid ${on ? skin.accent.bg : "rgba(251,248,241,.22)"}`,
                        color: on ? skin.accent.ink : "#FBF8F1",
                      }}
                    >
                      {MONTHS[row.month]}
                    </span>
                    <span className="block h-[5px] w-[5px] rounded-full" style={{ background: on ? skin.accent.bg : "transparent" }} />
                  </button>
                );
              })}
            </div>
            {months.length > 1 ? (
              <button type="button" aria-label="الشهر التالي" onClick={() => shiftMonth(1)} className="shrink-0 px-3 pb-2 text-[#FBF8F1]">
                <BackIcon size={18} />
              </button>
            ) : null}
          </div>
          {months.length > 1 ? (
            <p className="mt-1.5 flex flex-col items-center text-[11.5px] font-semibold" style={{ color: "rgba(251,248,241,.85)" }}>
              <span className="block rotate-90">
                <BackIcon size={13} />
              </span>
              اسحب للتنقل بين الشهور
            </p>
          ) : null}
        </div>

        {grid ? (
          <MonthGrid
            skin={skin}
            title={wallMonth !== null ? `جدار ${MONTHS[wallMonth]}` : ""}
            items={monthPieces}
            current={index}
            onPick={(at) => {
              setGrid(false);
              go(at);
            }}
            onClose={() => setGrid(false)}
          />
        ) : null}
        {detail ? <HallSheet skin={skin} piece={detail.piece} tab={detail.tab} onClose={() => setDetail(null)} /> : null}
      </div>
    </FrameImage.Provider>
  );
}

const SOFT = "0 3px 8px rgba(58,42,20,.16)";

function GridGlyph() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <rect x={3} y={3} width={8} height={8} rx={2} />
      <rect x={13} y={3} width={8} height={8} rx={2} />
      <rect x={3} y={13} width={8} height={8} rx={2} />
      <rect x={13} y={13} width={8} height={8} rx={2} />
    </svg>
  );
}

function ImageGlyph() {
  return (
    <svg width={19} height={19} viewBox="0 0 24 24" aria-hidden>
      <rect x={3} y={4} width={18} height={16} rx={3} fill="none" stroke="currentColor" strokeWidth={2} />
      <polygon points="5,18 10,12 13,15 15,13 19,18" fill="currentColor" />
      <rect x={14.5} y={7.5} width={3} height={3} rx={1.5} fill="currentColor" />
    </svg>
  );
}

/** «عرض اللحظات»: لحظاتُ الشهر بلاطاتٍ في نافذة، والضغطُ يمشي بك إلى لوحتها على الجدار. */
function MonthGrid({
  skin,
  title,
  items,
  current,
  onPick,
  onClose,
}: {
  skin: HallSkin;
  title: string;
  items: { at: number; piece: HallPiece }[];
  current: number;
  onPick: (at: number) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="shell-fixed fixed inset-0 z-50 flex flex-col justify-end" style={{ background: "rgba(20,14,6,.45)" }} onClick={onClose}>
      <div className="hall-enter max-h-[78%] overflow-y-auto rounded-t-[26px] px-[18px] pb-6" style={{ background: skin.placard.bg }} onClick={(event) => event.stopPropagation()}>
        <span className="mx-auto mt-2.5 block h-[5px] w-[42px] rounded-full" style={{ background: skin.placard.muted, opacity: 0.35 }} />
        <div className="flex items-center gap-2.5 pb-2.5 pt-3">
          <p className="font-display min-w-0 grow text-[19px] font-extrabold" style={{ color: skin.placard.ink }}>
            {title}
          </p>
          <button type="button" aria-label="إغلاق" onClick={onClose} className="flex h-[34px] w-[34px] items-center justify-center rounded-full" style={{ background: "rgba(0,0,0,.06)", color: skin.placard.ink }}>
            <CloseIcon size={15} />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {items.map(({ at, piece }) => (
            <button
              key={piece.id}
              type="button"
              onClick={() => onPick(at)}
              className="flex aspect-[5/6] items-center justify-center overflow-hidden rounded-[10px]"
              style={{
                background: skin.photo.mat,
                border: at === current ? `2.5px solid ${skin.accent.bg}` : "1px solid rgba(0,0,0,.08)",
                padding: piece.kind === "PHOTO" && piece.mediaId ? 0 : 8,
              }}
            >
              {piece.kind === "PHOTO" && piece.mediaId ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`${BASE}/api/media/${piece.mediaId}`} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="line-clamp-4 text-center text-[11.5px] leading-[17px]" style={{ color: skin.placard.ink }}>
                  {piece.line}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** بطاقةُ الشرح تحت اللوحة، كبطاقة متحف: الساعةُ | التاريخ، ثمّ ما لا تقوله اللوحةُ وحدها، ثمّ خطٌّ، ثمّ صداها. */
function Placard({ skin, piece, onEcho }: { skin: HallSkin; piece: HallPiece; onEcho?: () => void }) {
  const line = piece.kind === "PHOTO" ? piece.text : piece.kind === "MUSIC" ? piece.line : null;
  const echo = piece.echo;
  return (
    <div
      className="flex min-w-[220px] max-w-[290px] flex-col items-center gap-[7px] rounded-xl px-4 py-2.5 text-center"
      style={{ background: skin.placard.bg, border: "1px solid rgba(0,0,0,.05)", boxShadow: SOFT }}
    >
      <p className="flex items-center gap-2.5 text-[12.5px] font-bold" style={{ color: skin.placard.ink }}>
        <span className="flex items-center gap-1.5">
          <span style={{ color: skin.placard.muted }}>
            <ClockIcon size={14} />
          </span>
          {piece.time}
        </span>
        <span className="block h-3.5 w-px" style={{ background: skin.placard.muted, opacity: 0.4 }} />
        <span className="flex items-center gap-1.5">
          <span style={{ color: skin.placard.muted }}>
            <CalendarIcon size={14} />
          </span>
          {piece.date}
        </span>
      </p>
      {line ? (
        <p className="line-clamp-2 text-[12.5px] leading-[19px]" style={{ color: skin.placard.ink }}>
          {line}
        </p>
      ) : null}
      {echo && (echo.reactions || echo.comments) ? (
        <>
          <span className="block h-px self-stretch" style={{ background: skin.placard.muted, opacity: 0.22 }} />
          <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onEcho?.();
            }}
            className="flex items-center gap-2"
          >
            <span className="flex">
              {echo.faces.slice(0, 3).map((face, at) => (
                <span key={at} className="rounded-full" style={{ marginInlineStart: at ? -7 : 0, background: skin.placard.bg, boxShadow: `0 0 0 1.5px ${skin.placard.bg}` }}>
                  <ReactionGlyph kind={face.kind} emoji={face.emoji} size={21} />
                </span>
              ))}
            </span>
            {echo.reactions ? (
              <span className="text-[13px] font-extrabold" style={{ color: skin.placard.ink }}>
                {ar(echo.reactions)}
              </span>
            ) : null}
            {echo.comments ? (
              <span className="text-[12px] font-bold" style={{ color: skin.placard.muted }}>
                {ar(echo.comments)} تعليق
              </span>
            ) : null}
          </button>
        </>
      ) : null}
    </div>
  );
}

/** وجوهُ من تفاعل تصعد فوق الحاليّة من أسفلها إلى أعلاها وتذوب — طبقةٌ فوق كلّ شيء (`z-30`). */
function EchoRise({ echo, w, top, rise }: { echo: NonNullable<HallPiece["echo"]>; w: number; top: number; rise: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      {echo.faces.slice(0, 8).map((face, at) => {
        // فوق اللوحة نفسها، يمينٌ ثمّ يسار في عرضها — أمامها لا على جانبيها.
        const side = at % 2 ? 1 : -1;
        return (
          <span
            key={at}
            className="hall-rise absolute"
            style={{
              left: `calc(50% + ${side * (w * 0.12 + ((at * 23) % Math.round(w * 0.28))) - 15}px)`,
              top,
              animationDelay: `${300 + at * 380}ms`,
              ["--rise" as string]: `${-rise}px`,
            }}
          >
            <ReactionGlyph kind={face.kind} emoji={face.emoji} size={30} />
          </span>
        );
      })}
    </div>
  );
}

type Tab = "art" | "echo" | "comments";

/**
 * نافذةُ اللوحة — **بقرار المالك**: تصعد من أسفل بمقبضها، وتُغلق بـ«×» وبـEsc وبالضغط خارجها
 * وبسحبها إلى أسفل من رأسها، أو من جسمها ما دام في أعلاه. ثلاثُ شرائح: اللوحة، والتفاعلات
 * قائمةً مرتّبة بشرائحَ تُصفّي، والتعليقات — من اللحظة نفسها في الخادم (`hallEcho`).
 */
function HallSheet({ skin, piece, tab: first, onClose }: { skin: HallSkin; piece: HallPiece; tab: Tab; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>(first);
  const [echo, setEcho] = useState<{ reactions: HallReaction[]; comments: HallComment[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const [dy, setDy] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [entered, setEntered] = useState(false);
  const body = useRef<HTMLDivElement | null>(null);
  const pull = useRef<{ y: number; on: boolean } | null>(null);

  useEffect(() => {
    let live = true;
    void hallEcho(piece.id).then((result) => {
      if (!live) return;
      if ("error" in result) setFailed(true);
      else setEcho(result);
    });
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => {
      live = false;
      cancelAnimationFrame(frame);
    };
  }, [piece.id]);

  const close = () => {
    setLeaving(true);
    setTimeout(onClose, 220);
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  // السحبُ إلى أسفل: من الرأس دائماً، ومن الجسم ما دام في أعلاه — وإلّا فهو تمريرٌ له.
  const onDown = (event: React.PointerEvent, fromBody: boolean) => {
    if (fromBody && (body.current?.scrollTop ?? 0) > 2) return;
    pull.current = { y: event.clientY, on: false };
  };
  const onMove = (event: React.PointerEvent) => {
    const start = pull.current;
    if (!start) return;
    const d = event.clientY - start.y;
    if (!start.on) {
      if (d < 8) return;
      start.on = true;
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    }
    setDy(Math.max(0, d));
  };
  const onUp = () => {
    const start = pull.current;
    pull.current = null;
    if (!start?.on) return;
    if (dy > 110) close();
    else setDy(0);
  };

  const reactionCount = echo?.reactions.length ?? piece.echo?.reactions ?? 0;
  const commentCount = echo?.comments.length ?? piece.echo?.comments ?? 0;
  const tabs: { key: Tab; label: string }[] = [
    { key: "art", label: "اللوحة" },
    { key: "echo", label: reactionCount ? `التفاعلات ${ar(reactionCount)}` : "التفاعلات" },
    { key: "comments", label: commentCount ? `التعليقات ${ar(commentCount)}` : "التعليقات" },
  ];
  const shown = entered && !leaving;

  return (
    <div className="shell-fixed inset-0 z-40">
      <div
        onClick={close}
        className="absolute inset-0"
        style={{ background: "rgba(6,10,14,.6)", opacity: shown ? Math.max(0, 1 - dy / 500) : 0, transition: "opacity 220ms" }}
      />
      <div
        className="absolute inset-x-0 bottom-0 flex flex-col rounded-t-[26px]"
        style={{
          height: "90%",
          background: "#141A20",
          boxShadow: "0 -6px 24px rgba(0,0,0,.4)",
          transform: `translateY(${shown ? `${dy}px` : "100%"})`,
          transition: pull.current?.on ? "none" : "transform 260ms cubic-bezier(.2,.8,.2,1)",
        }}
      >
        <div onPointerDown={(event) => onDown(event, false)} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} style={{ touchAction: "none" }}>
          <span className="mx-auto mt-2.5 block h-[5px] w-[42px] rounded-full" style={{ background: "rgba(255,255,255,.28)" }} />
          <div className="flex items-center gap-2.5 px-[18px] pt-3">
            <button
              type="button"
              aria-label="رجوع إلى القاعة"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={close}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
              style={{ background: "rgba(255,255,255,.1)" }}
            >
              <CloseIcon size={16} />
            </button>
            <div className="min-w-0 grow">
              <p className="font-display truncate text-[17px] font-extrabold text-white">{piece.when.split(" · ")[0]}</p>
              <p className="truncate text-[12px]" style={{ color: "rgba(255,255,255,.6)" }}>
                {piece.when.split(" · ")[1] ?? ""}
                {piece.placeName ? ` · ${piece.placeName}` : ""}
              </p>
            </div>
          </div>
          <div className="mt-3.5 flex px-[18px]" style={{ borderBottom: "1px solid rgba(255,255,255,.1)" }}>
            {tabs.map((one) => {
              const on = one.key === tab;
              return (
                <button
                  key={one.key}
                  type="button"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => setTab(one.key)}
                  className="relative flex-1 py-[11px] text-[13.5px]"
                  style={{ color: on ? "#fff" : "rgba(255,255,255,.55)", fontWeight: on ? 800 : 600 }}
                >
                  {one.label}
                  <span className="absolute -bottom-px left-[15%] block h-[2.5px] w-[70%] rounded-full" style={{ background: on ? skin.accent.bg : "transparent" }} />
                </button>
              );
            })}
          </div>
        </div>

        <div
          ref={body}
          key={tab}
          onPointerDown={(event) => event.pointerType === "touch" && onDown(event, true)}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          className="min-h-0 grow overflow-y-auto p-[18px] pb-10"
        >
          {tab === "art" ? (
            <div className="flex flex-col items-center gap-[18px]">
              <div className="rounded-[18px] p-[18px]" style={{ background: skin.wall }}>
                <DetailPiece skin={skin} piece={piece} />
              </div>
              <Placard skin={skin} piece={piece} onEcho={() => setTab("echo")} />
              <Link
                href={`/m/${piece.id}`}
                className="flex h-[46px] items-center rounded-full px-[26px] text-[14.5px] font-extrabold"
                style={{ background: skin.accent.bg, color: skin.accent.ink }}
              >
                افتح اللحظة
              </Link>
            </div>
          ) : tab === "echo" ? (
            <ReactionList skin={skin} rows={echo?.reactions ?? null} failed={failed} />
          ) : (
            <CommentList rows={echo?.comments ?? null} failed={failed} />
          )}
        </div>
      </div>
    </div>
  );
}

const keyOf = (row: HallReaction) => (row.kind === "CUSTOM" ? `CUSTOM:${row.emoji}` : row.kind);

/** التفاعلاتُ مرتّبة: الأكثرُ أوّلاً، وداخلَ كلّ تفاعلٍ بالاسم — وشرائحُ بعددها تُصفّي، والصفوفُ تدخل متتابعة. */
function ReactionList({ skin, rows, failed }: { skin: HallSkin; rows: HallReaction[] | null; failed: boolean }) {
  const [only, setOnly] = useState<string | null>(null);
  if (!rows) return failed ? <Empty>تعذّر جلب التفاعلات.</Empty> : <Empty>جارٍ التحميل…</Empty>;
  if (!rows.length) return <Empty>ما تفاعل أحد مع هذه اللحظة بعد.</Empty>;
  const counts = new Map<string, { kind: string; emoji: string | null; count: number }>();
  for (const row of rows) {
    const now = counts.get(keyOf(row));
    if (now) now.count += 1;
    else counts.set(keyOf(row), { kind: row.kind, emoji: row.emoji, count: 1 });
  }
  const groups = [...counts.entries()].sort((a, b) => b[1].count - a[1].count);
  const rank = new Map(groups.map(([key], at) => [key, at]));
  const sorted = rows
    .filter((row) => !only || keyOf(row) === only)
    .sort((a, b) => (rank.get(keyOf(a)) ?? 0) - (rank.get(keyOf(b)) ?? 0) || a.name.localeCompare(b.name, "ar"));
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        <SheetChip on={!only} accent={skin.accent} onClick={() => setOnly(null)}>
          الكل {ar(rows.length)}
        </SheetChip>
        {groups.map(([key, group]) => (
          <SheetChip key={key} on={only === key} accent={skin.accent} onClick={() => setOnly(only === key ? null : key)}>
            <ReactionGlyph kind={group.kind} emoji={group.emoji} size={20} />
            {ar(group.count)}
          </SheetChip>
        ))}
      </div>
      {sorted.map((row, at) => (
        <div key={`${row.userId}:${keyOf(row)}`} className="hall-enter" style={{ animationDelay: `${Math.min(at, 12) * 45}ms` }}>
          <div className="flex items-center gap-3 py-1">
            <Avatar name={row.name} size={44} mediaId={row.avatarMediaId} />
            <p className="min-w-0 grow truncate text-[14.5px] font-bold text-white">{row.mine ? "أنت" : row.name}</p>
            <ReactionGlyph kind={row.kind} emoji={row.emoji} size={28} />
          </div>
          <span className="ms-14 mt-2.5 block h-px" style={{ background: "rgba(255,255,255,.07)" }} />
        </div>
      ))}
    </div>
  );
}

function CommentList({ rows, failed }: { rows: HallComment[] | null; failed: boolean }) {
  if (!rows) return failed ? <Empty>تعذّر جلب التعليقات.</Empty> : <Empty>جارٍ التحميل…</Empty>;
  if (!rows.length) return <Empty>ما علّق أحد على هذه اللحظة بعد.</Empty>;
  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((row, at) => (
        <div key={row.id} className="hall-enter flex items-start gap-3 py-1.5" style={{ animationDelay: `${Math.min(at, 12) * 45}ms` }}>
          <Avatar name={row.user.name} size={40} mediaId={row.user.avatarMediaId} />
          <div className="min-w-0 grow">
            <p className="flex items-center gap-2">
              <span className="truncate text-[13.5px] font-extrabold text-white">{row.user.name}</span>
              <span className="shrink-0 text-[11px]" style={{ color: "rgba(255,255,255,.5)" }}>
                {relative(new Date(row.createdAt))}
              </span>
            </p>
            {row.sticker ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`${BASE}/api/media/${row.sticker.mediaId}`} alt="ملصق" className="mt-1 h-24 w-24 object-contain" />
            ) : (
              <p className="mt-0.5 text-[14px] leading-[22px]" style={{ color: "rgba(255,255,255,.88)" }}>
                {row.body}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-8 text-center text-[13px]" style={{ color: "rgba(255,255,255,.6)" }}>
      {children}
    </p>
  );
}

function SheetChip({ on, accent, onClick, children }: { on: boolean; accent: { bg: string; ink: string }; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-9 shrink-0 items-center gap-1.5 rounded-full px-[13px] text-[13px] font-extrabold"
      style={{ background: on ? accent.bg : "rgba(255,255,255,.1)", color: on ? accent.ink : "#fff" }}
    >
      {children}
    </button>
  );
}

/** صورُ اللحظة متعدّدة الصور كومةً في الإطار الكبير: الضغطُ يُقلّب العليا إلى آخرها. */
function DetailPiece({ skin, piece }: { skin: HallSkin; piece: HallPiece }) {
  const [top, setTop] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const photos =
    piece.kind === "PHOTO" && piece.mediaId
      ? [
          { mediaId: piece.mediaId, x: piece.photoX ?? 50, y: piece.photoY ?? 50 },
          ...piece.morePhotos.map((mediaId, at) => ({ mediaId, x: piece.morePhotoPos[at]?.x ?? 50, y: piece.morePhotoPos[at]?.y ?? 50 })),
        ]
      : [];
  if (photos.length < 2) {
    return (
      <div style={{ width: 280, height: 358 }}>
        <Piece skin={skin} piece={piece} spin />
      </div>
    );
  }
  const order = photos.map((_, at) => photos[(top + at) % photos.length]);
  return (
    <button
      type="button"
      aria-label="الصورة التالية"
      onClick={(event) => {
        event.stopPropagation();
        if (leaving) return;
        setLeaving(true);
        setTimeout(() => {
          setTop((now) => (now + 1) % photos.length);
          setLeaving(false);
        }, 260);
      }}
      className="relative block"
      style={{ width: 280, height: 358 }}
    >
      {order
        .slice(0, 3)
        .reverse()
        .map((photo, back, list) => {
          const depth = list.length - 1 - back;
          const lift = depth === 0;
          return (
            <span
              key={photo.mediaId}
              className="absolute inset-0 block"
              style={{
                transform: lift && leaving ? "translateX(-90%) rotate(-12deg)" : `translate(${depth * 10}px, ${depth * -8}px) rotate(${depth ? (depth % 2 ? -4 : 3) : 0}deg)`,
                opacity: lift && leaving ? 0 : 1,
                transition: "transform 260ms ease-in, opacity 260ms ease-in",
              }}
            >
              <PhotoFrame skin={skin} mediaId={photo.mediaId} x={photo.x} y={photo.y} />
            </span>
          );
        })}
      <span className="absolute right-3 top-3 rounded-full px-2 text-[11px] font-bold leading-[22px] text-white" style={{ background: "rgba(14,26,36,.6)" }}>
        {ar(top + 1)}/{ar(photos.length)}
      </span>
    </button>
  );
}

/** إطارُ الصورة بلون الثوب — وإن رُفع للثوب إطارٌ مرسوم (القاعدة ٣٥٠) مُدّ فوقها كلّها. */
function PhotoFrame({ skin, mediaId, x, y }: { skin: HallSkin; mediaId: string; x: number; y: number }) {
  const frame = useContext(FrameImage);
  return (
    <div className="relative h-full w-full" style={{ background: frame ? skin.photo.mat : skin.photo.frame, padding: skin.photo.width, boxShadow: SHADOW }}>
      <div className="h-full w-full" style={{ background: skin.photo.mat, padding: skin.photo.matWidth }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${BASE}/api/media/${mediaId}`} alt="" draggable={false} className="h-full w-full object-cover" style={{ objectPosition: `${x}% ${y}%` }} />
      </div>
      {frame ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`${BASE}/api/media/${frame}`} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full" style={{ objectFit: "fill" }} />
      ) : null}
    </div>
  );
}

const SHADOW = "0 12px 26px rgba(58,42,20,.3)";

function Piece({ skin, piece, spin }: { skin: HallSkin; piece: HallPiece; spin: boolean }) {
  if (piece.kind === "PHOTO" && piece.mediaId) {
    return (
      <div className="relative h-full w-full">
        {/* ما بعد الأولى إطاران مائلان خلفها: يُرى أنّها كومةٌ قبل أن تُفتح. */}
        {piece.morePhotos.slice(0, 2).map((mediaId, at) => (
          <span key={mediaId} className="absolute inset-0 block" style={{ transform: at ? "translateX(-8px) rotate(-5deg)" : "translateX(8px) rotate(4deg)" }}>
            <PhotoFrame skin={skin} mediaId={mediaId} x={piece.morePhotoPos[at]?.x ?? 50} y={piece.morePhotoPos[at]?.y ?? 50} />
          </span>
        ))}
        <span className="absolute inset-0 block">
          <PhotoFrame skin={skin} mediaId={piece.mediaId} x={piece.photoX ?? 50} y={piece.photoY ?? 50} />
        </span>
        {piece.morePhotos.length ? (
          <span
            className="absolute rounded-full px-2 text-[10.5px] font-bold leading-[20px] text-white"
            style={{ top: skin.photo.width + 6, right: skin.photo.width + 6, background: "rgba(14,26,36,.6)" }}
          >
            {ar(piece.morePhotos.length + 1)} صور
          </span>
        ) : null}
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
  // الخاطرةُ والسفرُ والنومُ والصحو: نصٌّ في الإطار نفسه على بطانةٍ كريميّة — لوحةٌ كالصورة.
  return <TextFrame skin={skin} piece={piece} />;
}

function TextFrame({ skin, piece }: { skin: HallSkin; piece: HallPiece }) {
  const frame = useContext(FrameImage);
  const Icon = piece.kind === "CITY" ? PlaneIcon : piece.kind === "SLEEP" ? MoonIcon : piece.kind === "WAKE" ? SunIcon : BookIcon;
  return (
    <div className="relative h-full w-full" style={{ background: frame ? skin.photo.mat : skin.photo.frame, padding: skin.photo.width, boxShadow: SHADOW }}>
      <div className="h-full w-full" style={{ background: skin.photo.mat, padding: skin.photo.matWidth }}>
        <div
          className="flex h-full w-full flex-col items-center justify-center gap-3 p-3.5 text-center"
          style={{ background: skin.plaque.bg, border: `1px solid ${skin.plaque.edge}`, color: skin.plaque.ink }}
        >
          <span style={{ color: skin.photo.frame }}>
            <Icon size={30} />
          </span>
          <p className={`font-display line-clamp-7 font-bold ${piece.line.length > 90 ? "text-[14px] leading-[22px]" : "text-[18px] leading-[28px]"}`}>{piece.line}</p>
        </div>
      </div>
      {frame ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`${BASE}/api/media/${frame}`} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full" style={{ objectFit: "fill" }} />
      ) : null}
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
