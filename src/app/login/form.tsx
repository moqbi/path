"use client";

import { useActionState, useEffect, useState } from "react";
import { signIn } from "@/app/actions";
import { AthrMark, TAGLINE_AR, TAGLINE_EN } from "@/components/brand";
import { BackIcon } from "@/components/icons";

type Phase = "intro" | "leaving" | "form";

/**
 * الدخول على ثلاث مراحل فوق خلفية ثابتة: يدخل الشعار والعبارتان، ثم
 * يغادران بارتفاع وتلاشٍ، ثم تدخل خيارات الدخول من الأسفل. الخلفية لا
 * تتحرّك أبداً — هي التي تربط المراحل الثلاث ببعضها.
 * تُعرض مرة لكل جلسة متصفح حتى لا تتكرر بعد كل خروج.
 */
function usePhases(): Phase {
  const [phase, setPhase] = useState<Phase>("intro");

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem("athr:intro") === "1";
    } catch {
      // التصفح الخاص قد يمنع التخزين — تُعرض المقدمة، ولا شيء يتعطّل.
    }
    if (seen) {
      setPhase("form");
      return;
    }

    const leave = setTimeout(() => setPhase("leaving"), 2000);
    const done = setTimeout(() => {
      setPhase("form");
      try {
        sessionStorage.setItem("athr:intro", "1");
      } catch {}
    }, 3100);

    return () => {
      clearTimeout(leave);
      clearTimeout(done);
    };
  }, []);

  return phase;
}

const PROVIDERS = [
  { key: "apple", label: "Apple", mark: <AppleMark /> },
  { key: "google", label: "Google", mark: <GoogleMark /> },
  { key: "facebook", label: "Facebook", mark: <FacebookMark /> },
];

export function LoginForm({ photo, deleted = false }: { photo: boolean; deleted?: boolean }) {
  const phase = usePhases();
  const [showEmail, setShowEmail] = useState(false);
  const [state, action, pending] = useActionState(signIn, null);
  const [notice, setNotice] = useState<string | null>(
    // العودة إلى هذه الشاشة بعد الحذف تحتاج جملة تؤكد أن ما طُلب قد تمّ.
    deleted ? "حُذف حسابك وكل ما فيه. تسعدنا عودتك متى شئت." : null,
  );

  const introVisible = phase === "intro";
  const formVisible = phase === "form";

  return (
    <div
      className="screen relative"
      style={{
        backgroundImage: photo
          ? "linear-gradient(180deg,rgba(14,26,36,.35),rgba(14,26,36,.88)), url(/login-bg.jpg)"
          : [
              "radial-gradient(120% 60% at 85% 18%, rgba(255,196,120,.55), transparent 60%)",
              "linear-gradient(180deg,#16293a 0%,#2c4055 30%,#7b6a63 62%,#3d3a3a 78%,#171d24 100%)",
            ].join(","),
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* تلال متراكبة تعطي الخلفية البديلة عمق المشهد الجبلي. */}
      {photo ? null : (
        <>
          <div
            className="pointer-events-none absolute inset-x-0"
            style={{
              bottom: "22%",
              height: 190,
              background: "#2b3a48",
              opacity: 0.55,
              clipPath: "polygon(0 62%,18% 30%,34% 55%,52% 18%,72% 48%,88% 26%,100% 46%,100% 100%,0 100%)",
            }}
          />
          <div
            className="pointer-events-none absolute inset-x-0"
            style={{
              bottom: 0,
              height: 300,
              background: "#1a2029",
              clipPath: "polygon(0 55%,14% 32%,30% 52%,48% 22%,66% 46%,84% 28%,100% 50%,100% 100%,0 100%)",
            }}
          />
        </>
      )}

      <div className="relative flex flex-1 flex-col justify-between px-6 pb-10 pt-16">
        {/* المقدّمة: تدخل من الأعلى ثم تغادر إلى الأعلى. */}
        <div
          className="flex flex-col items-center pt-6"
          style={{
            opacity: introVisible ? 1 : 0,
            transform: introVisible
              ? "translateY(0)"
              : phase === "leaving"
                ? "translateY(-28px)"
                : "translateY(-40px)",
            transition: "opacity 800ms ease, transform 900ms cubic-bezier(.3,0,.2,1)",
            pointerEvents: "none",
            /*
              المقدّمة مرفوعةٌ من السياق دائماً لا عند ظهور النموذج وحده:
              رفعُها حينئذٍ كان يترك النموذج وحيداً في حاوية
              `justify-between` فيقفز إلى أعلى الشاشة — وموضعه أسفلها،
              فوق حشوة `pb-10`.
            */
            position: "absolute",
            insetInline: 0,
          }}
        >
          <AthrMark size={76} />
          <span
            className="latin mt-5"
            style={{ fontSize: 32, fontWeight: 700, color: "#f7f5ef" }}
          >
            ATHAR
          </span>
          <span className="mt-5 text-[15px] font-medium" style={{ color: "#f0ece4" }}>
            {TAGLINE_AR}
          </span>
          <span
            dir="ltr"
            className="latin mt-1.5 text-center text-[10.5px] leading-relaxed"
            style={{ color: "#b9b2a8", letterSpacing: "0.1em" }}
          >
            {TAGLINE_EN}
          </span>
        </div>

        {/*
          العلامة في أعلى الشاشة: الشعار أوّل ما يُرى، والخيارات في
          أسفلها حيث يصل الإبهام. وهي تظهر مع الخيارات بالحركة نفسها.
        */}
        <div
          className="flex flex-col items-center pt-2"
          style={{
            opacity: formVisible ? 1 : 0,
            transition: "opacity 700ms ease 120ms",
            pointerEvents: "none",
          }}
        >
          <AthrMark size={96} />
          <span className="latin mt-3 text-[26px] font-bold" style={{ color: "#f7f5ef" }}>
            ATHAR
          </span>
          <span className="mt-2 text-[13px]" style={{ color: "#cbc5bb" }}>
            {TAGLINE_AR}
          </span>
        </div>

        {/* خيارات الدخول: تدخل من الأسفل بعد مغادرة المقدّمة. */}
        <div
          className="mt-auto"
          style={{
            opacity: formVisible ? 1 : 0,
            transform: formVisible ? "translateY(0)" : "translateY(26px)",
            transition: "opacity 700ms ease 120ms, transform 800ms cubic-bezier(.2,.8,.3,1) 120ms",
            pointerEvents: formVisible ? "auto" : "none",
          }}
        >
          {showEmail ? (
            <form action={action} className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => setShowEmail(false)}
                className="mb-1 flex items-center gap-1.5 self-start text-[12.5px]"
                style={{ color: "#b9b2a8" }}
              >
                <BackIcon size={15} /> كل الخيارات
              </button>

              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="البريد"
                className="rounded-xl px-4 text-[14.5px] outline-none"
                style={{
                  height: 52,
                  background: "rgba(247,245,239,.1)",
                  border: "1px solid rgba(247,245,239,.22)",
                  color: "#f7f5ef",
                }}
              />
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="كلمة المرور"
                className="rounded-xl px-4 text-[14.5px] outline-none"
                style={{
                  height: 52,
                  background: "rgba(247,245,239,.1)",
                  border: "1px solid rgba(247,245,239,.22)",
                  color: "#f7f5ef",
                }}
              />

              {state?.error ? (
                <p role="alert" className="text-[12.5px] font-medium" style={{ color: "#ff9d84" }}>
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
              <div className="flex gap-2.5">
                {PROVIDERS.map((provider) => (
                  <button
                    key={provider.key}
                    type="button"
                    aria-label={`المتابعة بحساب ${provider.label}`}
                    onClick={() =>
                      setNotice(
                        "الدخول عبر المزوّدين يحتاج تسجيل التطبيق عندهم وإضافة مفاتيحه. استخدم البريد الآن.",
                      )
                    }
                    className="flex flex-1 items-center justify-center rounded-xl"
                    style={{
                      height: 54,
                      background: "rgba(247,245,239,.94)",
                      border: "1px solid rgba(247,245,239,.3)",
                    }}
                  >
                    {provider.mark}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setShowEmail(true)}
                className="brand-gradient mt-1 flex items-center justify-center rounded-xl text-[15px] font-bold"
                style={{ height: 54, color: "var(--color-on-brand)" }}
              >
                المتابعة بالبريد
              </button>

              {notice ? (
                <p
                  role="status"
                  className="mt-1 rounded-xl px-4 py-3 text-[12px] leading-relaxed"
                  style={{ background: "rgba(14,26,36,.6)", color: "#e8e2d8" }}
                >
                  {notice}
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* شعارات المزوّدين — أشكال مبسّطة، بلا استعمال علاماتهم الرسمية. */
function AppleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="#0e1a24">
      <path d="M16.4 12.7c0-2.4 2-3.6 2.1-3.6-1.1-1.7-2.9-1.9-3.6-1.9-1.5-.2-3 .9-3.8.9-.8 0-2-.9-3.3-.8-1.7 0-3.2 1-4.1 2.5-1.7 3-.4 7.5 1.3 9.9.8 1.2 1.8 2.5 3.1 2.5 1.2 0 1.7-.8 3.2-.8s1.9.8 3.2.8c1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8-.1 0-2.4-.9-2.4-3.6ZM14 5.6c.7-.8 1.1-2 1-3.1-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.6 2.9-1.4Z" />
    </svg>
  );
}
function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.4Z" />
      <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.4 14a6 6 0 0 1 0-3.8V7.6H3.1a10 10 0 0 0 0 8.9L6.4 14Z" />
      <path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.8-2.8A10 10 0 0 0 3.1 7.6l3.3 2.6C7.2 7.8 9.4 5.9 12 5.9Z" />
    </svg>
  );
}
function FacebookMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="#1877F2">
      <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12Z" />
    </svg>
  );
}
