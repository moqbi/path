"use client";

import { useState } from "react";

/**
 * بطاقةُ «ماذا تنشر» تنقلب إلى ما ستراه الدائرة (القاعدة ٤٢٠): وجهُها الرسمُ
 * والعنوانُ والشرائح كما كانت، وظهرُها اللحظةُ نفسها كما تنزل في الخطّ الزمنيّ —
 * اسمٌ ووقتٌ ونصٌّ ووجوهُ من تفاعل. الزائرُ يفهم النوعَ من البطاقة بلا شرح.
 *
 * تنقلب بالمرور على الكمبيوتر وبالضغط على الجوّال (لا مرورَ فيه)، وبـEnter
 * ومسافةٍ من لوحة المفاتيح. والوجهان في خانةٍ واحدة من شبكة فيأخذ الأطولُ
 * ارتفاعَ البطاقة — لا ارتفاعٌ مكتوب يقصّ شريحةً على شاشةٍ ضيّقة.
 * وما في الظهر أمثلةٌ مكتوبة لا حساباتٌ حقيقيّة (القاعدة ٢٧٦).
 */
const SAMPLES: Record<string, { who: string; time: string; text: string; faces: string[] }> = {
  write: { who: "نورة", time: "٧:١٠ ص", text: "القهوة الأولى بعد السفر لها طعم ثاني", faces: ["love", "smile", "laugh"] },
  photo: { who: "فهد", time: "٥:٤٥ م", text: "غروب الكورنيش 🌅", faces: ["love", "camera", "gasp"] },
  music: { who: "سارة", time: "١١:٠٢ ص", text: "تسمع «ريحة الحبايب» — ماجد المدني", faces: ["love", "smile"] },
  place: { who: "خالد", time: "٩:٣٠ ص", text: "في مقهى عقل · الرياض", faces: ["pin", "smile", "chat"] },
  sleep: { who: "ريم", time: "١١:٣٠ م", text: "نامت — تصبحون على خير", faces: ["smile", "love"] },
  wake: { who: "نورة", time: "٦:١٥ ص", text: "صحت الساعة ٦:١٥ ص", faces: ["laugh", "smile"] },
};

export function PostCard({ kind, title, tags, delay }: { kind: string; title: string; tags: string[]; delay: number }) {
  const [open, setOpen] = useState(false);
  const sample = SAMPLES[kind];

  return (
    <article
      className={open ? "l-post l-post-flip on" : "l-post l-post-flip"}
      tabIndex={0}
      role="button"
      aria-pressed={open}
      aria-label={`${title} — اعرض مثالاً`}
      onClick={() => setOpen((v) => !v)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setOpen((v) => !v);
        }
      }}
    >
      <div className="l-post-card">
        <div className="l-post-face">
          {/* الرسمُ عائمٌ بلا قرصٍ ولا أرضية — بقرار المالك — يطفو بظلّه وحده. */}
          <div className="l-post-tile" aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/composer/${kind}.png`} alt="" width={88} height={88} style={{ animationDelay: `${delay}s` }} />
          </div>
          <div className="l-post-text">
            <h3 className="text-[17px] font-extrabold" style={{ fontFamily: "var(--font-display)" }}>
              {title}
            </h3>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <li key={tag} className="l-chip">
                  {tag}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {sample ? (
          <div className="l-post-face l-post-back" aria-hidden={!open}>
            <span className="text-[11px] font-semibold text-muted">كما تراها دائرتك</span>
            <div className="mt-3 flex items-start gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/composer/${kind}.png`} alt="" width={34} height={34} className="l-post-dot" />
              <div className="min-w-0">
                <span className="text-[13.5px] font-bold">{sample.who}</span>
                <span className="ms-2 text-[11px] text-muted">{sample.time}</span>
                <p className="l-post-bubble">{sample.text}</p>
                <span className="mt-2 flex">
                  {sample.faces.map((face) => (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img key={face} src={`/reactions/${face}.png`} alt="" width={22} height={22} className="l-post-face-rx" />
                  ))}
                </span>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
}
