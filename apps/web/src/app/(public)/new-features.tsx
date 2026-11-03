import { AthrMark } from "@/components/brand";

/*
  «آثار تكبر معك» (القاعدة ٤١٥): ستُّ بطاقاتٍ للمزايا الجديدة، لكلٍّ رسمٌ
  صغيرٌ بـCSS يقول الميزة قبل أن تُقرأ — رادارٌ، وخريطةٌ بنقاطها، وجدارُ
  معرض، وكتاب، وملصقات، وتقويم. النصوصُ من اللوحة (`new.*` في `lib/site.ts`)،
  والرسومُ هنا لا في القاعدة (القاعدة ١١٠). وما فيها من أسماءٍ أمثلةٌ مكتوبة
  لا حساباتٌ حقيقيّة.
*/

type Key = "nearby" | "map" | "gallery" | "book" | "stickers" | "memories";
export const NEW_KEYS: Key[] = ["nearby", "map", "gallery", "book", "stickers", "memories"];

function Nearby() {
  const faces = [
    { t: "ن", x: "22%", y: "28%", d: "0s" },
    { t: "خ", x: "72%", y: "34%", d: "0.6s" },
    { t: "س", x: "60%", y: "76%", d: "1.2s" },
  ];
  return (
    <div className="n-radar" aria-hidden>
      <span className="n-ring" />
      <span className="n-ring" style={{ animationDelay: "0.9s" }} />
      <span className="n-ring" style={{ animationDelay: "1.8s" }} />
      <span className="n-core">
        <AthrMark size={22} />
      </span>
      {faces.map((f) => (
        <span key={f.t} className="n-face" style={{ insetInlineStart: f.x, top: f.y, animationDelay: f.d }}>
          {f.t}
        </span>
      ))}
      <span className="n-chips">
        <span>البلوتوث</span>
        <span>الموقع</span>
      </span>
    </div>
  );
}

function MapArt() {
  const pins = [
    { name: "الرياض", n: "٤٢", x: "50%", y: "50%", big: true },
    { name: "جدة", n: "١٨", x: "20%", y: "66%" },
    { name: "دبي", n: "٧", x: "82%", y: "38%" },
    { name: "العُلا", n: "٥", x: "22%", y: "30%" },
  ];
  return (
    <div className="n-map" aria-hidden>
      <svg viewBox="0 0 300 170" preserveAspectRatio="none" className="n-map-land">
        <path d="M18 120 C40 70, 90 40, 150 46 S250 30, 288 70 L288 170 L18 170 Z" />
        <path d="M60 150 C90 120, 140 128, 170 110 S240 96, 280 120" className="n-map-road" />
      </svg>
      {pins.map((p) => (
        // الجغرافيا لا تنقلب مع اتجاه الصفحة: جدة غرباً ودبي شرقاً.
        <span key={p.name} className="n-pin" style={{ left: p.x, top: p.y }}>
          <span className={p.big ? "n-pin-dot n-pin-big" : "n-pin-dot"} />
          <span className="n-pin-cap">
            {p.name} <b>{p.n}</b>
          </span>
        </span>
      ))}
    </div>
  );
}

function Gallery() {
  return (
    <div className="n-wall" aria-hidden>
      <span className="n-sign">جدار أكتوبر</span>
      <div className="n-frames">
        <span className="n-frame n-frame-side">
          <span className="n-canvas" style={{ background: "linear-gradient(160deg,#f6b93b,#ff7a5a)" }} />
        </span>
        <span className="n-frame n-frame-main">
          <span className="n-lamp" />
          <span className="n-canvas" style={{ background: "linear-gradient(160deg,#1f3b4d,#5b8aa6 60%,#f6d58b)" }} />
        </span>
        <span className="n-frame n-frame-side">
          <span className="n-canvas n-canvas-text">صحيت ٦:٣٠</span>
        </span>
      </div>
      <span className="n-floor" />
    </div>
  );
}

function Book() {
  return (
    <div className="n-book-stage" aria-hidden>
      <span className="n-book">
        <span className="n-book-spine" />
        <span className="n-book-face">
          <AthrMark size={22} />
          <span className="n-book-year">٢٠٢٦</span>
          <span className="n-book-title">سنتي في آثار</span>
        </span>
      </span>
      <span className="n-book-page">
        <span className="n-book-day">٥</span>
        <span className="n-book-line" />
        <span className="n-book-line n-short" />
        <span className="n-book-pdf">PDF</span>
      </span>
    </div>
  );
}

function Stickers({ stickers }: { stickers: string[] }) {
  // ملصقاتٌ حقيقيّة من اللوحة (القاعدة ٤١٧)، وبلاها رسومُ التطبيق.
  const art = stickers.length
    ? stickers.map((id) => `/api/site-media/${id}`)
    : ["/reactions/love.png", "/composer/music.png", "/reactions/laugh.png", "/composer/wake.png", "/reactions/smile.png", "/composer/place.png"];
  return (
    <div className="n-stickers" aria-hidden>
      {art.map((src, i) => (
        <span key={src} className="n-sticker" style={{ animationDelay: `${i * 0.3}s`, rotate: `${(i % 2 ? 1 : -1) * (4 + i)}deg` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" width={56} height={56} loading="lazy" />
        </span>
      ))}
    </div>
  );
}

function Memories() {
  // أكتوبر ٢٠٢٦ يبدأ الخميس — والنقاطُ بألوان التقويم (القاعدة ٢٩٢).
  const dots: Record<number, string> = { 1: "#3d9a5f", 9: "#e48aa4", 14: "#4a7fd1", 21: "#e48aa4", 30: "#c9962b" };
  const cells = [...Array(4).fill(0), ...Array.from({ length: 31 }, (_, i) => i + 1)];
  return (
    <div className="n-cal" aria-hidden>
      <span className="n-cal-head">أكتوبر</span>
      <div className="n-cal-grid">
        {cells.map((d, i) => (
          <span key={i} className={d === 14 ? "n-day n-today" : "n-day"}>
            {d ? d.toLocaleString("ar-SA-u-nu-arab") : ""}
            {d && dots[d] ? <i style={{ background: dots[d] }} /> : null}
          </span>
        ))}
      </div>
      <span className="n-cal-note">في مثل هذا اليوم · قبل سنة</span>
    </div>
  );
}

const ART: Record<Key, (p: { stickers: string[] }) => React.ReactElement> = {
  nearby: Nearby,
  map: MapArt,
  gallery: Gallery,
  book: Book,
  stickers: Stickers,
  memories: Memories,
};

export function NewFeatures({ text, stickers }: { text: Record<string, string>; stickers: string[] }) {
  return (
    <section className="l-wide pt-20">
      <div className="text-center">
        <h2 className="l-title">{text["new.title"]}</h2>
        <p className="l-sub mx-auto">{text["new.sub"]}</p>
      </div>
      <div className="n-grid mt-10">
        {NEW_KEYS.map((key) => {
          const Art = ART[key];
          return (
            <article key={key} className="n-card">
              <div className="n-art">
                <Art stickers={stickers} />
              </div>
              <div className="n-copy">
                <h3 className="text-[17px] font-extrabold" style={{ fontFamily: "var(--font-display)" }}>
                  {text[`new.${key}.title`]}
                </h3>
                <p className="mt-1.5 text-[13.5px] leading-[1.9] text-ink-2">{text[`new.${key}.body`]}</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
