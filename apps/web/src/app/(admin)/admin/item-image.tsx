"use client";

import { clearItemImage, setItemImage } from "@/app/actions";
import { ImagePicker } from "@/components/image-picker";
import { CameraIcon, CloseIcon } from "@/components/icons";
import { itemPaint } from "@/components/ui";

/**
 * صورة الصنف في اللوحة.
 *
 * الثيم خلفيةُ التطبيق كلّه فيُرفع كبيراً (١٦٠٠ بكسل)، والتميمة شعارٌ
 * صغير يكفيه ٣٢٠ — لا نُثقل القاعدة بصورةٍ تُعرض بحجم ظفر. وتُحفظ
 * التميمة PNG بشفافيتها: ضغطها JPEG يُلبسها مربّعاً أسود.
 */
export function ItemImage({
  itemId,
  mediaId,
  kind,
  mime,
}: {
  itemId: string;
  mediaId: string | null;
  kind: string;
  /** صيغة المحفوظ: تميمةٌ بغير PNG فقدت شفافيتها ويجب رفعها ثانيةً. */
  mime?: string | null;
}) {
  const charm = kind === "CHARM";
  const flattened = charm && Boolean(mediaId) && mime !== "image/png";

  return (
    <>
    {flattened ? (
      <p
        role="alert"
        className="mb-2 rounded-xl px-3 py-2 text-[11.5px] leading-relaxed"
        style={{ background: "var(--color-clay-soft)", color: "var(--color-clay)" }}
      >
        هذه التميمة محفوظة بلا شفافية (خلفيةٌ سوداء خلف الشعار) — أعِد رفعها
        الآن فتُحفظ PNG كما رُسمت.
      </p>
    ) : null}

    <div className="flex items-center gap-2.5">
      <span
        className="h-12 w-12 shrink-0 rounded-xl"
        style={itemPaint({ spec: "var(--color-chip)", mediaId }, charm ? "contain" : "cover")}
      />

      <ImagePicker
        label={charm ? "صورة التميمة" : "صورة الثيم"}
        maxSize={charm ? 320 : 1600}
        keepAlpha={charm}
        accept={charm ? "image/png,image/webp" : "image/jpeg,image/png,image/webp"}
        onPicked={(file, width, height) => {
            const data = new FormData();
            data.set("image", file);
            data.set("width", String(width));
            data.set("height", String(height));
            return setItemImage(itemId, data);
          }}
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
    </>
  );
}
