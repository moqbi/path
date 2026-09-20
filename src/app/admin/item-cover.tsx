"use client";

import { clearItemCover, setItemCover } from "@/app/actions";
import { ImagePicker } from "@/components/image-picker";
import { CameraIcon, CloseIcon } from "@/components/icons";
import { itemPaint } from "@/components/ui";

/**
 * غلافُ الثيم: صورةٌ ثانية غير صورة الصنف.
 *
 * الثيم يملأ خلفية التطبيق كلّها، والغلاف شريطٌ عريض في رأس الشاشة —
 * صورةٌ واحدة لا تصلح للاثنين. ومن اشترى الثيم لبس غلافه معه، وله أن
 * يغيّره بعدها.
 *
 * وللثيم وحده: الإطار والتميمة لا خلفية لهما تُلبَس.
 */
export function ItemCover({ itemId, mediaId }: { itemId: string; mediaId: string | null }) {
  return (
    <div className="mt-3 border-t border-line pt-3">
      <p className="mb-2 text-[12px] font-semibold text-muted">غلاف الثيم</p>

      <div className="flex items-center gap-2.5">
        <span
          className="h-12 w-20 shrink-0 rounded-xl"
          style={itemPaint({ spec: "var(--color-chip)", mediaId })}
        />

        <ImagePicker
          label="غلاف الثيم"
          maxSize={1600}
          accept="image/jpeg,image/png,image/webp"
          onPicked={(file, width, height) => {
            const data = new FormData();
            data.set("image", file);
            data.set("width", String(width));
            data.set("height", String(height));
            return setItemCover(itemId, data);
          }}
          className="grow"
        >
          <span
            className="flex items-center justify-center gap-2 rounded-xl border border-line bg-card text-[12.5px] font-semibold text-ink-2"
            style={{ height: 46 }}
          >
            <CameraIcon size={15} />
            {mediaId ? "غيّر الغلاف" : "ارفع غلافاً مع الثيم"}
          </span>
        </ImagePicker>

        {mediaId ? (
          <form action={clearItemCover.bind(null, itemId)}>
            <button
              type="submit"
              aria-label="أزل الغلاف"
              className="flex w-11 items-center justify-center rounded-xl border border-line"
              style={{ height: 46, color: "var(--color-live)" }}
            >
              <CloseIcon size={16} />
            </button>
          </form>
        ) : null}
      </div>

      <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
        من اشترى الثيم لبس هذا الغلاف — نسخةً يملكها، فله أن يغيّرها بعدها.
        وبلا غلافٍ هنا يبقى غلافُ المشتري كما هو.
      </p>
    </div>
  );
}
