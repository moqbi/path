"use client";

import type { ReactNode } from "react";

/**
 * اسمُ المكان يفتح الخرائط (القاعدة ٢١١). زرٌّ لا `<a>`: السطرُ قد يجلس داخل
 * رابط اللحظة، ورابطٌ في رابطٍ لا يجوز — فيُوقف الحدثُ قبل أن يصعد إليه
 * (القاعدة ٢٨).
 */
export function PlaceLink({ url, children, className }: { url: string; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      className={className}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        window.open(url, "_blank", "noopener,noreferrer");
      }}
    >
      {children}
    </button>
  );
}
