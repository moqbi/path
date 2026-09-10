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
}: {
  name: string;
  frameSpec: string | null;
  avatarMediaId: string | null;
  charm?: { spec: string; mediaId: string | null } | null;
}) {
  return (
    <div className="relative">
      <Avatar name={name} size={84} frameSpec={frameSpec} mediaId={avatarMediaId} charm={charm} />

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

    </div>
  );
}
