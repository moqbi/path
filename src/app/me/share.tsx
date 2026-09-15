"use client";

import { useState } from "react";
import { ShareIcon } from "@/components/icons";
import { ar } from "@/lib/format";

/**
 * مشاركة الملف.
 *
 * لا اكتشاف عام في آثار، فرابط الملف ليس دعوةً لغريب — هو ما تعطيه من
 * تعرفه ليجدك بلا بحثٍ بالاسم. ومعه رقم العضوية: هو اسمك الثابت هنا.
 *
 * تُستعمل مشاركة النظام حين توجد (فتظهر برامج التواصل كما هي على الجهاز)،
 * وإلا نُسخ الرابط — ولا يُترك المستخدم بلا خبر أيّهما حدث.
 */
export function ShareProfile({
  id,
  name,
  memberNo,
}: {
  id: string;
  name: string;
  memberNo: number;
}) {
  const [said, setSaid] = useState<string | null>(null);

  function tell(message: string) {
    setSaid(message);
    setTimeout(() => setSaid(null), 1800);
  }

  async function share() {
    const url = `${window.location.origin}/u/${id}`;
    const text = `${name} · عضوية رقم ${ar(memberNo)} في آثار`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "آثار", text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text}\n${url}`);
      tell("نُسخ الرابط");
    } catch {
      // إلغاء المستخدم للمشاركة ليس خطأً يُعرض.
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => void share()}
        aria-label="شارك ملفك"
        className="flex h-10 w-10 items-center justify-center rounded-full"
        style={{ background: "var(--color-chrome-2)", color: "var(--color-chrome-ink)" }}
      >
        <ShareIcon size={18} />
      </button>
      {said ? (
        <span
          className="absolute right-0 top-full z-20 mt-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[10.5px] font-semibold"
          style={{ background: "var(--color-clay)", color: "var(--color-on-brand)" }}
        >
          {said}
        </span>
      ) : null}
    </div>
  );
}
