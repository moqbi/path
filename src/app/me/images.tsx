"use client";

import { clearCover, setAvatar, setCover } from "@/app/actions";
import { ImagePicker } from "@/components/image-picker";
import { Avatar } from "@/components/ui";
import { CameraIcon, CloseIcon } from "@/components/icons";

/**
 * تغيير صورة العرض والغلاف.
 * زر الصورة يجلس على حافة الصورة نفسها لأن ذلك أوضح مكان يتوقعه المستخدم،
 * وزر الغلاف يطفو على الغلاف فوقها.
 */
export function ProfileImages({
  name,
  frameSpec,
  avatarMediaId,
  hasCover,
}: {
  name: string;
  frameSpec: string | null;
  avatarMediaId: string | null;
  hasCover: boolean;
}) {
  return (
    <div className="relative">
      <Avatar name={name} size={92} frameSpec={frameSpec} mediaId={avatarMediaId} />

      <div className="absolute -bottom-1 -left-1">
        <ImagePicker
          label="غيّر صورتك"
          maxSize={512}
          onPicked={(dataUrl, width, height) => setAvatar(dataUrl, width, height)}
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

      <div className="absolute -top-[104px] left-0 flex gap-2">
        <ImagePicker
          label="غيّر الغلاف"
          maxSize={1600}
          onPicked={(dataUrl, width, height) => setCover(dataUrl, width, height)}
          className="flex items-center gap-1.5 rounded-full px-3 py-2 text-[11px] font-semibold"
        >
          <span
            className="flex items-center gap-1.5 rounded-full px-3 py-2 text-[11px] font-semibold"
            style={{ background: "rgba(14,26,36,.55)", color: "#f7f5ef" }}
          >
            <CameraIcon size={14} />
            الغلاف
          </span>
        </ImagePicker>

        {hasCover ? (
          <form action={clearCover}>
            <button
              type="submit"
              aria-label="أزل الغلاف"
              className="flex h-9 w-9 items-center justify-center rounded-full"
              style={{ background: "rgba(14,26,36,.55)", color: "#f7f5ef" }}
            >
              <CloseIcon size={15} />
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
