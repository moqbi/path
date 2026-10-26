"use client";

import { clearHallImage, clearItemCover, clearItemPromo, setHallImage, setItemCover, setItemPromo } from "@/app/actions";
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
 * وللثيم وحده: الإطار والتشارم لا خلفية لهما تُلبَس.
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

/**
 * صورةُ بطاقة الإعلان (القاعدة ٢٧٢) — **بقرار المالك**: صورةُ الثيم خلفيةٌ بطول الشاشة
 * لا تُقرأ في بطاقةٍ صغيرة، فللإعلان صورتُه. وبلاها تُرسم صورةُ الصنف كما كانت.
 */
export function ItemPromo({
  itemId,
  mediaId,
  bundle = false,
}: {
  itemId: string;
  mediaId: string | null;
  /** للحزمة: الصورةُ في بطاقتها بالمتجر أيضاً، لا في بطاقة الإعلان وحدها. */
  bundle?: boolean;
}) {
  return (
    <div className="mt-3 border-t border-line pt-3">
      <p className="mb-2 text-[12px] font-semibold text-muted">صورة بطاقة الإعلان</p>
      <div className="flex items-center gap-2.5">
        <span className="h-16 w-16 shrink-0 rounded-xl" style={itemPaint({ spec: "var(--color-chip)", mediaId })} />
        <ImagePicker
          label="صورة الإعلان"
          maxSize={1400}
          accept="image/jpeg,image/png,image/webp"
          onPicked={(file, width, height) => {
            const data = new FormData();
            data.set("image", file);
            data.set("width", String(width));
            data.set("height", String(height));
            return setItemPromo(itemId, data);
          }}
          className="grow"
        >
          <span
            className="flex items-center justify-center gap-2 rounded-xl border border-line bg-card text-[12.5px] font-semibold text-ink-2"
            style={{ height: 46 }}
          >
            <CameraIcon size={15} />
            {mediaId ? "غيّر صورة الإعلان" : "ارفع صورة للإعلان"}
          </span>
        </ImagePicker>
        {mediaId ? (
          <form action={clearItemPromo.bind(null, itemId)}>
            <button
              type="submit"
              aria-label="أزل صورة الإعلان"
              className="flex w-11 items-center justify-center rounded-xl border border-line"
              style={{ height: 46, color: "var(--color-live)" }}
            >
              <CloseIcon size={16} />
            </button>
          </form>
        ) : null}
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
        {bundle
          ? "تظهر في بطاقة الحزمة بالمتجر بدل رسوم ما فيها، وفي بطاقة الإعلان عند فتح التطبيق — عريضةٌ أوضح في المتجر. وتفعيلُ البطاقة من «بطاقة إعلان» تحت."
          : "تظهر في بطاقة الإعلان عند فتح التطبيق بدل صورة الثيم — مربّعة أو قريبةٌ منها أوضح. وتفعيلُ البطاقة من «بطاقة إعلان» تحت."}
      </p>
    </div>
  );
}

const HALL_SLOTS = [
  {
    slot: "wall",
    label: "نقش الجدار",
    hint: "يتكرّر على الجدار كلّه: ورقُ جدار، طوب، رخام، خشب. مربّعٌ يتّصل طرفاه أوضح.",
    size: 900,
  },
  {
    slot: "floor",
    label: "نقش الأرضيّة",
    hint: "يتكرّر على الأرضيّة تحت الجدار: باركيه، رخام، سجّاد.",
    size: 900,
  },
  {
    slot: "frame",
    label: "إطار الصورة",
    hint: "PNG وسطُه شفّاف، طوليٌّ بنسبة ١ : ١٫٢٨ — يُمدّ فوق كلّ صورة، والصورةُ تحته بحشوة «عرض الإطار» ثمّ «عرض البطانة».",
    size: 1200,
    // الشفافيّةُ تُحفظ: JPEG يملأ الوسطَ أسودَ فيغطّي اللحظة (القاعدة ٣٦٢).
    alpha: true,
  },
] as const;

/**
 * صورُ قاعة المعرض (القاعدة ٣٥٠) — **بقرار المالك**: الألوانُ وحدها تُرسم قاعةً مسطّحة،
 * فللثوب نقشُ جدارٍ ونقشُ أرضيّةٍ وإطارٌ مرسوم. وكلٌّ منها اختياريّ: بلاه لونُه.
 */
export function HallImages({
  itemId,
  wall,
  floor,
  frame,
}: {
  itemId: string;
  wall: string | null;
  floor: string | null;
  frame: string | null;
}) {
  const now = { wall, floor, frame };
  return (
    <div className="mt-3 border-t border-line pt-3">
      <p className="mb-2 text-[12px] font-semibold text-muted">صور القاعة</p>
      <div className="grid gap-3">
        {HALL_SLOTS.map(({ slot, label, hint, size, ...rest }) => {
          const mediaId = now[slot];
          return (
            <div key={slot}>
              <div className="flex items-center gap-2.5">
                <span className="h-14 w-14 shrink-0 rounded-xl" style={itemPaint({ spec: "var(--color-chip)", mediaId })} />
                <ImagePicker
                  label={label}
                  maxSize={size}
                  keepAlpha={"alpha" in rest}
                  accept="image/jpeg,image/png,image/webp"
                  onPicked={(file, width, height) => {
                    const data = new FormData();
                    data.set("image", file);
                    data.set("width", String(width));
                    data.set("height", String(height));
                    return setHallImage(itemId, slot, data);
                  }}
                  className="grow"
                >
                  <span
                    className="flex items-center justify-center gap-2 rounded-xl border border-line bg-card text-[12.5px] font-semibold text-ink-2"
                    style={{ height: 46 }}
                  >
                    <CameraIcon size={15} />
                    {mediaId ? `غيّر ${label}` : `ارفع ${label}`}
                  </span>
                </ImagePicker>
                {mediaId ? (
                  <form action={clearHallImage.bind(null, itemId, slot)}>
                    <button
                      type="submit"
                      aria-label={`أزل ${label}`}
                      className="flex w-11 items-center justify-center rounded-xl border border-line"
                      style={{ height: 46, color: "var(--color-live)" }}
                    >
                      <CloseIcon size={16} />
                    </button>
                  </form>
                ) : null}
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-muted">{hint}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
