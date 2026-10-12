"use client";

import { useEffect, useRef } from "react";

/**
 * منطقةُ تمرير المحادثة: تبدأ من آخرها وتلتصق به حين تصل رسالة (القاعدة ١٨٦).
 *
 * والرسائلُ القليلة تجلس في أسفلها بـ`mt-auto` لا `justify-end`: الأخيرةُ على
 * حاويةٍ تُمرَّر تدفع ما فاض إلى أعلى خارج مدى التمرير، فكانت المحادثةُ الطويلة
 * لا تصعد وتُقرأ ناقصة.
 */
export function ChatScroll({ last, children }: { last: string | null; children: React.ReactNode }) {
  const box = useRef<HTMLElement>(null);

  // بالرسالة الأخيرة لا بالعدد: العددُ يقف عند المئتين فلا يتغيّر بعد الإرسال.
  useEffect(() => {
    const el = box.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [last]);

  return (
    <main ref={box} className="scroll-area flex flex-col px-5 py-4">
      <div className="mt-auto flex flex-col gap-1">{children}</div>
    </main>
  );
}
