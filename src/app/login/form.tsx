"use client";

import { useActionState, useEffect, useState } from "react";
import { signIn } from "@/app/actions";
import { AthrMark, TAGLINE_AR, TAGLINE_EN } from "@/components/brand";
import { BackIcon, LockIcon } from "@/components/icons";

/**
 * شاشة الإقلاع: الغلاف يبقى، والشعار والعبارة يخرجان بهدوء ثم تظهر خيارات
 * الدخول. الخروج مرحلتان — ارتفاع خفيف مع التلاشي — فيبدو انسحاباً لا
 * اختفاءً مفاجئاً. ويُعرض مرة واحدة لكل جلسة متصفح حتى لا يعيد نفسه بعد
 * كل خروج وعودة.
 */
function useSplash(): "showing" | "leaving" | "done" {
  const [phase, setPhase] = useState<"showing" | "leaving" | "done">("showing");

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem("athr:splash") === "1";
    } catch {
      // وضع التصفح الخاص قد يمنع التخزين — تُعرض الشاشة، ولا شيء يتعطّل.
    }
    if (seen) {
      setPhase("done");
      return;
    }

    const leave = setTimeout(() => setPhase("leaving"), 1500);
    const finish = setTimeout(() => {
      setPhase("done");
      try {
        sessionStorage.setItem("athr:splash", "1");
      } catch {}
    }, 2600);

    return () => {
      clearTimeout(leave);
      clearTimeout(finish);
    };
  }, []);

  return phase;
}

const PROVIDERS = [
  { key: "apple", label: "المتابعة بحساب Apple", mark: <AppleMark /> },
  { key: "google", label: "المتابعة بحساب Google", mark: <GoogleMark /> },
  { key: "facebook", label: "المتابعة بحساب Facebook", mark: <FacebookMark /> },
  { key: "x", label: "المتابعة بحساب X", mark: <XMark /> },
];

export function LoginForm() {
  const phase = useSplash();
  const [showEmail, setShowEmail] = useState(false);
  const [state, action, pending] = useActionState(signIn, null);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <div className="relative min-h-dvh">
      {phase !== "done" ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{
            background:
              "linear-gradient(180deg,#0e1a24 0%,#1b2c38 45%,#3a4b52 78%,#8c6a58 100%)",
            opacity: phase === "leaving" ? 0 : 1,
            transition: "opacity 900ms ease 200ms",
          }}
        >
          <div
            className="flex flex-col items-center"
            style={{
              opacity: phase === "leaving" ? 0 : 1,
              transform: phase === "leaving" ? "translateY(-18px)" : "translateY(0)",
              transition: "opacity 700ms ease, transform 900ms cubic-bezier(.4,0,.2,1)",
            }}
          >
            <AthrMark size={78} />
            <span
              className="latin mt-5"
              style={{ fontSize: 34, fontWeight: 700, color: "#f7f5ef" }}
            >
              ATHR
            </span>
            <span
              className="mt-1.5"
              style={{ fontSize: 17, letterSpacing: "0.3em", color: "#c9c3b6" }}
            >
              أثر
            </span>
            <span className="mt-6 text-[13.5px]" style={{ color: "#e0dad0" }}>
              {TAGLINE_AR}
            </span>
            <span
              dir="ltr"
              className="latin mt-1.5 text-center text-[10px] leading-relaxed"
              style={{ color: "#9b968c", letterSpacing: "0.12em" }}
            >
              {TAGLINE_EN}
            </span>
          </div>
        </div>
      ) : null}

      <div className="flex min-h-dvh flex-col justify-between px-6 pb-10 pt-16">
        <div>
          <div className="mb-10 flex flex-col items-center">
            <AthrMark size={58} />
            <span className="latin mt-3 text-[26px] font-bold text-ink">ATHR</span>
            <span className="mt-4 text-[13.5px] text-muted">{TAGLINE_AR}</span>
          </div>

          {showEmail ? (
            <form action={action} className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => setShowEmail(false)}
                className="mb-1 flex items-center gap-1.5 self-start text-[12.5px] text-muted"
              >
                <BackIcon size={15} /> كل الخيارات
              </button>

              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                defaultValue="mohammed@athar.test"
                placeholder="البريد"
                className="rounded-xl border border-line bg-card px-4 text-[14.5px] text-ink outline-none focus:border-clay"
                style={{ height: 52 }}
              />
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                defaultValue="athar1234"
                placeholder="كلمة المرور"
                className="rounded-xl border border-line bg-card px-4 text-[14.5px] text-ink outline-none focus:border-clay"
                style={{ height: 52 }}
              />

              {state?.error ? (
                <p role="alert" className="text-[12.5px] font-medium" style={{ color: "var(--color-live)" }}>
                  {state.error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={pending}
                className="brand-gradient mt-2 flex items-center justify-center rounded-xl text-[15.5px] font-bold disabled:opacity-60"
                style={{ height: 54, color: "var(--color-on-brand)" }}
              >
                {pending ? "لحظة…" : "دخول"}
              </button>
            </form>
          ) : (
            <div className="flex flex-col gap-2.5">
              {PROVIDERS.map((provider) => (
                <button
                  key={provider.key}
                  type="button"
                  onClick={() =>
                    setNotice(
                      "الدخول عبر المزوّدين يحتاج تسجيل التطبيق عندهم وإضافة مفاتيحه. استخدم البريد الآن.",
                    )
                  }
                  className="flex items-center gap-3 rounded-xl border border-line bg-card px-4 text-[14px] font-medium text-ink"
                  style={{ height: 52 }}
                >
                  <span className="flex w-5 justify-center">{provider.mark}</span>
                  <span className="grow text-right">{provider.label}</span>
                </button>
              ))}

              <button
                type="button"
                onClick={() => setShowEmail(true)}
                className="brand-gradient mt-1.5 flex items-center justify-center rounded-xl text-[15px] font-bold"
                style={{ height: 54, color: "var(--color-on-brand)" }}
              >
                المتابعة بالبريد
              </button>

              {notice ? (
                <p
                  role="status"
                  className="mt-1 rounded-xl px-4 py-3 text-[12px] leading-relaxed"
                  style={{ background: "var(--color-clay-soft)", color: "var(--color-clay-ink)" }}
                >
                  {notice}
                </p>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex items-start justify-center gap-2 text-[11px] leading-relaxed text-faint">
          <LockIcon size={13} className="mt-0.5 shrink-0" />
          <span>حسابان تجريبيان: mohammed@athar.test و noura@athar.test — كلمة المرور athar1234</span>
        </div>
      </div>
    </div>
  );
}

/* شعارات المزوّدين — أشكال مبسّطة، بلا استعمال علاماتهم الرسمية. */
function AppleMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" className="text-ink">
      <path d="M16.4 12.7c0-2.4 2-3.6 2.1-3.6-1.1-1.7-2.9-1.9-3.6-1.9-1.5-.2-3 .9-3.8.9-.8 0-2-.9-3.3-.8-1.7 0-3.2 1-4.1 2.5-1.7 3-.4 7.5 1.3 9.9.8 1.2 1.8 2.5 3.1 2.5 1.2 0 1.7-.8 3.2-.8s1.9.8 3.2.8c1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8-.1 0-2.4-.9-2.4-3.6ZM14 5.6c.7-.8 1.1-2 1-3.1-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.6 2.9-1.4Z" />
    </svg>
  );
}
function GoogleMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.4Z" />
      <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.4 14a6 6 0 0 1 0-3.8V7.6H3.1a10 10 0 0 0 0 8.9L6.4 14Z" />
      <path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.8-2.8A10 10 0 0 0 3.1 7.6l3.3 2.6C7.2 7.8 9.4 5.9 12 5.9Z" />
    </svg>
  );
}
function FacebookMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="#1877F2">
      <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12Z" />
    </svg>
  );
}
function XMark() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" className="text-ink">
      <path d="M17.7 3h3.3l-7.2 8.3L22 21h-6.6l-5.2-6.8L4.3 21H1l7.7-8.8L1.3 3H8l4.7 6.2L17.7 3Zm-1.2 16h1.8L7.6 4.8H5.7L16.5 19Z" />
    </svg>
  );
}
