"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BookIcon, CloseIcon, LockIcon, MoonIcon, PinIcon, PlaneIcon, SparkIcon, SunIcon } from "@/components/icons";
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
};
type Slot = { type: "rope" } | { type: "piece"; piece: HallPiece };

const WINDOW = 2;
/** دورةُ نقش الجدار والأرضيّة — والأرضيّةُ أقربُ إلى العين فتمرّ أسرع (القاعدة ٣٥٠). */
const WALL_TILE = 220;
const FLOOR_TILE = 160;
const FLOOR_SPEED = 1.45;
const EASE = "cubic-bezier(.2,.8,.2,1)";

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
  const [W, setW] = useState(210);
  const H = Math.round(W * 1.28);
  // بين لوحتين جدارٌ يُرى: ما يجعل الصفَّ معرضاً لا شريطَ صور.
  const STEP = W + 76;

  useEffect(() => {
    const fit = () => setW(Math.min(230, Math.round(Math.min(window.innerWidth, 640) * 0.58)));
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
      if (detail) return;
      if (event.key === "ArrowLeft") setIndex((at) => Math.min(slots.length - 1, at + 1));
      if (event.key === "ArrowRight") setIndex((at) => Math.max(0, at - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detail, slots.length]);

  const shift = index * STEP + dx;
  const glide = dragging ? "none" : `background-position 320ms ${EASE}, transform 320ms ${EASE}`;
  const frameTop = 100;
  const piece = current?.type === "piece" ? current.piece : null;

  return (
    <FrameImage.Provider value={images?.frame ?? null}>
      <div className="flex min-h-0 grow flex-col" style={{ background: skin.ceiling }}>
        {/* السقف وإفريزُه: خطٌّ مضيءٌ فوق خطٍّ مظلم، كما يلتقي الجصُّ بالجدار. */}
        <div style={{ height: 14 }} />
        <div style={{ height: 5, background: skin.placard.bg, opacity: 0.55 }} />
        <div style={{ height: 3, background: skin.wallShade }} />
        <div
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          className="relative min-h-[460px] grow select-none overflow-hidden"
          style={{ backgroundColor: skin.wall, touchAction: "pan-y", cursor: dragging ? "grabbing" : "grab" }}
        >
          {/* الجدار: نقشٌ مرفوع يتكرّر، وبلاه ورقُ جدارٍ بخطوطٍ خافتة — يمرّ مع اللوحات بسرعتها. */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: images?.wall
                ? `url(${BASE}/api/media/${images.wall})`
                : `repeating-linear-gradient(90deg, transparent 0 54px, ${skin.wallShade} 54px 55px, transparent 55px 61px, ${skin.wallShade} 61px 62px)`,
              backgroundSize: images?.wall ? `${WALL_TILE}px ${WALL_TILE}px` : undefined,
              backgroundPositionX: `${shift}px`,
              opacity: images?.wall ? 1 : 0.5,
              transition: glide,
            }}
          />
          {/* اللوحُ الخشبيّ: إفريزٌ ثمّ ألواحٌ محفورة. */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0"
            style={{
              height: "20%",
              backgroundColor: skin.wallShade,
              borderTop: `3px solid color-mix(in srgb, ${skin.placard.bg} 50%, transparent)`,
              boxShadow: "inset 0 4px 0 rgba(0,0,0,.12)",
              backgroundImage: `linear-gradient(90deg, transparent 10px, rgba(0,0,0,.16) 10px 11.5px, transparent 11.5px ${WALL_TILE / 2 - 11.5}px, rgba(255,255,255,.2) ${WALL_TILE / 2 - 11.5}px ${WALL_TILE / 2 - 10}px, transparent ${WALL_TILE / 2 - 10}px)`,
              backgroundSize: `${WALL_TILE / 2}px 100%`,
              backgroundPositionX: `${shift}px`,
              transition: glide,
            }}
          />
          {/* الضوءُ والعمق: يسقط من السقف ويبهت، والحافّتان أعتم كما في قاعةٍ حقيقيّة. */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(0,0,0,.22), transparent 18%, transparent 70%, rgba(0,0,0,.2)), radial-gradient(ellipse 62% 70% at 50% 42%, transparent 55%, rgba(0,0,0,.38))",
            }}
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0" style={{ height: 10, background: skin.floorEdge }} />

          <div className="absolute inset-x-0 top-4 flex flex-col items-center gap-0.5">
            {wallMonth !== null ? (
              <>
                <p className="font-display text-[19px] font-extrabold tracking-wide" style={{ color: skin.sign.ink }}>
                  جدار {MONTHS[wallMonth]}
                </p>
                <span className="block h-0.5 w-[34px] rounded-full" style={{ background: skin.accent.bg }} />
                <p className="mt-0.5 text-[10.5px]" style={{ color: skin.sign.muted }}>
                  {ar(months.find((row) => row.month === wallMonth)?.count ?? 0)} لحظة
                </p>
              </>
            ) : null}
          </div>

          <div className="absolute inset-x-0" style={{ top: frameTop - 30, height: H + 60 }}>
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
                <div
                  key={slot.type === "rope" ? "rope" : slot.piece.id}
                  className="absolute top-0"
                  style={{ width: W, height: H + 60, left: `calc(50% - ${W / 2}px)`, transform: `translateX(${offset}px)`, transition: dragging ? "none" : `transform 320ms ${EASE}` }}
                >
                  {/* مصباحُ اللوحة: ذراعٌ نحاسيّ وقضيبُه، وضوءٌ ينسكب على الإطار. */}
                  <span className="absolute top-0 flex flex-col items-center" style={{ left: W * 0.27, width: W * 0.46 }}>
                    <span className="block h-3 w-[3px]" style={{ background: skin.brass.edge }} />
                    <span className="block h-[7px] w-full rounded" style={{ background: skin.brass.bg, borderBottom: `2px solid ${skin.brass.edge}` }} />
                  </span>
                  <span
                    className="pointer-events-none absolute"
                    style={{
                      top: 19,
                      left: -W * 0.2,
                      width: W * 1.4,
                      height: H * 0.9,
                      clipPath: "polygon(38.5% 0, 61.5% 0, 100% 100%, 0 100%)",
                      background: `linear-gradient(180deg, ${skin.light}, transparent)`,
                      opacity: (1 - near * 0.65) * 0.75,
                      transition: dragging ? "none" : "opacity 320ms",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (moved.current) return;
                      if (at !== index) return go(at);
                      if (slot.type === "rope") router.push("/subscribe");
                      else setDetail({ piece: slot.piece, tab: "art" });
                    }}
                    className="absolute block"
                    style={{ top: 30, left: 0, width: W, height: H }}
                  >
                    {slot.type === "rope" ? <Rope skin={skin} hidden={hidden} w={W} h={H} /> : <Piece skin={skin} piece={slot.piece} spin={at === index} />}
                  </button>
                </div>
              );
            })}
          </div>

          {/* صدى الحاليّة فوق كلّ طبقة، بجانب الإطار لا فوق الصورة. */}
          {piece?.echo?.faces.length && !detail ? <EchoRise key={piece.id} echo={piece.echo} w={W} top={frameTop + H * 0.85} rise={H * 0.9} /> : null}

          <div className="absolute inset-x-6 flex justify-center" style={{ top: frameTop + H + 20 }}>
            {piece ? <Placard skin={skin} piece={piece} onEcho={() => setDetail({ piece, tab: "echo" })} /> : null}
          </div>
        </div>

        {/* الأرضيّة: نقشُها يمرّ أسرع من الجدار، وشريطُ الشهور يقفز إلى أوّل لوحةٍ في كلّ شهر. */}
        <div
          className="relative pb-6 pt-3.5"
          style={{
            backgroundColor: skin.floor,
            backgroundImage: images?.floor
              ? `linear-gradient(180deg, rgba(0,0,0,.4), transparent 34px), url(${BASE}/api/media/${images.floor})`
              : `linear-gradient(180deg, rgba(0,0,0,.4), transparent 34px), repeating-linear-gradient(90deg, transparent 0 ${FLOOR_TILE / 2 - 1}px, ${skin.floorEdge} ${FLOOR_TILE / 2 - 1}px ${FLOOR_TILE / 2}px), repeating-linear-gradient(180deg, transparent 0 25px, ${skin.floorEdge} 25px 26px)`,
            backgroundSize: images?.floor ? `100% 34px, ${FLOOR_TILE}px ${FLOOR_TILE}px` : undefined,
            backgroundPositionX: `0, ${shift * FLOOR_SPEED}px${images?.floor ? "" : ", 0"}`,
            transition: glide,
          }}
        >
          <div className="flex gap-2 overflow-x-auto px-4" style={{ scrollbarWidth: "none" }}>
            {months.map((row) => {
              const on = row.month === wallMonth;
              return (
                <button
                  key={row.month}
                  type="button"
                  onClick={() => go(row.first)}
                  className="h-8 shrink-0 rounded-full px-3.5 text-[12.5px] font-bold"
                  style={{ background: on ? skin.accent.bg : "rgba(14,20,26,.38)", color: on ? skin.accent.ink : "#FBF8F1" }}
                >
                  {MONTHS[row.month]}
                </button>
              );
            })}
          </div>
          {slots.length > 1 ? (
            <p className="mt-2.5 text-center text-[11.5px]" style={{ color: "rgba(251,248,241,.85)" }}>
              {ar(index + 1)} / {ar(slots.length)} · اسحب لتمشي
            </p>
          ) : null}
        </div>

        {detail ? <HallSheet skin={skin} piece={detail.piece} tab={detail.tab} onClose={() => setDetail(null)} /> : null}
      </div>
    </FrameImage.Provider>
  );
}

/** بطاقةُ الشرح تحت اللوحة، كبطاقة متحف: التاريخُ، ثمّ ما لا تقوله اللوحةُ وحدها مرّةً واحدة، ثمّ صداها. */
function Placard({ skin, piece, onEcho }: { skin: HallSkin; piece: HallPiece; onEcho?: () => void }) {
  const line = piece.kind === "PHOTO" ? piece.text : piece.kind === "MUSIC" ? piece.line : null;
  const echo = piece.echo;
  return (
    <div
      className="flex max-w-[280px] flex-col items-center gap-1 rounded-[3px] px-3.5 py-2 text-center"
      style={{ background: skin.placard.bg, boxShadow: "1px 3px 6px rgba(0,0,0,.22)" }}
    >
      <p className="text-[10.5px] font-bold" style={{ color: skin.placard.muted }}>
        {piece.when}
      </p>
      {line ? (
        <p className="line-clamp-2 text-[12.5px] leading-[19px]" style={{ color: skin.placard.ink }}>
          {line}
        </p>
      ) : null}
      {echo && (echo.reactions || echo.comments) ? (
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onEcho?.();
          }}
          className="mt-0.5 flex items-center gap-2"
        >
          <span className="flex">
            {echo.faces.slice(0, 3).map((face, at) => (
              <span key={at} className="rounded-full" style={{ marginInlineStart: at ? -7 : 0, boxShadow: `0 0 0 1.5px ${skin.placard.bg}` }}>
                <ReactionGlyph kind={face.kind} emoji={face.emoji} size={20} />
              </span>
            ))}
          </span>
          {echo.reactions ? (
            <span className="text-[11.5px] font-extrabold" style={{ color: skin.placard.ink }}>
              {ar(echo.reactions)}
            </span>
          ) : null}
          {echo.comments ? (
            <span className="text-[11.5px] font-bold" style={{ color: skin.placard.muted }}>
              {ar(echo.comments)} تعليق
            </span>
          ) : null}
        </button>
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

const SHADOW = "4px 12px 22px rgba(0,0,0,.34)";

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
