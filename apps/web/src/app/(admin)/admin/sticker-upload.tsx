"use client";

import { useRef, useState } from "react";
import { addSticker } from "@/app/actions";

/** أبعادُ الصورة من عنصر `img` لا `createImageBitmap` — يقيس كلّ صيغة (القاعدة ٨٩). */
function measure(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve({ width: 1, height: 1 });
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

/**
 * رفعُ ملصقاتٍ دفعةً إلى مجموعة (القاعدة ٢٩١): يُختار ملفٌّ أو عشرة، ويُرفع كلٌّ
 * وحده بترتيبه — وما فشل يُقال باسمه ولا يوقف ما بعده.
 */
export function StickerUpload({ packId }: { packId: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const problems: string[] = [];
    const list = [...files];
    for (const [index, file] of list.entries()) {
      setBusy(`يُرفع ${index + 1} من ${list.length}…`);
      const { width, height } = await measure(file);
      const data = new FormData();
      data.set("image", file);
      data.set("width", String(width));
      data.set("height", String(height));
      const result = await addSticker(packId, data);
      if (result?.error) problems.push(`${file.name}: ${result.error}`);
    }
    setBusy(null);
    setErrors(problems);
    if (input.current) input.current.value = "";
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label
        className="flex h-11 cursor-pointer items-center justify-center rounded-xl border border-dashed border-line bg-card text-[12.5px] font-semibold text-ink-2"
        aria-busy={busy !== null}
      >
        {busy ?? "ارفع ملصقات (PNG أو WebP أو GIF — حتى ٢ ميغا)"}
        <input
          ref={input}
          type="file"
          multiple
          accept="image/png,image/webp,image/gif"
          className="hidden"
          disabled={busy !== null}
          onChange={(event) => void upload(event.target.files)}
        />
      </label>
      {errors.map((line) => (
        <p key={line} role="alert" className="text-[12px]" style={{ color: "var(--color-live)" }}>
          {line}
        </p>
      ))}
    </div>
  );
}
