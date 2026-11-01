"use client";

import { useEffect, useState } from "react";

/**
 * «فلان مقفل الخاص» (القاعدة ٣٨٥) — سطرٌ زجاجيّ في أعلى الملفّ حين يُردّ فتحُ المحادثة،
 * يبقى ثلاث ثوانٍ ثمّ يذهب. والرسالةُ من الخادم كما قالها لا تُكتب هنا.
 */
export function DmClosedNotice({ text }: { text: string }) {
  const [shown, setShown] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setShown(false), 3200);
    return () => clearTimeout(timer);
  }, []);
  if (!shown) return null;
  return (
    <div
      role="status"
      className="shell-fixed pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4"
    >
      <div className="max-w-[340px] rounded-full border border-white/15 bg-[rgba(14,26,36,0.82)] px-4 py-2.5 text-center text-[13px] font-semibold text-white shadow-lg backdrop-blur-md">
        {text}
      </div>
    </div>
  );
}
