"use client";

import { useEffect, useState } from "react";
import { CloseIcon } from "@/components/icons";

/**
 * صورة اللحظة في إطارٍ ثابت.
 *
 * جُرّب عرضها بنسبتها الحقيقية فكبرت البطاقة مع كل صورة طويلة وتشوّه
 * الخط الزمني. الإطار الثابت يبقي الإيقاع واحداً، والضغط يفتح الصورة
 * كاملة — فلا شيء يضيع بالقصّ.
 */
export function Photo({
  mediaId,
  height = 200,
  rounded = false,
}: {
  mediaId: string;
  height?: number;
  rounded?: boolean;
}) {
  const [open, setOpen] = useState(false);

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
          style={{ width: "100%", height, display: "block", objectFit: "cover" }}
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
