"use client";

import { useEffect, useRef, useState } from "react";
import { asset } from "@/lib/base";

/*
 * مشهدُ الدخول — نسخةُ `apps/mobile/components/login-scene.tsx` (القاعدة ٣٧١)
 * بأرقامها وألوانها وتوقيتاتها، مكتوبةً بـCSS لا بـAnimated: الأرضيّةُ
 * بنجومها، والمدارُ، والخطُّ الحيّ، واللوحُ الزجاجيّ. والحركاتُ في
 * `globals.css` (`.ls-*`)، ومن طلب «قلّل الحركة» يراها ساكنة.
 */

/** الأرضيّة: تدرّجٌ دائريّ من أعلاها ونجومٌ خافتة — شاشةُ الإطلاق بعينها. */
export function SceneGround() {
  const stars = Array.from({ length: 28 }, (_, i) => ({
    x: (i * 37) % 100,
    y: ((i * 53) % 60) + 4,
    o: 0.18 + ((i * 7) % 5) * 0.08,
    r: i % 4 === 0 ? 1.4 : 1,
  }));
  return (
    <div className="ls-ground" aria-hidden="true">
      <svg width="100%" height="100%">
        {stars.map((s, i) => (
          <circle key={i} cx={`${s.x}%`} cy={`${s.y}%`} r={s.r} fill="#fff" opacity={s.o} />
        ))}
      </svg>
    </div>
  );
}

const SATS = ["write", "photo", "music", "place", "sleep", "morning"];

/**
 * المدار: الشعار في مركزه، والرسومُ الستّ على دائرةٍ تدور دورةً كلّ ٢٦
 * ثانية، وكلُّ رسمٍ يدور عكسها فيبقى قائماً. وعند الفتح الأوّل تخرج من
 * المركز متتابعةً كقوس الزائد. ومقاساتُه متغيّراتٌ تكبر على سطح المكتب.
 */
export function Orbit() {
  return (
    <div className="ls-orbit" aria-hidden="true">
      <div className="ls-halo" />
      <div className="ls-path" />
      <div className="ls-spin">
        {SATS.map((name, i) => (
          <div key={name} className="ls-sat" style={{ "--a": `${i * 60}deg`, "--i": i } as React.CSSProperties}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={asset(`/launch/${name}.png`)} alt="" />
          </div>
        ))}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="ls-mark" src={asset("/athr-mark.png")} alt="" />
    </div>
  );
}

type Row =
  | { kind: "card"; initial: string; tint: string; who: string; text?: string; photo?: boolean; react?: number }
  | { kind: "event"; icon: string; name: string; what: string };

const REACT = ["love", "laugh", "smile"];

/* مثالٌ مكتوب لا حساباتٌ حقيقية: لا يُعرض حسابُ أحدٍ لمن لم يدخل. */
const ROWS: Row[] = [
  { kind: "card", initial: "ن", tint: "#c0785a", who: "نورة · ٩:١٥ ص", text: "قهوة الصباح قبل الدوام، والجو أخيراً بارد", react: 0 },
  { kind: "event", icon: "place", name: "خالد", what: "وصل إلى جدة" },
  { kind: "card", initial: "س", tint: "#5a7fa8", who: "سارة · مع ريم", photo: true, react: 1 },
  { kind: "event", icon: "music", name: "فيصل", what: "يسمع أغنية الآن" },
  { kind: "event", icon: "morning", name: "ريم", what: "صحت ٦:٣٠ ص" },
  { kind: "card", initial: "م", tint: "#6a8a6a", who: "محمد · في مقهى الحيّ", text: "أوّل مرّة أجرّب هالمكان، يستاهل", react: 2 },
  { kind: "event", icon: "sleep", name: "نايف", what: "نام" },
];

function Rows() {
  return (
    <div className="ls-rows">
      {ROWS.map((row, i) =>
        row.kind === "card" ? (
          <div key={i} className="ls-row">
            <span className="ls-av" style={{ background: row.tint }}>
              {row.initial}
            </span>
            <div className="ls-card">
              <p className="ls-who">{row.who}</p>
              {row.text ? <p className="ls-text">{row.text}</p> : null}
              {row.photo ? <div className="ls-photo" /> : null}
              {row.react !== undefined ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  className="ls-pop"
                  src={asset(`/reactions/${REACT[row.react]}.png`)}
                  alt=""
                  style={{ animationDelay: `${400 + row.react * 1800}ms` }}
                />
              ) : null}
            </div>
          </div>
        ) : (
          <div key={i} className="ls-row ls-event">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={asset(`/launch/${row.icon}.png`)} alt="" />
            <p>
              <b>{row.name}</b> {row.what}
            </p>
          </div>
        ),
      )}
    </div>
  );
}

/**
 * الخط الحيّ: الأسطرُ مرسومةٌ مرّتين وتصعد بطول نسخةٍ واحدة ثمّ تعود بلا
 * أثر، بعشرين بكسلاً في الثانية. والطرفان يذوبان بقناعٍ (`mask-image`) —
 * شفافيّةُ ما تحته لا لونٌ فوقه، فالأرضيّةُ دائريّةُ التدرّج. وما دون ١٢٠
 * لا يُرسم: شريحةٌ من بطاقةٍ لا تُقرأ.
 */
export function LiveStrip() {
  const box = useRef<HTMLDivElement>(null);
  const copy = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(true);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const strip = box.current;
    const rows = copy.current;
    if (!strip || !rows) return;
    const measure = () => {
      setShow(strip.clientHeight >= 120);
      setSeconds(rows.offsetHeight / 20);
    };
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(strip);
    watch.observe(rows);
    return () => watch.disconnect();
  }, []);

  return (
    <div ref={box} className="ls-strip" aria-hidden="true">
      <div className="ls-thread" style={{ visibility: show ? "visible" : "hidden" }} />
      <div
        className="ls-reel"
        style={{
          visibility: show ? "visible" : "hidden",
          animationDuration: seconds ? `${seconds}s` : undefined,
          animationPlayState: seconds ? "running" : "paused",
        }}
      >
        <div ref={copy}>
          <Rows />
        </div>
        <Rows />
      </div>
    </div>
  );
}
