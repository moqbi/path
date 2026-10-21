"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LogoRefresh } from "@/components/logo-refresh";
import { CheckIcon, OfflineIcon } from "@/components/icons";
import { asset } from "@/lib/base";

const STEPS = [2000, 3000, 5000, 8000, 13000, 20000];

/**
 * «ما فيه اتصال» قرصٌ زجاجيّ في أعلى الهيكل (القاعدة ٣٢١) — نسخةُ الجوّال:
 * يظهر حين يقول المتصفّح إنّه انقطع، ويسأل بمهلٍ تطول ملفّاً صغيراً من موقعنا —
 * `navigator.onLine` يقول إنّ في الجهاز شبكةً لا إنّها تصل — فإذا ردّ أعاد رسم
 * الصفحة (`router.refresh`) وقال «رجع الاتصال» ثانيتين. والضغطةُ تسأل في الحال.
 */
export function OfflineBanner() {
  const router = useRouter();
  const [mode, setMode] = useState<"off" | "down" | "back">("off");
  const [checking, setChecking] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attempt = useRef(0);
  const down = useRef(false);

  useEffect(() => {
    const probe = async () => {
      timer.current = null;
      setChecking(true);
      const abort = new AbortController();
      const cut = setTimeout(() => abort.abort(), 6000);
      try {
        const response = await fetch(`${asset("/athr-mark.png")}?ping=${Date.now()}`, {
          method: "HEAD",
          cache: "no-store",
          signal: abort.signal,
        });
        if (response.ok) return back();
      } catch {
        // ما زالت مقطوعة.
      } finally {
        clearTimeout(cut);
        setChecking(false);
      }
      if (down.current) schedule(STEPS[Math.min(attempt.current++, STEPS.length - 1)]);
    };
    const schedule = (delay: number) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void probe(), delay);
    };
    const lost = () => {
      if (down.current) return;
      down.current = true;
      attempt.current = 0;
      setMode("down");
      schedule(STEPS[0]);
    };
    const back = () => {
      if (timer.current) clearTimeout(timer.current);
      if (!down.current) return;
      down.current = false;
      setMode("back");
      router.refresh();
      setTimeout(() => setMode((m) => (m === "back" ? "off" : m)), 2000);
    };
    const now = () => {
      if (!down.current) return;
      attempt.current = 0;
      schedule(0);
    };
    if (!navigator.onLine) lost();
    window.addEventListener("offline", lost);
    window.addEventListener("online", now);
    window.addEventListener("athr:retry", now);
    document.addEventListener("visibilitychange", now);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      window.removeEventListener("offline", lost);
      window.removeEventListener("online", now);
      window.removeEventListener("athr:retry", now);
      document.removeEventListener("visibilitychange", now);
    };
  }, [router]);

  if (mode === "off") return null;
  const isDown = mode === "down";
  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 top-0 z-[70] mx-auto flex max-w-[430px] justify-center px-4"
      style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 10px)" }}
    >
      <button
        type="button"
        disabled={!isDown}
        onClick={() => window.dispatchEvent(new Event("athr:retry"))}
        className="toast-in pointer-events-auto flex max-w-[90%] items-center gap-2.5 rounded-full py-1.5 pl-2 pr-4 text-right text-white"
        style={{
          background: "rgba(20,24,28,.82)",
          border: "1px solid rgba(255,255,255,.12)",
          backdropFilter: "blur(14px) saturate(160%)",
          WebkitBackdropFilter: "blur(14px) saturate(160%)",
          boxShadow: "0 6px 20px rgba(0,0,0,.25)",
        }}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center">
          {isDown ? (
            checking ? (
              <LogoRefresh size={26} />
            ) : (
              <span style={{ color: "#FF9C82" }}><OfflineIcon size={19} /></span>
            )
          ) : (
            <span style={{ color: "#7BD88F" }}><CheckIcon size={19} /></span>
          )}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[13.5px] font-bold">{isDown ? "ما فيه اتصال بالإنترنت" : "رجع الاتصال"}</span>
          {isDown ? (
            <span className="block truncate text-[11.5px]" style={{ color: "rgba(255,255,255,.7)" }}>
              {checking ? "نحاول نعيد الاتصال…" : "نعيد المحاولة تلقائياً — اضغط للمحاولة الآن"}
            </span>
          ) : null}
        </span>
      </button>
    </div>
  );
}
