"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { postSleep, postWake } from "@/app/actions";
import { playClose, playOpen } from "@/lib/sound";

/**
 * زر النشر وقائمته المتطايرة — على نمط Path.
 *
 * الأصناف تنطلق من مكان الزر نفسه على قوس، بتأخير متدرّج يجعلها تتتابع لا
 * تظهر دفعة واحدة. الحركة على `transform` و`opacity` وحدهما فتبقى على
 * مسار الرسم السريع؛ تحريك `top`/`left` كان سيقطّعها على الأجهزة الضعيفة.
 */
type Item = {
  key: string;
  label: string;
  /** رسمُ الصنف في `public/composer` — استبداله يغيّر شكله بلا لمس الكود. */
  src: string;
  run: () => void;
};

/*
 * قوس القائمة.
 *
 * الزوايا تُقسَّم على عدد الأصناف لا تُكتب لكل صنف: إضافة صنفٍ سادس
 * بزاوياتٍ ثابتة كانت ستُخرج أعلاها عن الشاشة أو تُلصق الأقراص.
 *
 * والمسافة بين مركزين = نصف القطر × الزاوية بالراديان: ٢٤٦ × ١٦٫٨° ≈ ٧٢
 * بكسلاً والقرص ٥٦، فتبقى فرجة تُرى. وأعلى الأصناف عند ٨٨° لا ٩٠: القرص
 * عند القائمة تماماً يخرج من حافة الإطار اليمنى.
 */
const RADIUS = 246;
const TOP = 88;
const BOTTOM = 4;

export function ComposerFan() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // فتح القائمة وإغلاقها لهما نقرة: صاعدة عند التطاير، هابطة عند الانطواء.
  function toggle(next: boolean) {
    if (next) playOpen();
    else playClose();
    setOpen(next);
  }
  const [busy, setBusy] = useState<string | null>(null);
  // إجراءات الخادم التي تعيد التوجيه يجب أن تُستدعى داخل انتقال.
  const [, start] = useTransition();

  // الهروب يغلق القائمة، ومنع تمرير الصفحة خلف الغطاء.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") toggle(false);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const items: Item[] = [
    {
      key: "write",
      label: "اكتب",
      src: "/composer/write.png",
      run: () => router.push("/compose?kind=THOUGHT"),
    },
    {
      key: "photo",
      label: "صورة",
      src: "/composer/photo.png",
      run: () => router.push("/compose?kind=PHOTO"),
    },
    {
      key: "place",
      label: "مكان",
      src: "/composer/place.png",
      run: () => router.push("/compose?kind=PLACE"),
    },
    {
      key: "music",
      label: "أغنية",
      src: "/composer/music.png",
      run: () => router.push("/compose?kind=MUSIC"),
    },
    {
      key: "sleep",
      label: "نوم",
      src: "/composer/sleep.png",
      run: () => {
        setBusy("sleep");
        start(() => void postSleep());
      },
    },
    // النوم والصحو طرفا اليوم، فيجلسان متجاورين في طرف القوس.
    {
      key: "wake",
      label: "صحيت",
      src: "/composer/wake.svg",
      run: () => {
        setBusy("wake");
        start(() => void postWake());
      },
    },
  ];

  return (
    <>
      {/* غطاء يعتّم الخط الزمني ويغلق القائمة عند اللمس خارجها. */}
      <div
        onClick={() => toggle(false)}
        aria-hidden={!open}
        className="fixed inset-0 z-20 transition-opacity duration-300"
        style={{
          // بلا backdrop-filter: مكلف على الجوال، ويشوّه الرسم في بعض المحرّكات.
          background: "rgba(14,26,36,.86)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
        }}
      />

      <div className="shell-fixed z-30">
        <div className="relative mb-[86px] ml-5 h-14 w-14">
          {items.map((item, index) => {
            // الأوّل في الأعلى والأخير في الأسفل، وما بينهما بالتساوي.
            const angle = TOP - ((TOP - BOTTOM) * index) / (items.length - 1);
            const radians = (angle * Math.PI) / 180;
            const x = -Math.cos(radians) * RADIUS;
            const y = -Math.sin(radians) * RADIUS;
            const delay = open ? index * 42 : (items.length - 1 - index) * 26;

            return (
              <button
                key={item.key}
                type="button"
                tabIndex={open ? 0 : -1}
                aria-hidden={!open}
                disabled={busy !== null}
                onClick={() => {
                  toggle(false);
                  item.run();
                }}
                aria-label={item.label}
                className="pointer-events-auto absolute inset-0 flex items-center justify-center rounded-full disabled:opacity-60"
                style={{
                  background: "var(--color-card)",
                  border: "1px solid var(--color-line)",
                  transform: open
                    ? `translate(${x}px, ${y}px) scale(1)`
                    : "translate(0,0) scale(.35)",
                  opacity: open ? 1 : 0,
                  pointerEvents: open ? "auto" : "none",
                  transitionProperty: "transform, opacity",
                  transitionDuration: open ? "420ms" : "220ms",
                  transitionTimingFunction: open
                    ? "cubic-bezier(.18,1.3,.42,1)"
                    : "cubic-bezier(.4,0,1,1)",
                  transitionDelay: `${delay}ms`,
                  boxShadow: "0 8px 22px rgba(0,0,0,.45)",
                }}
              >
                {/* الرسم صورةٌ لا خطّ: تُستبدل من `public/composer` وحدها. */}
                <span
                  aria-hidden="true"
                  style={{
                    width: 30,
                    height: 30,
                    backgroundImage: `url(${item.src})`,
                    backgroundSize: "contain",
                    backgroundPosition: "center",
                    backgroundRepeat: "no-repeat",
                    opacity: busy === item.key ? 0.45 : 1,
                  }}
                />
              </button>
            );
          })}

          <button
            type="button"
            aria-label={open ? "إغلاق" : "لحظة جديدة"}
            aria-expanded={open}
            onClick={() => toggle(!open)}
            className="pointer-events-auto absolute inset-0 flex items-center justify-center rounded-full"
            style={{
              // الزر بلون العمق، وعلامة الزائد وحدها بتدرّج الشعار.
              background: "var(--color-night)",
              boxShadow: "0 8px 24px rgba(14,26,36,.35)",
              transform: open ? "rotate(135deg)" : "rotate(0deg)",
              transition: "transform 380ms cubic-bezier(.18,1.3,.42,1)",
            }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <defs>
                <linearGradient id="fab-plus" x1="4" y1="20" x2="20" y2="4" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#F6B93B" />
                  <stop offset="1" stopColor="#FF7A5A" />
                </linearGradient>
              </defs>
              <path
                d="M12 5v14M5 12h14"
                stroke="url(#fab-plus)"
                strokeWidth="2.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </>
  );
}
