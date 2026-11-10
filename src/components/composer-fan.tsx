"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { postSleep, postWake } from "@/app/actions";
import { playClose, playOpen } from "@/lib/sound";
import { asset } from "@/lib/base";

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
 * قوس القائمة — وجهان (القاعدة ٤٥٦):
 *
 * **في الشريط** (`bar`): الزرُّ في وسط الشريط الزجاجيّ والقوسُ نصفُ دائرةٍ
 * متناظرٌ فوقه، من ٢٤° إلى ١٥٦° — أدناها فوق حافّة الشريط لا عليها. المسافة
 * بين مركزين = نصف القطر × الزاوية بالراديان: ١٣٨ × ٢٦٫٤° ≈ ٦٤ والقرص ٤٤.
 * وأبعدُ الأصناف عن الوسط ١٣٨ × cos(٢٤°) + ٢٢ ≈ ١٤٨، فيتّسع له هيكلٌ عرضُه ٣٢٠.
 *
 * **في شريط سطح المكتب** (`rail`): ربعُ دائرةٍ من ركنٍ يمينيّ كما رُسم أوّلَ
 * مرّة — من ٨٨° إلى ٤° بنصف قطر ٢٤٦ — لأنّ الزرّ هناك على الحافّة اليمنى.
 *
 * والزوايا تُقسَّم على عدد الأصناف لا تُكتب لكل صنف.
 */
/** قرصُ الصنف ورسمُه: الرسم ٣٢ والقرص يلبسه بحشوةٍ لا يزيد. */
const DISC = 44;
const ICON = 32;

const ARC = {
  bar: { radius: 138, from: 24, to: 156, plus: 42 },
  rail: { radius: 246, from: 88, to: 4, plus: 36 },
} as const;

export function ComposerFan({ mode = "bar" }: { mode?: "bar" | "rail" }) {
  const arc = ARC[mode];
  const box = useRef<HTMLDivElement>(null);
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

  // بطاقةُ الترحيب تفتح القوس من خطوة «انشر أوّل لحظة» (القاعدة ٢٤٦).
  useEffect(() => {
    // وجهان مركّبان معاً على سطح المكتب: الظاهرُ منهما وحده يُجيب.
    const onOpen = () => {
      if (box.current?.getClientRects().length) toggle(true);
    };
    window.addEventListener("athr:fan", onOpen);
    return () => window.removeEventListener("athr:fan", onOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      src: asset("/composer/write.png"),
      run: () => router.push("/compose?kind=THOUGHT"),
    },
    {
      key: "photo",
      label: "صورة",
      src: asset("/composer/photo.png"),
      run: () => router.push("/compose?kind=PHOTO"),
    },
    {
      key: "place",
      label: "مكان",
      src: asset("/composer/place.png"),
      run: () => router.push("/compose?kind=PLACE"),
    },
    {
      key: "music",
      label: "أغنية",
      src: asset("/composer/music.png"),
      run: () => router.push("/compose?kind=MUSIC"),
    },
    {
      key: "sleep",
      label: "نوم",
      src: asset("/composer/sleep.png"),
      run: () => {
        setBusy("sleep");
        start(() => void postSleep());
      },
    },
    // النوم والصحو طرفا اليوم، فيجلسان متجاورين في طرف القوس.
    {
      key: "wake",
      label: "صحيت",
      src: asset("/composer/wake.png"),
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

      {/*
        في الشريط: مثبّتٌ في وسط الهيكل ومركزُه مركزُ القرص الزجاجيّ (حشوتُه
        السفليّة ثمّ نصفُ ارتفاعه ٦٢، ناقصاً نصفَ مربّع الزرّ ٥٦)، ويختفي على
        سطح المكتب مع الشريط. وفي شريط سطح المكتب: في مكانه من الصفّ.
      */}
      <div className={mode === "bar" ? "glassbar-fan shell-fixed z-30 flex justify-center" : "relative"} ref={mode === "rail" ? box : undefined}>
        <div
          ref={mode === "bar" ? box : undefined}
          className="relative h-14 w-14"
          style={mode === "bar" ? { marginBottom: "calc(max(12px, env(safe-area-inset-bottom)) + 3px)" } : undefined}
        >
          {items.map((item, index) => {
            // من أوّل القوس إلى آخره بالتساوي. في الشريط الأوّلُ يميناً (قراءةُ العربية)،
            // وفي شريط سطح المكتب الأوّلُ في الأعلى والقوسُ كلُّه إلى اليسار.
            const angle = arc.from + ((arc.to - arc.from) * index) / (items.length - 1);
            const radians = (angle * Math.PI) / 180;
            const x = (mode === "bar" ? 1 : -1) * Math.cos(radians) * arc.radius;
            const y = -Math.sin(radians) * arc.radius;
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
                className="pointer-events-auto absolute flex items-center justify-center rounded-full disabled:opacity-60"
                style={{
                  /*
                     قرصُ الصنف أصغر من زرّ النشر (`DISC` مقابل ٥٦): الرسم
                     ٣٢ بكسلاً، وقرصٌ بحجم الزرّ حوله يترك هالةً بيضاء
                     تُقرأ أكبر من رسمها. ويُوسَّط في مربّع الزرّ.
                  */
                  width: DISC,
                  height: DISC,
                  left: (56 - DISC) / 2,
                  top: (56 - DISC) / 2,
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
                    width: ICON,
                    height: ICON,
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
              /*
                 الزرّ رسمٌ في `public/composer/plus.png` لا خطٌّ في الكود:
                 قرصٌ ملوّن برأسه، فلا قرصَ داكنٌ تحته يُقرأ حلقةً حوله —
                 ويُستبدل بتبديل الملف كبقية رسوم القائمة.
              */
              borderRadius: "9999px",
              transform: open ? "rotate(135deg)" : "rotate(0deg)",
              transition: "transform 380ms cubic-bezier(.18,1.3,.42,1)",
            }}
          >
            {/*
              الرسمُ ٤٢ في وسط الشريط — قرصٌ بارتفاع ٦٢ يحمله — و٣٦ في شريط سطح
              المكتب، ومربّعُ اللمس ٥٦ في الاثنين. والظلُّ على الرسم لا على
              المربّع، وإلا رُسمت هالةٌ بحجم ٥٦.
            */}
            <span
              aria-hidden="true"
              className="block rounded-full"
              style={{
                width: arc.plus,
                height: arc.plus,
                boxShadow: "0 6px 16px rgba(14,26,36,.35)",
                backgroundImage: `url(${asset("/composer/plus.png")})`,
                backgroundSize: "contain",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              }}
            />
          </button>
        </div>
      </div>
    </>
  );
}
