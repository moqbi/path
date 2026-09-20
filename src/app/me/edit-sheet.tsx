"use client";

import { useEffect, useState } from "react";
import { CloseIcon } from "@/components/icons";
import { type Frame } from "@/components/ui";
import { ANIMATED } from "@/components/image-picker";
import { ProfileCover } from "./cover";
import { ProfileImages } from "./images";
import { EditProfileForm } from "./edit/form";

/**
 * تعديل الملف في نافذةٍ فوق التبويب لا في صفحةٍ مستقلّة.
 *
 * كانت أدوات التحرير مبعثرة: أيقونةٌ على الغلاف، وأيقونةٌ على الصورة،
 * وزرٌّ يفتح صفحةً ثالثة. اجتمعت كلّها هنا — الغلاف ثم الصورة ثم
 * البيانات — فالملف يُقرأ نظيفاً، والتحرير بابٌ واحد يُفتح ويُغلق.
 */
export function EditProfileSheet({
  name,
  isPlus = false,
  handle,
  bio,
  city,
  avatarMediaId,
  frame,
  charm,
  coverMediaId,
  coverSpec,
  coverY,
}: {
  name: string;
  /** المشترك يرفع صورة عرضٍ متحركة. */
  isPlus?: boolean;
  handle: string | null;
  bio: string | null;
  city: string | null;
  avatarMediaId: string | null;
  frame: Frame;
  charm?: { spec: string; mediaId: string | null } | null;
  coverMediaId: string | null;
  coverSpec: string | null;
  coverY: number;
}) {
  const [open, setOpen] = useState(false);
  const [pictureError, setPictureError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-w-0 grow items-center justify-center truncate rounded-xl border border-line bg-card px-2 text-[13.5px] font-semibold text-ink-2"
        style={{ height: 46 }}
      >
        تعديل الملف
      </button>

      {open ? (
        <div className="fixed inset-0 z-40 flex items-end" role="dialog" aria-label="تعديل الملف">
          <button
            type="button"
            aria-label="إغلاق"
            onClick={() => setOpen(false)}
            className="absolute inset-0"
            style={{ background: "rgba(14,26,36,.55)", animation: "athr-veil 220ms ease both" }}
          />

          <div
            className="relative w-full rounded-t-3xl bg-card pb-8 pt-4"
            style={{
              animation: "athr-sheet 320ms cubic-bezier(.18,1.2,.4,1) both",
              maxHeight: "88vh",
              overflowY: "auto",
            }}
          >
            <div className="mb-3 flex items-start justify-between gap-3 px-5">
              <div>
                <p className="text-[15.5px] font-bold">تعديل الملف</p>
                <p className="mt-0.5 text-[11.5px] text-muted">الغلاف والصورة وبياناتك في مكانٍ واحد</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="إغلاق"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-muted"
              >
                <CloseIcon size={16} />
              </button>
            </div>

            <p className="mb-2 px-5 text-[12px] font-semibold text-muted">الغلاف</p>
            <ProfileCover
              mediaId={coverMediaId}
              spec={coverSpec}
              initialY={coverY}
              height={132}
              manage
            />

            <div className="flex items-center gap-4 px-5 pb-1 pt-4">
              <ProfileImages
                name={name}
                frame={frame}
                avatarMediaId={avatarMediaId}
                charm={charm}
                isPlus={isPlus}
                size={72}
                onError={setPictureError}
              />
              <div className="min-w-0 grow">
                <p className="text-[12.5px] font-semibold">صورة العرض</p>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">
                  اضغط الكاميرا على حافة صورتك لتغييرها.
                </p>
                {/* الشرط والخطأ هنا لا تحت الصورة: تحتها يركبان على النموذج. */}
                {pictureError ? (
                  <p role="alert" className="mt-1 text-[11px] leading-relaxed" style={{ color: "var(--color-live)" }}>
                    {pictureError}
                  </p>
                ) : isPlus ? (
                  <p className="mt-1 text-[11px] leading-relaxed text-faint">
                    صورة متحركة؟ {ANIMATED.rule}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="px-5 pt-3">
              <EditProfileForm
                name={name}
                handle={handle}
                bio={bio}
                city={city}
                onSaved={() => setOpen(false)}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
