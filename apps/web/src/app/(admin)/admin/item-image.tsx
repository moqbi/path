"use client";

import { clearItemImage, setItemImage } from "@/app/actions";
import { ImagePicker } from "@/components/image-picker";
import { CameraIcon, CloseIcon } from "@/components/icons";
import { itemPaint } from "@/components/ui";
import { measureHole } from "@/lib/frame-hole";

/**
 * صورة الصنف في اللوحة.
 *
 * الثيم خلفيةُ التطبيق كلّه فيُرفع كبيراً (١٦٠٠ بكسل)، والتميمة شعارٌ
 * صغير يكفيه ٣٢٠ — لا نُثقل القاعدة بصورةٍ تُعرض بحجم ظفر. **والإطار
 * حلقةٌ حول الوجه** فيكفيه ٥١٢.
 *
 * و**ما له شفافية يُحفظ PNG**: التميمة والإطار معاً. ضغطُهما JPEG
 * يُلبسهما مربّعاً مصمتاً — وإطارٌ بمربّعٍ خلفه ليس إطاراً، وكان
 * الإطار يُرفع كالثيم فيخرج بخلفيةٍ تُغطّي الصورة.
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
  const frame = kind === "FRAME";
  // ما يُرسم فوق شيءٍ آخر يحتاج شفافيته: التميمة على الصورة، والإطار حولها.
  const alpha = charm || frame;
  const label = charm ? "التميمة" : frame ? "الإطار" : "الثيم";
  const flattened = alpha && Boolean(mediaId) && mime !== "image/png";

  return (
    <>
    {flattened ? (
      <p
        role="alert"
        className="mb-2 rounded-xl px-3 py-2 text-[11.5px] leading-relaxed"
        style={{ background: "var(--color-clay-soft)", color: "var(--color-clay)" }}
      >
        {`صورة ${label} محفوظة بلا شفافية (خلفيةٌ مصمتة خلف الرسم) — أعِد رفعها الآن فتُحفظ PNG كما رُسمت.`}
      </p>
    ) : null}

    <div className="flex items-center gap-2.5">
      <span
        className="h-12 w-12 shrink-0 rounded-xl"
        style={itemPaint({ spec: "var(--color-chip)", mediaId }, charm ? "contain" : "cover")}
      />

      <ImagePicker
        label={`صورة ${label}`}
        maxSize={charm ? 320 : frame ? 512 : 1600}
        keepAlpha={alpha}
        accept={alpha ? "image/png,image/webp" : "image/jpeg,image/png,image/webp"}
        onPicked={async (file, width, height) => {
            const data = new FormData();
            data.set("image", file);
            data.set("width", String(width));
            data.set("height", String(height));
            // الإطار يُقاس فراغُه وقت الرفع: بعدها لا نملك بكسلاته هنا.
            if (frame) {
              const hole = await measureHole(file);
              if (hole) data.set("hole", String(hole));
            }
            return setItemImage(itemId, data);
          }}
        className="grow"
      >
        <span
          className="flex items-center justify-center gap-2 rounded-xl border border-line bg-card text-[12.5px] font-semibold text-ink-2"
          style={{ height: 46 }}
        >
          <CameraIcon size={15} />
          {mediaId ? "غيّر الصورة" : `ارفع صورة ${label}`}
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
