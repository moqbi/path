"use client";

import { useState, type ReactNode } from "react";
import { PlaceVisitors } from "@/components/place-visitors";

/**
 * اسمُ المكان يفتح الخرائط (القاعدة ٢١١). زرٌّ لا `<a>`: السطرُ قد يجلس داخل
 * رابط اللحظة، ورابطٌ في رابطٍ لا يجوز — فيُوقف الحدثُ قبل أن يصعد إليه
 * (القاعدة ٢٨).
 *
 * ولصاحب اللحظة (`visitors`) يفتح «من كان هنا» وفيها زرُّ الخرائط
 * (القاعدة ٢٣٠).
 */
export function PlaceLink({
  url,
  children,
  className,
  visitors,
}: {
  url: string | null;
  children: ReactNode;
  className?: string;
  visitors?: { momentId: string; place: string };
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={className}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (visitors) setOpen(true);
          else if (url) window.open(url, "_blank", "noopener,noreferrer");
        }}
      >
        {children}
      </button>
      {open && visitors ? (
        <PlaceVisitors momentId={visitors.momentId} place={visitors.place} mapsUrl={url} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}
