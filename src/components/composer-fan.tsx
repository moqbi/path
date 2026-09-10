"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { postSleep } from "@/app/actions";
import { CameraIcon, MoonIcon, MusicIcon, PinIcon, TextIcon } from "@/components/icons";
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
  Icon: typeof CameraIcon;
  angle: number;
  run: () => void;
};

const RADIUS = 168;

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
      Icon: TextIcon,
      angle: 88,
      run: () => router.push("/compose?kind=THOUGHT"),
    },
    {
      key: "photo",
      label: "صورة",
      Icon: CameraIcon,
      angle: 70,
      run: () => router.push("/compose?kind=PHOTO"),
    },
    {
      key: "place",
      label: "مكان",
      Icon: PinIcon,
      angle: 52,
      run: () => router.push("/compose?kind=PLACE"),
    },
    {
      key: "music",
      label: "أغنية",
      Icon: MusicIcon,
      angle: 34,
      run: () => router.push("/compose?kind=MUSIC"),
    },
    {
      key: "sleep",
      label: "نوم",
      Icon: MoonIcon,
      angle: 14,
      run: () => {
        setBusy("sleep");
        start(() => void postSleep());
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
            const radians = (item.angle * Math.PI) / 180;
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
                  color: busy === item.key ? "var(--color-clay)" : "var(--color-ink)",
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
                <item.Icon size={23} />
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
