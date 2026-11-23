"use client";

import { clearMoodImage, setMoodImage } from "@/app/actions";
import { ImagePicker } from "@/components/image-picker";
import { CameraIcon, CloseIcon } from "@/components/icons";

/** صورةُ المود (القاعدة ٤٨٤): حتى ١٢٠٠ — خلفيّةٌ تملأ البطاقة ولا شفافيّةَ فيها. */
export function MoodImage({ id, hasImage }: { id: string; hasImage: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <ImagePicker
        label="صورة المود"
        maxSize={1200}
        accept="image/jpeg,image/png,image/webp"
        onPicked={async (file, width, height) => {
          const data = new FormData();
          data.set("image", file);
          data.set("width", String(width));
          data.set("height", String(height));
          return setMoodImage(id, data);
        }}
        className="grow"
      >
        <span
          className="flex items-center justify-center gap-2 rounded-xl border border-line bg-card text-[12.5px] font-semibold text-ink-2"
          style={{ height: 42 }}
        >
          <CameraIcon size={15} />
          {hasImage ? "غيّر الصورة" : "ارفع صورة المود"}
        </span>
      </ImagePicker>
      {hasImage ? (
        <form action={clearMoodImage.bind(null, id)}>
          <button
            type="submit"
            aria-label="أزل الصورة"
            className="flex w-11 items-center justify-center rounded-xl border border-line"
            style={{ height: 42, color: "var(--color-live)" }}
          >
            <CloseIcon size={16} />
          </button>
        </form>
      ) : null}
    </div>
  );
}
