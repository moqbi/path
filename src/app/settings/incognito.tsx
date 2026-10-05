"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * وضعُ التخفّي (القاعدة ٢٥١) — لمشتركي آثار+: غيرُ المشترك يضغطه فيرتدّ مطفأً
 * ويُؤخذ إلى صفحة الاشتراك. والإجراءُ يفحص الاشتراك بنفسه، فالشاشةُ ليست الحارس.
 */
export function IncognitoBox({ initial, isPlus }: { initial: boolean; isPlus: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(initial && isPlus);
  return (
    <input
      name="hideOnline"
      type="checkbox"
      checked={on}
      onChange={(event) => {
        if (event.target.checked && !isPlus) {
          setOn(false);
          router.push("/subscribe");
          return;
        }
        setOn(event.target.checked);
      }}
      className="h-6 w-6 shrink-0 accent-[#f6b93b]"
    />
  );
}
