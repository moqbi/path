"use client";

import { setAvatar } from "@/app/actions";
import { ImagePicker } from "@/components/image-picker";
import { Avatar } from "@/components/ui";
import { CameraIcon } from "@/components/icons";

/**
 * تغيير صورة العرض. زرها على حافتها لأن ذلك أوضح مكان يتوقعه المستخدم.
 * أما زر الغلاف فداخل الغلاف نفسه (`CoverPicker`): كان هنا بإزاحة سالبة
 * فوق `main`، ومنطقة التمرير تقصّ ما خرج عنها، فاختفى الزر تماماً.
 */
export function ProfileImages({
  name,
  frameSpec,
  avatarMediaId,
  charm,
  isPlus = false,
  size = 84,
  onError,
}: {
  name: string;
  frameSpec: string | null;
  avatarMediaId: string | null;
  charm?: { spec: string; mediaId: string | null } | null;
  /** المشترك يرفع صورةً متحركة كما هي. */
  isPlus?: boolean;
  size?: number;
  /*
    الخطأ يُرفع إلى من يعرف أين يضعه.

    كان يُرسم تحت الصورة بعرض ١٩٠ بكسلاً مرفوعاً من السياق، فيركب على
    عنوان أوّل حقلٍ في النموذج. ومكانه الطبيعي عمود الوصف بجانب الصورة.
  */
  onError?: (message: string | null) => void;
}) {
  return (
    <div className="relative shrink-0">
      <Avatar name={name} size={size} frameSpec={frameSpec} mediaId={avatarMediaId} charm={charm} />

      {/* زرّ الصورة على اليمين: اليسار مقعد التميمة في كل مكان. */}
      <div className="absolute -bottom-1 -right-1">
        <ImagePicker
          label="غيّر صورتك"
          maxSize={512}
          animated={isPlus}
          onError={(message) => onError?.(message)}
          onPicked={(file, width, height) => {
            const data = new FormData();
            data.set("image", file);
            data.set("width", String(width));
            data.set("height", String(height));
            return setAvatar(data);
          }}
          className="flex h-9 w-9 items-center justify-center rounded-full border-2 shadow-sm"
        >
          <span
            className="flex h-full w-full items-center justify-center rounded-full"
            style={{ background: "var(--color-clay)", color: "var(--color-on-brand)" }}
          >
            <CameraIcon size={16} />
          </span>
        </ImagePicker>
      </div>


    </div>
  );
}
