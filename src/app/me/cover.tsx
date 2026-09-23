"use client";

import { useRef, useState, useTransition } from "react";
import { clearCover, setCoverPosition, setCover } from "@/app/actions";
import { ImagePicker } from "@/components/image-picker";
import { CoverLayer } from "@/components/ui";
import { CameraIcon, CheckIcon, CloseIcon } from "@/components/icons";

/**
 * الغلاف وأزراره.
 *
 * وضع الضبط: الصورة تُسحب عمودياً فيتحرّك موضعها داخل الإطار، ويُحفظ
 * الموضع نسبةً مئوية. القصّ نفسه لا يمسّ الملف — الصورة تبقى كما رُفعت،
 * وما يُحفظ هو أيّ جزءٍ منها يُرى.
 *
 * وأزرار الغلاف كلّها — تغييره وضبطه وإزالته — تعيش في نافذة «تعديل
 * الملف» لا فوقه: الملف يُقرأ لا يُحرَّر، وبقاء أدوات التحرير فوقه ضجيجٌ
 * دائم لعملٍ يُفعل مرة.
 */
export function ProfileCover({
  mediaId,
  spec,
  initialY,
  x = 50,
  zoom = 100,
  height = 168,
  manage = false,
}: {
  mediaId: string | null;
  spec: string | null;
  initialY: number;
  /** ما ضبطه الجوّال أفقياً وقُرباً — يُرسم هنا ولا يُضبط (الويب يضبط الرأسيّ). */
  x?: number;
  zoom?: number;
  height?: number;
  /** أزرار الضبط والإزالة: في صفحة التعديل وحدها، لا فوق الملف. */
  manage?: boolean;
}) {
  const [y, setY] = useState(initialY);
  const [adjusting, setAdjusting] = useState(false);
  const [pending, start] = useTransition();
  const from = useRef<{ pointer: number; y: number } | null>(null);

  function down(event: React.PointerEvent<HTMLDivElement>) {
    if (!adjusting) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    from.current = { pointer: event.clientY, y };
  }
  function move(event: React.PointerEvent<HTMLDivElement>) {
    if (!adjusting || !from.current) return;
    // ١٪ لكل ٢ بكسل: السحب يُحسّ دقيقاً لا قافزاً.
    const delta = (event.clientY - from.current.pointer) / 2;
    setY(Math.min(100, Math.max(0, Math.round(from.current.y - delta))));
  }
  function up() {
    from.current = null;
  }

  const chip = "flex items-center gap-1.5 rounded-full px-3 py-2 text-[11px] font-semibold";
  const dark = { background: "rgba(14,26,36,.55)", color: "#f7f5ef" };

  return (
    <div
      className="relative shrink-0 overflow-hidden"
      style={{
        height,
        touchAction: adjusting ? "none" : undefined,
        // أثناء الضبط يعلو الغلاف فوق كتلة البيانات: هي تغطّي أسفله
        // بإزاحتها السالبة، فكان زرّ الحفظ يُرى ولا يُضغط.
        zIndex: adjusting ? 20 : undefined,
      }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      {/* أسفل الغلاف يذوب في أرضية الصفحة — لا حدَّ حادّاً بين صورتين. */}
      <CoverLayer mediaId={mediaId} spec={spec} y={y} x={x} zoom={zoom} />

      {adjusting ? (
        <>
          <div className="pointer-events-none absolute inset-0" style={{ background: "rgba(14,26,36,.25)" }} />
          <p
            className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[12.5px] font-semibold"
            style={{ color: "#fff", textShadow: "0 1px 4px rgba(0,0,0,.5)" }}
          >
            اسحب الصورة لأعلى أو لأسفل
          </p>
          {/* أسفل اليسار: الوسط تحجبه صورة العرض فلا يُضغط. */}
          <div className="absolute bottom-3 left-3 flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setAdjusting(false);
                start(() => void setCoverPosition(y));
              }}
              className={chip}
              style={{ background: "var(--color-clay)", color: "var(--color-on-brand)" }}
            >
              <CheckIcon size={14} />
              احفظ الموضع
            </button>
            <button
              type="button"
              onClick={() => {
                setY(initialY);
                setAdjusting(false);
              }}
              className={chip}
              style={dark}
            >
              إلغاء
            </button>
          </div>
        </>
      ) : (
        <>
          {manage ? (
          <div className="absolute right-4 top-4 flex gap-2">
            <ImagePicker
              label="غيّر الغلاف"
              maxSize={1600}
              onPicked={(file, width, height) => {
            const data = new FormData();
            data.set("image", file);
            data.set("width", String(width));
            data.set("height", String(height));
            return setCover(data);
          }}
              className="flex items-center rounded-full text-[11px] font-semibold"
            >
              <span className={chip} style={dark}>
                <CameraIcon size={14} />
                الغلاف
              </span>
            </ImagePicker>

            {mediaId ? (
              <>
                <button type="button" onClick={() => setAdjusting(true)} className={chip} style={dark}>
                  اضبط
                </button>
                <form action={clearCover}>
                  <button
                    type="submit"
                    aria-label="أزل الغلاف"
                    className="flex h-9 w-9 items-center justify-center rounded-full"
                    style={dark}
                  >
                    <CloseIcon size={15} />
                  </button>
                </form>
              </>
            ) : null}
          </div>
          ) : null}

        </>
      )}
    </div>
  );
}
