"use client";

import { useRef, useState } from "react";
import { PHOTO_RATIO } from "@/lib/photo";

type Pos = { x: number; y: number };

/**
 * محرّرُ موضع صورة اللحظة قبل نشرها — **بقرار المالك**، نسخةُ
 * `PhotoFrameEditor` في الجوّال: إطارٌ بنسبة البطاقة نفسها (`PHOTO_RATIO`)،
 * والصورةُ تملؤه وتُسحب يميناً ويساراً وأعلى وأسفل. الموضعُ نسبةٌ (٠–١٠٠)
 * تُكتب في `object-position` عند العرض، فما يُضبط هنا هو ما يُرى في الخطّ.
 */
export function PhotoFrameEditor({
  url,
  width,
  height,
  value,
  onChange,
}: {
  url: string;
  width: number;
  height: number;
  value: Pos;
  onChange: (next: Pos) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const start = useRef<{ px: number; py: number; pos: Pos; room: Pos } | null>(null);
  const [dragging, setDragging] = useState(false);

  /** ما يزيد من الصورة المكبَّرة عن إطارها — هو مدى السحب في كل اتّجاه. */
  function room(): Pos {
    const frame = box.current?.getBoundingClientRect();
    if (!frame || !width || !height) return { x: 0, y: 0 };
    const scale = Math.max(frame.width / width, frame.height / height);
    return { x: width * scale - frame.width, y: height * scale - frame.height };
  }

  const movable = (() => {
    if (!width || !height) return false;
    return Math.abs(width / height - PHOTO_RATIO) > 0.01;
  })();

  return (
    <div>
      <div
        ref={box}
        onPointerDown={(event) => {
          start.current = { px: event.clientX, py: event.clientY, pos: value, room: room() };
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragging(true);
        }}
        onPointerMove={(event) => {
          const from = start.current;
          if (!from) return;
          // الإصبعُ يجرّ الصورة: سحبُها يساراً يُظهر ما على يمينها.
          const x = from.room.x > 0 ? from.pos.x - ((event.clientX - from.px) / from.room.x) * 100 : 50;
          const y = from.room.y > 0 ? from.pos.y - ((event.clientY - from.py) / from.room.y) * 100 : 50;
          onChange({
            x: Math.round(Math.max(0, Math.min(100, x))),
            y: Math.round(Math.max(0, Math.min(100, y))),
          });
        }}
        onPointerUp={() => {
          start.current = null;
          setDragging(false);
        }}
        onPointerCancel={() => {
          start.current = null;
          setDragging(false);
        }}
        data-photo-frame
        className="overflow-hidden rounded-2xl border"
        style={{
          aspectRatio: PHOTO_RATIO,
          touchAction: "none",
          cursor: movable ? (dragging ? "grabbing" : "grab") : "default",
          borderColor: dragging ? "var(--color-clay)" : "var(--color-line)",
          userSelect: "none",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt=""
          draggable={false}
          className="pointer-events-none block h-full w-full"
          style={{ objectFit: "cover", objectPosition: `${value.x}% ${value.y}%` }}
        />
      </div>
      {movable ? (
        <p className="mt-1.5 text-center text-[11px] text-faint">اسحب الصورة لتضبط ما يظهر منها في البطاقة</p>
      ) : null}
    </div>
  );
}
