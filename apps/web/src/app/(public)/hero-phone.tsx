"use client";

import { useEffect, useState } from "react";

/**
 * هاتفُ الرأس يعرض التطبيقَ كلّه (القاعدة ٤٢٠): يتنقّل وحده بين لقطاتٍ حقيقيّة
 * (`public/shots`)، والبطاقتان الطافيتان حوله تتبدّلان معه فتشرحان الشاشة.
 * كانت لقطةً واحدة للخطّ الزمنيّ لا تقول إنّ في التطبيق دائرةً ونوتاً وملفّاً.
 *
 * وما في البطاقات أمثلةٌ مكتوبة لا حساباتٌ حقيقيّة (القاعدة ٢٧٦). والتنقّلُ يقف
 * لمن طلب «قلّل الحركة» (القاعدة ٣٦)، والنقاطُ تحت البطاقتين تنقل باليد.
 */
const SCREENS = [
  {
    src: "/shots/hero.webp",
    label: "اللحظات",
    alt: "الخط الزمني في آثار مومنتس",
    a: { icon: "/composer/place.png", title: "في مقهى الحيّ", sub: "مع نورة وخالد · الآن" },
    b: { icon: "/composer/music.png", title: "يسمع الآن", sub: "على نوته · مع دائرته" },
  },
  {
    src: "/shots/circle.webp",
    label: "الدائرة",
    alt: "الأصدقاء والقصص في آثار مومنتس",
    a: { icon: "/reactions/love.png", title: "نورة متصلة الآن", sub: "الرياض │ اليوم ٩:١٥ م" },
    b: { icon: "/composer/photo.png", title: "قصّةٌ جديدة", sub: "من خالد · تذهب بعد يوم" },
  },
  {
    src: "/shots/notes.webp",
    label: "النوت",
    alt: "النوت في آثار مومنتس",
    a: { icon: "/composer/write.png", title: "نوت: على الطريق 🚗", sub: "سطرٌ فوق صورتك ليومٍ واحد" },
    b: { icon: "/reactions/laugh.png", title: "٣ تفاعلوا على نوتك", sub: "من دائرتك وحدها" },
  },
  {
    src: "/shots/profile.webp",
    label: "الملف",
    alt: "الملف الشخصي في آثار مومنتس",
    a: { icon: "/composer/wake.png", title: "لك معانا ٤ أشهر", sub: "عضوية رقم ٤٢" },
    b: { icon: "/reactions/smile.png", title: "كتاب سنتك جاهز", sub: "لحظاتك يوماً بيوم" },
  },
] as const;

const STEP_MS = 4500;

export function HeroPhone() {
  const [at, setAt] = useState(0);
  const [still, setStill] = useState(true);

  useEffect(() => {
    const quiet = window.matchMedia("(prefers-reduced-motion: reduce)");
    setStill(quiet.matches);
  }, []);

  useEffect(() => {
    if (still) return;
    const timer = window.setTimeout(() => setAt((i) => (i + 1) % SCREENS.length), STEP_MS);
    return () => window.clearTimeout(timer);
  }, [at, still]);

  const screen = SCREENS[at];

  return (
    <>
      <div className="rise rise-3 flex items-end">
        <figure className="l-phone l-phone-hero l-phone-live">
          {SCREENS.map((s, i) => (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img key={s.src} src={s.src} alt={i === at ? s.alt : ""} aria-hidden={i !== at} className={i === at ? "on" : ""} />
          ))}
        </figure>
      </div>

      {/* المفتاحُ بالشاشة: البطاقةُ تُبنى من جديد فتدخل بحركتها. */}
      <Float key={`a${at}`} className="l-float-moment" {...screen.a} />
      <Float key={`b${at}`} className="l-float-music" {...screen.b} />

      <div className="l-shot-dots" role="tablist" aria-label="شاشات التطبيق">
        {SCREENS.map((s, i) => (
          <button
            key={s.src}
            type="button"
            role="tab"
            aria-selected={i === at}
            aria-label={s.label}
            className={i === at ? "on" : ""}
            onClick={() => setAt(i)}
          >
            {i === at ? <span>{s.label}</span> : null}
          </button>
        ))}
      </div>
    </>
  );
}

function Float({ className, icon, title, sub }: { className: string; icon: string; title: string; sub: string }) {
  return (
    <div className={`l-float l-float-swap ${className}`} aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={icon} alt="" width={40} height={40} />
      <span className="flex flex-col leading-tight">
        <span className="text-[13px] font-bold">{title}</span>
        <span className="text-[11.5px] text-muted">{sub}</span>
      </span>
    </div>
  );
}
