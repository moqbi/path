"use client";

import { useEffect, useState } from "react";
import { CloseIcon } from "@/components/icons";

/**
 * صورة اللحظة.
 *
 * تُعرض بنسبتها الحقيقية (أبعادها محفوظة مع الملف) فلا تُقصّ رأس أحد ولا
 * يضيع نصف المشهد — الصورة الطويلة جداً وحدها تُحدّ بارتفاع فتُقصّ، لأن
 * منشوراً بطول شاشتين ليس منشوراً. والضغط عليها يفتحها كاملة.
 */
export function Photo({
  mediaId,
  width,
  height,
  rounded = false,
}: {
  mediaId: string;
  width?: number | null;
  height?: number | null;
  rounded?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ratio = width && height ? width / height : 4 / 3;
  const tall = ratio < 0.62;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const stop = (event: React.SyntheticEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <>
      <button
        type="button"
        aria-label="افتح الصورة"
        onClick={(event) => {
          stop(event);
          setOpen(true);
        }}
        className={`block w-full overflow-hidden ${rounded ? "rounded-2xl" : ""}`}
        style={{ background: "var(--color-chip)", lineHeight: 0 }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/media/${mediaId}`}
          alt=""
          style={{
            width: "100%",
            display: "block",
            aspectRatio: tall ? undefined : `${ratio}`,
            maxHeight: tall ? 460 : undefined,
            objectFit: "cover",
          }}
        />
      </button>

      {open ? (
        <div
          onClick={(event) => {
            stop(event);
            setOpen(false);
          }}
          className="fixed inset-0 z-40 flex items-center justify-center p-4"
          style={{ background: "rgba(8,14,20,.94)", animation: "athr-veil 160ms ease both" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/media/${mediaId}`}
            alt=""
            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
          />
          <button
            type="button"
            aria-label="إغلاق"
            onClick={(event) => {
              stop(event);
              setOpen(false);
            }}
            className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full"
            style={{ background: "rgba(255,255,255,.16)", color: "#fff" }}
          >
            <CloseIcon size={18} />
          </button>
        </div>
      ) : null}
    </>
  );
}
