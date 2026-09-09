"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { postNowPlaying, postSleep } from "@/app/actions";
import {
  CameraIcon,
  MoonIcon,
  MusicIcon,
  PinIcon,
  PlusIcon,
  TextIcon,
} from "@/components/icons";

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

const RADIUS = 142;

export function ComposerFan() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  // إجراءات الخادم التي تعيد التوجيه يجب أن تُستدعى داخل انتقال.
  const [, start] = useTransition();

  // الهروب يغلق القائمة، ومنع تمرير الصفحة خلف الغطاء.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const items: Item[] = [
    {
      key: "photo",
      label: "صورة",
      Icon: CameraIcon,
      angle: 98,
      run: () => router.push("/compose?kind=PHOTO"),
    },
    {
      key: "thought",
      label: "فكرة",
      Icon: TextIcon,
      angle: 74,
      run: () => router.push("/compose?kind=THOUGHT"),
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
      angle: 30,
      run: () => {
        setBusy("music");
        start(() => void postNowPlaying());
      },
    },
    {
      key: "sleep",
      label: "نوم",
      Icon: MoonIcon,
      angle: 6,
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
        onClick={() => setOpen(false)}
        aria-hidden={!open}
        className="fixed inset-0 z-20 transition-opacity duration-300"
        style={{
          background: "rgba(11,17,32,.82)",
          backdropFilter: "blur(3px)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
        }}
      />

      <div className="shell-fixed z-30">
        <div className="relative mb-[86px] ml-5 h-14 w-14">
          {items.map((item, index) => {
            const radians = (item.angle * Math.PI) / 180;
            const x = Math.cos(radians) * RADIUS;
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
                  setOpen(false);
                  item.run();
                }}
                className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center rounded-full disabled:opacity-60"
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
                <item.Icon size={21} />
                <span className="mt-0.5 text-[9.5px] font-medium text-muted">{item.label}</span>
              </button>
            );
          })}

          <button
            type="button"
            aria-label={open ? "إغلاق" : "لحظة جديدة"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="brand-gradient pointer-events-auto absolute inset-0 flex items-center justify-center rounded-full"
            style={{
              color: "var(--color-on-brand)",
              boxShadow: "0 8px 24px rgba(255,122,122,.4)",
              transform: open ? "rotate(135deg)" : "rotate(0deg)",
              transition: "transform 380ms cubic-bezier(.18,1.3,.42,1)",
            }}
          >
            <PlusIcon size={24} />
          </button>
        </div>
      </div>
    </>
  );
}
