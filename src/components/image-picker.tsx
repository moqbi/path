"use client";

import { useRef, useState, useTransition } from "react";
import { CameraIcon } from "@/components/icons";

/**
 * يصغّر الصورة في المتصفح قبل رفعها.
 *
 * الرفع الخام لصورة هاتف حديث يعني عدة ميغابايتات لكل لحظة؛ التصغير إلى
 * ١٦٠٠ بكسل بجودة ٠٫٨ يبقيها واضحة على الشاشة ويهبط بالحجم إلى مئات
 * الكيلوبايتات، وهو الفرق بين قاعدة تتحمّل وقاعدة تنفجر.
 */
async function shrink(file: File, max: number): Promise<{ dataUrl: string; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("تعذّر تجهيز الصورة");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return { dataUrl: canvas.toDataURL("image/jpeg", 0.82), width, height };
}

export function ImagePicker({
  onPicked,
  maxSize = 1600,
  label,
  className,
  children,
}: {
  onPicked: (dataUrl: string, width: number, height: number) => void | Promise<void>;
  maxSize?: number;
  label: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;

          setError(null);
          try {
            const image = await shrink(file, maxSize);
            start(() => void onPicked(image.dataUrl, image.width, image.height));
          } catch {
            setError("تعذّر قراءة الصورة. جرّب صورة ثانية.");
          }
        }}
      />
      <button
        type="button"
        aria-label={label}
        disabled={pending}
        onClick={() => input.current?.click()}
        className={className ?? "flex items-center gap-2 rounded-xl border border-line bg-card px-4 text-[13.5px] font-medium disabled:opacity-60"}
        style={className ? undefined : { height: 46 }}
      >
        {children ?? (
          <>
            <CameraIcon size={18} />
            {pending ? "نرفع…" : label}
          </>
        )}
      </button>
      {error ? (
        <p role="alert" className="mt-2 text-[12px]" style={{ color: "var(--color-live)" }}>
          {error}
        </p>
      ) : null}
    </>
  );
}
