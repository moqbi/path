"use client";

import { useState } from "react";
import { setAvatar } from "@/app/actions";
import { ANIMATED, ImagePicker } from "@/components/image-picker";
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
}: {
  name: string;
  frameSpec: string | null;
  avatarMediaId: string | null;
  charm?: { spec: string; mediaId: string | null } | null;
  /** المشترك يرفع صورةً متحركة كما هي. */
  isPlus?: boolean;
  size?: number;
}) {
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="relative shrink-0">
      <Avatar name={name} size={size} frameSpec={frameSpec} mediaId={avatarMediaId} charm={charm} />

      {/* زرّ الصورة على اليمين: اليسار مقعد التميمة في كل مكان. */}
      <div className="absolute -bottom-1 -right-1">
        <ImagePicker
          label="غيّر صورتك"
          maxSize={512}
          animated={isPlus}
          onError={setError}
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

      {/*
        الشرط والخطأ تحت الصورة لا تحت الزرّ: الزرّ قرصٌ بحجم ٣٦ بكسلاً
        ملتصقٌ بحافتها، ورسالةٌ تحته لا تُرى.
      */}
      {isPlus || error ? (
        <p
          className="absolute right-1/2 top-full w-[190px] translate-x-1/2 pt-2 text-center text-[10.5px] leading-relaxed"
          style={{ color: error ? "var(--color-live)" : "var(--color-faint)" }}
          role={error ? "alert" : undefined}
        >
          {error ?? `صورة متحركة؟ ${ANIMATED.rule}`}
        </p>
      ) : null}
    </div>
  );
}
