"use client";

import { useEffect, useState } from "react";
import { MoonIcon, SparkIcon } from "@/components/icons";

const KEY = "athr:theme";

/**
 * مفتاح الوضع الليلي.
 *
 * يكتب `data-theme` على `<html>` ويحفظ الاختيار في كوكي يقرأها الخادم
 * عند الرسم — فلا تومض الشاشة الفاتحة لحظةً قبل أن تُظلم. والحفظ كوكي
 * لا `localStorage` لأن الأخير لا يصل إلى الخادم أصلاً.
 */
export function ThemeToggle({ initial }: { initial: "light" | "dark" }) {
  const [theme, setTheme] = useState<"light" | "dark">(initial);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  function flip() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    document.cookie = `${KEY}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  }

  return (
    <button
      type="button"
      onClick={flip}
      aria-label={theme === "dark" ? "الوضع النهاري" : "الوضع الليلي"}
      aria-pressed={theme === "dark"}
      className="flex h-11 w-11 items-center justify-center"
      style={{ color: "var(--color-chrome-ink)" }}
    >
      {theme === "dark" ? <SparkIcon size={21} /> : <MoonIcon size={21} />}
    </button>
  );
}
