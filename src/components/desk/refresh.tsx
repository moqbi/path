"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * العمودان الجانبيّان في التخطيط، والتخطيطُ لا يُعاد رسمُه مع التنقّل —
 * فبلا هذا يبقى «متصل الآن» والإشعارات على ما كانت عليه ساعةَ فُتحت
 * الصفحة. كلَّ دقيقتين، والنافذةُ ظاهرة وحدها: تبويبٌ في الخلفية لا
 * يستحقّ طلباً.
 */
export function DeskRefresh() {
  const router = useRouter();
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = window.setInterval(tick, 120_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router]);
  return null;
}
