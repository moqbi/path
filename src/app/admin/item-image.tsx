"use client";

import { clearItemImage, setItemImage } from "@/app/actions";
import { ImagePicker } from "@/components/image-picker";
import { CameraIcon, CloseIcon } from "@/components/icons";
import { itemPaint } from "@/components/ui";

/**
 * صورة الصنف في اللوحة.
 *
 * الثيم خلفيةُ التطبيق كلّه فيُرفع كبيراً (١٦٠٠ بكسل)، والتميمة شعارٌ
 * صغير يكفيه ٢٥٦ — لا نُثقل القاعدة بصورةٍ تُعرض بحجم ظفر.
 */
export function ItemImage({
  itemId,
  mediaId,
  kind,
}: {
  itemId: string;
  mediaId: string | null;
  kind: string;
}) {
  const charm = kind === "CHARM";

  return (
    <div className="flex items-center gap-2.5">
      <span
        className="h-12 w-12 shrink-0 rounded-xl"
        style={itemPaint({ spec: "var(--color-chip)", mediaId })}
      />

      <ImagePicker
        label={charm ? "صورة التميمة" : "صورة الثيم"}
        maxSize={charm ? 256 : 1600}
        onPicked={(dataUrl, width, height) => setItemImage(itemId, dataUrl, width, height)}
        className="grow"
      >
        <span
          className="flex items-center justify-center gap-2 rounded-xl border border-line bg-card text-[12.5px] font-semibold text-ink-2"
          style={{ height: 46 }}
        >
          <CameraIcon size={15} />
          {mediaId ? "غيّر الصورة" : charm ? "ارفع صورة التميمة" : "ارفع صورة الثيم"}
        </span>
      </ImagePicker>

      {mediaId ? (
        <form action={clearItemImage.bind(null, itemId)}>
          <button
            type="submit"
            aria-label="أزل الصورة"
            className="flex w-11 items-center justify-center rounded-xl border border-line"
            style={{ height: 46, color: "var(--color-live)" }}
          >
            <CloseIcon size={16} />
          </button>
        </form>
      ) : null}
    </div>
  );
}
