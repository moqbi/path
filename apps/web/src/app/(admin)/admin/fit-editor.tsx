"use client";

import { useRef, useState, useTransition } from "react";
import { FIT_LIMITS, parseFit, type Fit } from "@athar/shared";
import { setItemFit, setItemImage } from "@/app/actions";
import { Avatar } from "@/components/ui";

/**
 * ضبطُ الإطار والتشارم على صورة العرض في اللوحة (القاعدة ٤٧٥) — **بقرار المالك**.
 *
 * المعاينةُ صورةُ المشرف نفسه لا وجهٌ مرسوم، و`Avatar` نفسُه الذي يرسم الصورةَ في الويب:
 * ما يُرى هنا ما يُرى في التطبيق. السحبُ يُزيح الرسمَ، والشريطُ يكبّره ويصغّره، و«احفظ»
 * يكتب «x,y,s». والجوّالُ يقرأ الرقمَ نفسه (`parseFit` في `packages/shared`).
 */
const PREVIEW = 176;

export function FitEditor({
  itemId,
  kind,
  item,
  me,
}: {
  itemId: string;
  kind: "FRAME" | "CHARM";
  item: { spec: string; mediaId: string | null; frameHole: number | null; fit: string | null };
  me: { name: string; avatarMediaId: string | null };
}) {
  const saved = parseFit(item.fit);
  const [fit, setFit] = useState<Fit>(saved);
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const drag = useRef<{ x: number; y: number; fit: Fit } | null>(null);
  const frame = kind === "FRAME";
  const value = `${Math.round(fit.x)},${Math.round(fit.y)},${Math.round(fit.s)}`;
  const worn = { spec: item.spec, mediaId: item.mediaId, frameHole: item.frameHole, fit: value };

  /*
    كم بكسلاً يساوي واحدٌ في المئة: الإطارُ يُزاح نسبةً من رسمه (`translate` بالنسبة)،
    والتشارمُ نسبةً من مقاسها الأصليّ — نصفُ القطر.
  */
  const zoom = frame && item.frameHole && item.frameHole >= 20 && item.frameHole <= 99 ? (100 / item.frameHole) * 0.95 : 1;
  const unit = frame ? (PREVIEW * zoom * (fit.s / 100)) / 100 : (PREVIEW * 0.5) / 100;
  const clamp = (v: number) => Math.max(-FIT_LIMITS.offset, Math.min(FIT_LIMITS.offset, v));

  return (
    <div className="mt-3 rounded-2xl border border-line bg-card p-3">
      <p className="text-[12px] font-bold">{frame ? "ضبط الإطار على الصورة" : "ضبط التشارم على الصورة"}</p>
      <p className="mb-3 text-[11px] leading-relaxed text-faint">
        اسحب الرسم يميناً ويساراً وأعلى وأسفل، وكبّره أو صغّره بالشريط حتى يجلس على الوجه — المعاينةُ
        صورتُك كما تُرسم في التطبيق.
      </p>

      <div
        className="relative mx-auto flex touch-none select-none items-center justify-center rounded-2xl"
        style={{ width: PREVIEW * 1.9, height: PREVIEW * 1.6, background: "var(--color-ground)", cursor: "grab" }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { x: event.clientX, y: event.clientY, fit };
        }}
        onPointerMove={(event) => {
          const from = drag.current;
          if (!from) return;
          setFit({
            ...from.fit,
            x: clamp(from.fit.x + (event.clientX - from.x) / unit),
            y: clamp(from.fit.y + (event.clientY - from.y) / unit),
          });
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      >
        <Avatar
          name={me.name}
          size={PREVIEW}
          mediaId={me.avatarMediaId}
          frame={frame ? worn : null}
          charm={frame ? null : worn}
        />
      </div>

      <label className="mt-3 block text-[11.5px] text-muted">
        {frame ? "أوسع / أضيق" : "المقاس"} — {Math.round(fit.s)}٪
        <input
          type="range"
          min={FIT_LIMITS.minScale}
          max={FIT_LIMITS.maxScale}
          value={fit.s}
          onChange={(event) => setFit({ ...fit, s: Number(event.target.value) })}
          className="mt-1 block w-full"
        />
      </label>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const error = await setItemFit(itemId, fit);
              setNote(error ?? "تمّ الحفظ");
            })
          }
          className="h-10 rounded-xl px-4 text-[12.5px] font-bold text-white"
          style={{ background: "var(--color-clay)", opacity: pending ? 0.6 : 1 }}
        >
          احفظ الضبط
        </button>
        <button
          type="button"
          onClick={() => setFit({ x: 0, y: 0, s: 100 })}
          className="h-10 rounded-xl border border-line px-3 text-[12px] font-semibold text-muted"
        >
          أعِده إلى الأصل
        </button>
        {note ? <span className="text-[11.5px] text-muted">{note}</span> : null}
      </div>
    </div>
  );
}

/* ───────────── الإطارُ الملوّن ───────────── */

type Stop = { color: string; angle: number };

const SIDE = 512;

/** ألوانُ تدرّجٍ محفوظ: ما فيه من ألوانٍ بزواياها، أو موزّعةٌ بالتساوي. */
function stopsOf(spec: string): Stop[] {
  const colors = spec.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) ?? [];
  if (colors.length === 0) return [{ color: "#F6B93B", angle: 0 }, { color: "#FF7A5A", angle: 180 }];
  const angles = [...spec.matchAll(/(#[0-9a-fA-F]{3,6})\s+(-?\d+(?:\.\d+)?)deg/g)];
  if (angles.length === colors.length) return angles.map((m) => ({ color: m[1], angle: Number(m[2]) }));
  return colors.map((color, i) => ({ color, angle: Math.round((360 / colors.length) * i) }));
}

/** التدرّجُ نصّاً: يعود إلى لونه الأوّل عند ٣٦٠ فلا يُرى خطٌّ عند الالتقاء. */
function conicOf(stops: Stop[]): string {
  const sorted = [...stops].sort((a, b) => a.angle - b.angle);
  const parts = sorted.map((stop) => `${stop.color} ${stop.angle}deg`);
  return `conic-gradient(from 0deg, ${parts.join(", ")}, ${sorted[0].color} 360deg)`;
}

/**
 * يرسم الحلقةَ صورةً شفّافة الوسط — **فيقرؤها كلُّ جوّالٍ صورةً** لا لوناً أوّلاً من نصٍّ
 * لا يفهمه (`firstColor`)، وتُرسم في المتجر والملفّ و«مشاهدة الإطار» كما تُرى هنا.
 */
async function renderRing(stops: Stop[], thickness: number): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = SIDE;
  canvas.height = SIDE;
  const ctx = canvas.getContext("2d");
  if (!ctx || !("createConicGradient" in ctx)) throw new Error("المتصفّح لا يرسم التدرّج — جرّب كروم أو سفاري الحديث");
  const sorted = [...stops].sort((a, b) => a.angle - b.angle);
  // زاويةُ CSS تبدأ من الأعلى مع عقارب الساعة، واللوحةُ من اليمين: −٩٠°.
  const gradient = ctx.createConicGradient(-Math.PI / 2, SIDE / 2, SIDE / 2);
  for (const stop of sorted) gradient.addColorStop(Math.min(1, Math.max(0, stop.angle / 360)), stop.color);
  gradient.addColorStop(1, sorted[0].color);
  const outer = SIDE / 2 - 2;
  const inner = outer * (1 - thickness / 100);
  ctx.beginPath();
  ctx.arc(SIDE / 2, SIDE / 2, outer, 0, Math.PI * 2);
  ctx.arc(SIDE / 2, SIDE / 2, inner, 0, Math.PI * 2, true);
  ctx.fillStyle = gradient;
  ctx.fill("evenodd");
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("تعذّر الرسم"))), "image/png"),
  );
}

/** حلقةٌ رسمها هذا المحرّر: تدرّجُها محفوظ وفراغُها فراغُ سماكةٍ بين ٦ و٣٠ — لا صورةٌ مرفوعة. */
function madeRing(item: { spec: string; mediaId: string | null; frameHole: number | null }): boolean {
  if (!item.mediaId || !item.frameHole || !/^conic-gradient/.test(item.spec)) return false;
  for (let t = 6; t <= 30; t++) {
    if (Math.round(((SIDE / 2 - 2) * (1 - t / 100) * 2 * 100) / SIDE) === item.frameHole) return true;
  }
  return false;
}

/**
 * يقصّ وسطَ صورة الإطار المرفوعة دائرةً قطرُها `cut`٪ من عرضها (القاعدة ٤٩٢): الرسمُ يبقى كما هو
 * والحلقةُ تَرِقّ من الداخل، والوجهُ يكبر ليملأ الفراغ الجديد. يُقرأ الملفُّ بـ`img` لا
 * `createImageBitmap` (القاعدة ٨٩)، ويُكتب PNG بشفافيّته.
 */
async function cutImage(mediaId: string, cut: number): Promise<{ blob: Blob; width: number; height: number }> {
  const res = await fetch(`/api/media/${mediaId}`, { cache: "no-store" });
  if (!res.ok) throw new Error("تعذّر قراءة صورة الإطار");
  const url = URL.createObjectURL(await res.blob());
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("تعذّر قراءة صورة الإطار"));
      el.src = url;
    });
    const width = img.naturalWidth;
    const height = img.naturalHeight;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("تعذّر الرسم");
    ctx.drawImage(img, 0, 0);
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, ((cut / 100) * width) / 2, 0, Math.PI * 2);
    ctx.fill();
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("تعذّر الرسم"))), "image/png"),
    );
    return { blob, width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * محرّرُ الإطار الواحد (القاعدة ٤٧٦) — **بقرار المالك**: كان ضبطُ الإطار على الصورة والإطارُ الملوّن
 * بطاقتين بمعاينتين، فتغييرُ السماكة لا يُرى على الضبط ولا الضبطُ على السماكة. الآن معاينةٌ واحدة
 * تُسحب، وتحتها الألوانُ والسماكةُ والمقاس، و«احفظ» واحد: إن تغيّرت الألوانُ أو السماكة رُسمت
 * الحلقةُ صورةً (`setItemImage` يمحو الضبط) ثمّ كُتب الضبطُ فوقها (`setItemFit`).
 *
 * والحلقةُ قبل الحفظ تُرسم في المعاينة كما سيرسمها `Avatar` بعده: فراغُها من سماكتها، والرسمُ
 * مكبَّرٌ بمقلوبه (`frameZoom`)، ثمّ المقاسُ والإزاحة.
 */
export function FrameEditor({
  itemId,
  item,
  me,
}: {
  itemId: string;
  item: { spec: string; mediaId: string | null; frameHole: number | null; fit: string | null };
  me: { name: string; avatarMediaId: string | null };
}) {
  const [stops, setStops] = useState<Stop[]>(() => stopsOf(item.spec));
  // سماكةُ حلقةٍ رُسمت هنا تُقرأ من فراغها المحفوظ، فيبدأ المحرّرُ بها لا بالافتراض.
  const [thickness, setThickness] = useState(() => {
    if (!item.frameHole || !/^conic-gradient/.test(item.spec)) return 14;
    const t = Math.round((1 - (item.frameHole * SIDE) / (2 * (SIDE / 2 - 2) * 100)) * 100);
    return Math.min(30, Math.max(6, t));
  });
  // بلا صورةٍ محفوظة فالمعاينةُ حلقةٌ من البداية، والحفظُ يرسمها.
  const [ringDirty, setRingDirty] = useState(!item.mediaId);
  /*
    صورةٌ مرفوعة لا حلقةٌ رُسمت هنا (القاعدة ٤٩٢): السماكةُ فيها قصٌّ من الداخل لا حلقةٌ ملوّنة
    تحلّ محلّها — كان تحريكُ الشريط يُذهب الصورةَ ويرسم تدرّجاً مكانها. والقصُّ قطرُ الفراغ
    الجديد، يبدأ من فراغها المقيس (أو ٣٠ بلا قياس) ولا ينزل عنه: ما قُصّ لا يعود بعد الحفظ.
  */
  const image = !!item.mediaId && !madeRing(item);
  const baseHole = item.frameHole && item.frameHole >= 20 ? item.frameHole : 30;
  const [cut, setCut] = useState(baseHole);
  const cutDirty = image && !ringDirty && cut > baseHole;
  const [fit, setFit] = useState<Fit>(() => parseFit(item.fit));
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const drag = useRef<{ x: number; y: number; fit: Fit } | null>(null);

  const ringHole = Math.round(((SIDE / 2 - 2) * (1 - thickness / 100) * 2 * 100) / SIDE);
  const hole = ringDirty ? ringHole : cutDirty ? cut : item.frameHole;
  const zoom = hole && hole >= 20 && hole <= 99 ? (100 / hole) * 0.95 : 1;
  const art = PREVIEW * zoom * (fit.s / 100);
  const unit = art / 100;
  const clamp = (v: number) => Math.max(-FIT_LIMITS.offset, Math.min(FIT_LIMITS.offset, v));
  const value = `${Math.round(fit.x)},${Math.round(fit.y)},${Math.round(fit.s)}`;
  const worn = { spec: item.spec, mediaId: item.mediaId, frameHole: item.frameHole, fit: value };
  const conic = conicOf(stops);
  // الحلقةُ في اللوحة: حافّتُها الخارجيّة ٢٥٤ من ٢٥٦، والداخليّةُ بسماكتها.
  const edge = ((SIDE / 2 - 2) / (SIDE / 2)) * 100;
  const ring = `radial-gradient(farthest-side, transparent calc(${edge * (1 - thickness / 100)}% - 0.5px), #000 ${edge * (1 - thickness / 100)}%, #000 calc(${edge}% - 0.5px), transparent ${edge}%)`;
  const hollow = `radial-gradient(farthest-side, transparent calc(${cut}% - 0.5px), #000 ${cut}%)`;

  const ringEdit = (next: () => void) => {
    next();
    setRingDirty(true);
    setNote(null);
  };
  const update = (index: number, patch: Partial<Stop>) =>
    ringEdit(() => setStops(stops.map((stop, i) => (i === index ? { ...stop, ...patch } : stop))));

  const save = () =>
    start(async () => {
      try {
        if (cutDirty && item.mediaId) {
          const { blob, width, height } = await cutImage(item.mediaId, cut);
          const data = new FormData();
          data.set("image", new File([blob], "frame.png", { type: "image/png" }));
          data.set("width", String(width));
          data.set("height", String(height));
          data.set("hole", String(Math.round(cut)));
          await setItemImage(itemId, data);
        } else if (ringDirty) {
          const blob = await renderRing(stops, thickness);
          const data = new FormData();
          data.set("image", new File([blob], "frame.png", { type: "image/png" }));
          data.set("width", String(SIDE));
          data.set("height", String(SIDE));
          // الوجهُ يجلس في الفراغ الأوسط: قطرُه ÷ عرضُ اللوحة.
          data.set("hole", String(ringHole));
          data.set("spec", conic);
          await setItemImage(itemId, data);
        }
        const error = await setItemFit(itemId, fit);
        if (error) return setNote(error);
        setRingDirty(false);
        setNote(ringDirty ? "تمّ الحفظ — الإطار صورةٌ بضبطه" : cutDirty ? "تمّ الحفظ — قُصّ الإطار من الداخل" : "تمّ الحفظ");
      } catch (error) {
        setNote(error instanceof Error ? error.message : "تعذّر الحفظ");
      }
    });

  return (
    <div className="mt-3 rounded-2xl border border-line bg-card p-3">
      <p className="text-[12px] font-bold">الإطار على الصورة</p>
      <p className="mb-3 text-[11px] leading-relaxed text-faint">
        اسحب الإطار يميناً ويساراً وأعلى وأسفل، وغيّر ألوانه وسماكته ومقاسه — كلُّها على المعاينة نفسها، وهي
        صورتُك كما تُرسم في التطبيق. «احفظ» يحفظ الكلَّ معاً.
      </p>

      <div
        className="relative mx-auto flex touch-none select-none items-center justify-center overflow-hidden rounded-2xl"
        style={{ width: "100%", maxWidth: PREVIEW * 1.9, height: PREVIEW * 1.6, background: "var(--color-ground)", cursor: "grab" }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { x: event.clientX, y: event.clientY, fit };
        }}
        onPointerMove={(event) => {
          const from = drag.current;
          if (!from) return;
          setFit({
            ...from.fit,
            x: clamp(from.fit.x + (event.clientX - from.x) / unit),
            y: clamp(from.fit.y + (event.clientY - from.y) / unit),
          });
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      >
        {ringDirty || !item.mediaId ? (
          <div className="relative" style={{ width: PREVIEW, height: PREVIEW }}>
            <Avatar name={me.name} size={PREVIEW} mediaId={me.avatarMediaId} />
            <div
              className="pointer-events-none absolute rounded-full"
              style={{
                width: art,
                height: art,
                left: (PREVIEW - art) / 2,
                top: (PREVIEW - art) / 2,
                transform: `translate(${fit.x}%, ${fit.y}%)`,
                background: conic,
                WebkitMask: ring,
                mask: ring,
              }}
            />
          </div>
        ) : cutDirty ? (
          <div className="relative" style={{ width: PREVIEW, height: PREVIEW }}>
            <Avatar name={me.name} size={PREVIEW} mediaId={me.avatarMediaId} />
            <div
              className="pointer-events-none absolute"
              style={{
                width: art,
                height: art,
                left: (PREVIEW - art) / 2,
                top: (PREVIEW - art) / 2,
                transform: `translate(${fit.x}%, ${fit.y}%)`,
                backgroundImage: `url(/api/media/${item.mediaId})`,
                backgroundSize: "contain",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
                WebkitMask: hollow,
                mask: hollow,
              }}
            />
          </div>
        ) : (
          <Avatar name={me.name} size={PREVIEW} mediaId={me.avatarMediaId} frame={worn} />
        )}
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {stops.map((stop, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              type="color"
              value={stop.color.length === 4 ? `#${[...stop.color.slice(1)].map((c) => c + c).join("")}` : stop.color}
              onChange={(event) => update(index, { color: event.target.value })}
              className="h-9 w-11 shrink-0 rounded-lg border border-line"
              aria-label={`اللون ${index + 1}`}
            />
            <input
              type="range"
              min={0}
              max={359}
              value={stop.angle}
              onChange={(event) => update(index, { angle: Number(event.target.value) })}
              className="min-w-0 grow"
              aria-label={`زاوية اللون ${index + 1}`}
            />
            <span className="w-10 text-center text-[11.5px] text-muted">{stop.angle}°</span>
            {stops.length > 2 ? (
              <button
                type="button"
                onClick={() => ringEdit(() => setStops(stops.filter((_, i) => i !== index)))}
                className="h-8 w-8 rounded-lg border border-line text-[13px] text-muted"
                aria-label="احذف اللون"
              >
                ×
              </button>
            ) : null}
          </div>
        ))}
        {stops.length < 8 ? (
          <button
            type="button"
            onClick={() =>
              ringEdit(() =>
                setStops([...stops, { color: "#7A4A3E", angle: Math.min(359, (stops.at(-1)?.angle ?? 0) + 45) }]),
              )
            }
            className="h-9 self-start rounded-xl border border-line px-3 text-[12px] font-semibold"
          >
            + لون
          </button>
        ) : null}
      </div>

      {image && !ringDirty ? (
        <label className="mt-3 flex items-center gap-2 text-[11.5px] text-muted">
          <span className="w-24 shrink-0">السماكة — {cut > baseHole ? `−${Math.round(cut - baseHole)}٪` : "كما رُفعت"}</span>
          <input
            type="range"
            min={baseHole}
            max={95}
            value={cut}
            onChange={(event) => {
              setCut(Number(event.target.value));
              setNote(null);
            }}
            className="min-w-0 grow"
            aria-label="سماكة الإطار — قصٌّ من الداخل"
          />
        </label>
      ) : (
      <label className="mt-3 flex items-center gap-2 text-[11.5px] text-muted">
        <span className="w-24 shrink-0">السماكة — {thickness}٪</span>
        <input
          type="range"
          min={6}
          max={30}
          value={thickness}
          onChange={(event) => ringEdit(() => setThickness(Number(event.target.value)))}
          className="min-w-0 grow"
        />
      </label>
      )}
      <label className="mt-2 flex items-center gap-2 text-[11.5px] text-muted">
        <span className="w-24 shrink-0">المقاس — {Math.round(fit.s)}٪</span>
        <input
          type="range"
          min={FIT_LIMITS.minScale}
          max={FIT_LIMITS.maxScale}
          value={fit.s}
          onChange={(event) => setFit({ ...fit, s: Number(event.target.value) })}
          className="min-w-0 grow"
        />
      </label>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={save}
          className="h-10 rounded-xl px-4 text-[12.5px] font-bold text-white"
          style={{ background: "var(--color-clay)", opacity: pending ? 0.6 : 1 }}
        >
          احفظ
        </button>
        <button
          type="button"
          onClick={() => setFit({ x: 0, y: 0, s: 100 })}
          className="h-10 rounded-xl border border-line px-3 text-[12px] font-semibold text-muted"
        >
          أعِد الموضع
        </button>
        {(ringDirty || cutDirty) && item.mediaId ? (
          <button
            type="button"
            onClick={() => {
              setRingDirty(false);
              setStops(stopsOf(item.spec));
              setCut(baseHole);
              setNote(null);
            }}
            className="h-10 rounded-xl border border-line px-3 text-[12px] font-semibold text-muted"
          >
            ارجع إلى الصورة المحفوظة
          </button>
        ) : null}
        {note ? <span className="text-[11.5px] text-muted">{note}</span> : null}
      </div>
      {ringDirty && item.mediaId ? (
        <p className="mt-2 text-[11px] text-faint">الحفظُ يستبدل صورةَ الإطار المرفوعة بهذه الحلقة.</p>
      ) : cutDirty ? (
        <p className="mt-2 text-[11px] text-faint">
          القصُّ من الداخل: الرسمُ يبقى، والحلقةُ ترِقّ، والوجهُ يكبر ليملأ فراغها. بعد الحفظ لا تعود السماكةُ أعرضَ
          ممّا هي — لأعرضَ منها ارفع الصورةَ من جديد.
        </p>
      ) : null}
    </div>
  );
}
