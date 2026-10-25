"use client";

import { useRef, useState } from "react";

const MAX_ZOOM = 4;

type Point = { x: number; y: number };

/**
 * الصورةُ المفتوحة تُقرَّب (القاعدة ٣٤١) — نسخةُ `PhotoViewer` في الجوّال: إصبعان يقرّبان
 * حول ما بينهما، وإصبعٌ يتنقّل في المقرَّبة، ونقرتان تقرّبان حيث نُقر أو تُعيدانها.
 * وعلى الكمبيوتر العجلةُ تقرّب حول المؤشّر. والنقرةُ الواحدة تُغلق ما دامت غيرَ مقرَّبة.
 * والإزاحةُ محدودةٌ بما زاد من الصورة عن مكانها، فلا تخرج.
 */
export function ZoomImage({
  src,
  onClose,
  onSwipe,
}: {
  src: string;
  onClose: () => void;
  /** سحبةٌ أفقيّة على غير المقرَّبة تقلّب بين صور اللحظة (القاعدة ٣٤٥): ١ التالية، −١ السابقة. */
  onSwipe?: (step: 1 | -1) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ s: 1, x: 0, y: 0 });
  const [easing, setEasing] = useState(false);
  const live = useRef(view);
  live.current = view;
  const pointers = useRef(new Map<number, Point>());
  const pinch = useRef<{ dist: number; s: number; x: number; y: number; mid: Point } | null>(null);
  const moved = useRef(false);
  const origin = useRef<Point>({ x: 0, y: 0 });
  const lastTap = useRef(0);
  const closer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const size = () => {
    const rect = box.current?.getBoundingClientRect();
    return { w: rect?.width ?? window.innerWidth, h: rect?.height ?? window.innerHeight, cx: (rect?.left ?? 0) + (rect?.width ?? 0) / 2, cy: (rect?.top ?? 0) + (rect?.height ?? 0) / 2 };
  };
  const bound = (s: number, x: number, y: number) => {
    const { w, h } = size();
    const rx = ((s - 1) * w) / 2;
    const ry = ((s - 1) * h) / 2;
    return { s, x: Math.max(-rx, Math.min(rx, x)), y: Math.max(-ry, Math.min(ry, y)) };
  };
  /** يقرّب إلى `s` والنقطةُ `at` ثابتةٌ تحت الإصبع أو المؤشّر. */
  const zoomAt = (s: number, at: Point, from = live.current) => {
    const { cx, cy } = size();
    const ratio = s / from.s;
    const x = (from.x - (at.x - cx)) * ratio + (at.x - cx);
    const y = (from.y - (at.y - cy)) * ratio + (at.y - cy);
    return s <= 1 ? { s: Math.max(s, 0.8), x: 0, y: 0 } : bound(s, x, y);
  };

  const onDown = (event: React.PointerEvent) => {
    event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    setEasing(false);
    if (pointers.current.size === 1) {
      moved.current = false;
      origin.current = { x: event.clientX, y: event.clientY };
    }
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = {
        dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
        s: live.current.s,
        x: live.current.x,
        y: live.current.y,
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      };
      moved.current = true;
    }
  };
  const onMove = (event: React.PointerEvent) => {
    const before = pointers.current.get(event.pointerId);
    if (!before) return;
    const point = { x: event.clientX, y: event.clientY };
    pointers.current.set(event.pointerId, point);
    if (pointers.current.size >= 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const start = pinch.current;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const s = Math.min(MAX_ZOOM, (start.s * Math.hypot(a.x - b.x, a.y - b.y)) / start.dist);
      const next = zoomAt(s, start.mid, { s: start.s, x: start.x, y: start.y });
      setView(next.s > 1 ? bound(next.s, next.x + mid.x - start.mid.x, next.y + mid.y - start.mid.y) : next);
      return;
    }
    if (Math.hypot(point.x - before.x, point.y - before.y) > 2) moved.current = true;
    if (live.current.s > 1) {
      setView(bound(live.current.s, live.current.x + point.x - before.x, live.current.y + point.y - before.y));
    }
  };
  const onUp = (event: React.PointerEvent) => {
    event.stopPropagation();
    const had = pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size > 0 || !had) return;
    if (live.current.s < 1.05) {
      setEasing(true);
      setView({ s: 1, x: 0, y: 0 });
    }
    if (moved.current) {
      // التاليةُ في اليسار كقراءة العربية: السحبُ يميناً يأتي بها.
      const dx = event.clientX - origin.current.x;
      const dy = event.clientY - origin.current.y;
      if (onSwipe && live.current.s <= 1.05 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) onSwipe(dx > 0 ? 1 : -1);
      return;
    }
    const time = Date.now();
    if (time - lastTap.current < 280) {
      lastTap.current = 0;
      if (closer.current) clearTimeout(closer.current);
      setEasing(true);
      setView(live.current.s > 1.05 ? { s: 1, x: 0, y: 0 } : zoomAt(2.5, { x: event.clientX, y: event.clientY }));
      return;
    }
    lastTap.current = time;
    if (closer.current) clearTimeout(closer.current);
    closer.current = setTimeout(() => {
      if (live.current.s <= 1.05) onClose();
    }, 280);
  };
  const onWheel = (event: React.WheelEvent) => {
    event.stopPropagation();
    setEasing(false);
    const s = Math.max(1, Math.min(MAX_ZOOM, live.current.s * Math.exp(-event.deltaY * 0.0025)));
    setView(zoomAt(s, { x: event.clientX, y: event.clientY }));
  };

  return (
    <div
      ref={box}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onWheel={onWheel}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      className="flex h-full w-full items-center justify-center overflow-hidden"
      style={{ touchAction: "none", cursor: view.s > 1 ? "grab" : "zoom-in" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        draggable={false}
        style={{
          maxWidth: "100%",
          maxHeight: "100%",
          objectFit: "contain",
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})`,
          transition: easing ? "transform 220ms cubic-bezier(.2,.8,.2,1)" : "none",
          userSelect: "none",
        }}
      />
    </div>
  );
}
