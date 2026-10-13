import Link from "next/link";
import { AthrMark, AthrWordmark } from "@/components/brand";
import { lines, siteImage, siteShots, siteText, storeUrl } from "@/lib/site";
import { ShotsCarousel } from "./shots-carousel";

/*
  أربع مزايا لا أكثر: ما يفعله المستخدم في التطبيق كل يوم.

  والأيقونة وحدها تبقى هنا — عنوانُها ومتنُها من اللوحة (`lib/site.ts`):
  رسمٌ في حقلِ نصٍّ لا يُحرَّر، والنصُّ في الكود لا يُصلَح إلا بنشر نسخة.
*/
const FEATURES = [
  {
    key: "moments",
    icon: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="3" />
        <path d="M3 15.5 L8.5 10.5 L13 14.5 L16 12 L21 16" />
        <circle cx="15.5" cy="9" r="1.4" />
      </>
    ),
  },
  {
    key: "stories",
    icon: (
      <>
        <path d="M5 4h10l4 4v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
        <path d="M15 4v4h4" />
        <path d="M8 13h8M8 17h5" />
      </>
    ),
  },
  {
    key: "circle",
    icon: (
      <>
        <circle cx="9" cy="9" r="3.2" />
        <path d="M3.5 19c0-3 2.5-4.8 5.5-4.8s5.5 1.8 5.5 4.8" />
        <path d="M16 6.4a3 3 0 0 1 0 5.6M17.5 19c0-2.2-.8-3.7-2-4.6" />
      </>
    ),
  },
  {
    key: "chat",
    icon: (
      <>
        <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7A2.5 2.5 0 0 1 17.5 16H9l-5 4Z" />
        <path d="M8 8.5h8M8 12h5" />
      </>
    ),
  },
  {
    key: "notes",
    icon: (
      <>
        <path d="M5 5.5A2.5 2.5 0 0 1 7.5 3h9A2.5 2.5 0 0 1 19 5.5v6a2.5 2.5 0 0 1-2.5 2.5H11l-3.5 3v-3a2.5 2.5 0 0 1-2.5-2.5Z" />
        <path d="M13 6.5v4.2a1.4 1.4 0 1 1-1-1.3V6.5l3-.8" />
        <circle cx="12" cy="20.5" r="0.8" />
      </>
    ),
  },
  {
    key: "store",
    icon: (
      <>
        <path d="M5 8h14l-1.2 11.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8Z" />
        <path d="M9 10V7a3 3 0 0 1 6 0v3" />
      </>
    ),
  },
  {
    key: "book",
    icon: (
      <>
        <path d="M12 6.5C10 5 7 4.5 4 5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5Z" />
        <path d="M12 6.5v13" />
      </>
    ),
  },
  {
    key: "plus",
    icon: (
      <path d="M12 3.5l2.4 5.2 5.6.6-4.2 3.8 1.2 5.6L12 15.9l-5 2.8 1.2-5.6L4 9.3l5.6-.6Z" />
    ),
  },
] as const;

/**
 * أزرار المتجرين — روابطُها من اللوحة («روابط تحميل التطبيق»).
 *
 * وبلا رابطٍ يبقى الزرّ شارةً بلا رابط، **بلا «قريباً»** بقرار المالك:
 * التطبيقُ في المتجر، ورابطٌ ميّتٌ أسوأ من لا رابط.
 */
function StoreButtons({
  tone = "light",
  ios,
  android,
}: {
  tone?: "light" | "dark";
  ios: string | null;
  android: string | null;
}) {
  const stores = [
    {
      name: "App Store",
      href: ios,
      sub: "حمّله من",
      icon: (
        <path d="M16.2 12.9c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.2-2.8.9-3.5.9s-1.8-.8-3-.8c-1.6 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7c1.3 0 2.1-1.1 2.8-2.3.9-1.3 1.3-2.6 1.3-2.7 0 0-2.5-1-2.5-3.7ZM14 5.9c.6-.8 1-1.9.9-3-.9 0-2 .6-2.7 1.4-.6.7-1.1 1.8-.9 2.9 1 0 2-.5 2.7-1.3Z" />
      ),
    },
    {
      name: "Google Play",
      href: android,
      sub: "حمّله من",
      icon: (
        <path d="M4.3 2.6a1 1 0 0 0-.5.9v17a1 1 0 0 0 .5.9l9.3-9.4ZM14.7 10.8l2.9-2.9-10.4-5.9a1 1 0 0 0-.5-.1ZM14.7 13.2l-8 8a1 1 0 0 0 .5-.1l10.4-5.9ZM18.7 8.6l-3.1 3.2 3.1 3.2 2.8-1.6c.8-.5.8-1.7 0-2.2Z" />
      ),
    },
  ];

  const dark = tone === "dark";

  return (
    <div className="flex flex-wrap gap-3">
      {stores.map((store) => {
        const look = {
          border: `1px solid ${dark ? "#223140" : "var(--color-line)"}`,
          background: dark ? "rgba(255,255,255,0.04)" : "var(--color-card)",
          color: dark ? "var(--color-chrome-ink)" : "var(--color-ink)",
        };
        const inner = (
          <>
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden>
              {store.icon}
            </svg>
            <span className="flex flex-col items-start leading-tight">
              <span className="text-[10px] opacity-70">{store.sub}</span>
              <span className="latin text-[13px] font-semibold" dir="ltr" style={{ letterSpacing: "0.04em" }}>
                {store.name}
              </span>
            </span>
          </>
        );
        return store.href ? (
          <a
            key={store.name}
            href={store.href}
            target="_blank"
            rel="noopener"
            className="flex items-center gap-3 rounded-2xl px-5 py-2.5 transition-transform hover:-translate-y-0.5"
            style={look}
          >
            {inner}
          </a>
        ) : (
          <span key={store.name} className="flex items-center gap-3 rounded-2xl px-5 py-2.5" style={look}>
            {inner}
          </span>
        );
      })}
    </div>
  );
}

function FeatureIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="l-why-icon">
      <svg
        viewBox="0 0 24 24"
        width="21"
        height="21"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {children}
      </svg>
    </span>
  );
}

/*
  رسومُ التفاعلات وقوسِ النشر من ملفّات المالك (`public/reactions` و
  `public/composer`) كما في التطبيق — استبدالُ الملفّ يغيّرها هنا أيضاً.
*/
const REACTIONS = ["smile", "love", "laugh", "gasp", "sad", "camera", "chat", "pin"] as const;
const POSTS = ["write", "photo", "music", "place", "sleep", "wake"] as const;

/** خاتمٌ يدور: نصٌّ على دائرة، وفي وسطه العلامة. */
function Stamp({ text, href }: { text: string; href?: string }) {
  const inner = (
    <>
      <svg viewBox="0 0 120 120" className="l-stamp-ring" aria-hidden>
        <defs>
          <path id="stamp-path" d="M60,60 m-44,0 a44,44 0 1,1 88,0 a44,44 0 1,1 -88,0" />
        </defs>
        <text>
          <textPath href="#stamp-path">{text.repeat(2)}</textPath>
        </text>
      </svg>
      <span className="l-stamp-core">
        <AthrMark size={30} />
      </span>
    </>
  );
  return href ? (
    <a href={href} className="l-stamp" aria-label="حمّل التطبيق">
      {inner}
    </a>
  ) : (
    <span className="l-stamp" aria-hidden>
      {inner}
    </span>
  );
}

export default async function LandingPage() {
  const text = await siteText();
  const hero = await siteImage("hero");
  // اللقطاتُ من اللوحة، وبلا صفٍّ فيها الثلاثُ الأصليّة (`DEFAULT_SHOTS`).
  const shots = await siteShots();
  const ios = storeUrl(text["store.ios"]);
  const android = storeUrl(text["store.android"]);

  return (
    <div className="landing">
      {/* ───────────── الرأس: بطاقةٌ وكلمةٌ عملاقة خلف الهاتف ───────────── */}
      <section>
        <div className="l-hero">
          {/*
            صورةُ الرأس من اللوحة تملأ البطاقة إن رُفعت، وبلاها أرضيةُ
            البطاقة وحدها — والكلمةُ العملاقة فوقهما في الحالين.
          */}
          {hero ? (
            <div aria-hidden className="l-hero-photo" style={{ backgroundImage: `url(/api/site-media/${hero})` }} />
          ) : null}
          <div aria-hidden className="l-giant rise rise-1">
            {text["hero.word"]}
          </div>

          <div className="l-hero-grid l-wide">
            <div className="l-hero-copy">
              <span className="l-eyebrow rise rise-2">
                <AthrWordmark size={13} color="var(--color-ink)" />
                <span className="opacity-60">·</span>
                آثار مومنتس
              </span>
              <h1 className="l-hero-line rise rise-2">{text["hero.line"]}</h1>
              {text["hero.latin"] ? (
                <p dir="ltr" className="latin rise rise-3 mt-2 text-right text-[13px] text-muted">
                  {text["hero.latin"]}
                </p>
              ) : null}
              <p className="rise rise-3 mt-5 max-w-md text-[15px] leading-[1.95] text-ink-2">{text["hero.body"]}</p>

              <div className="rise rise-4 mt-7 flex justify-start">
                <StoreButtons ios={ios} android={android} />
              </div>

              <div className="l-react-pill rise rise-5">
                <span className="l-faces">
                  {REACTIONS.slice(0, 5).map((r) => (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img key={r} src={`/reactions/${r}.png`} alt="" width={34} height={34} />
                  ))}
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="text-[13px] font-bold">{text["react.badge"]}</span>
                  <span className="text-[11.5px] text-muted">التفاعلات الأساسية لكل لحظة</span>
                </span>
              </div>
            </div>

            <div className="l-hero-art">
              <div className="rise rise-3 flex items-end">
                <figure className="l-phone l-phone-hero">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/shots/hero.webp" alt="الخط الزمني في آثار مومنتس" />
                </figure>
              </div>

              <div className="l-float l-float-moment rise rise-4" aria-hidden>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/composer/place.png" alt="" width={40} height={40} />
                <span className="flex flex-col leading-tight">
                  <span className="text-[13px] font-bold">في مقهى الحيّ</span>
                  <span className="text-[11.5px] text-muted">مع نورة وخالد · الآن</span>
                </span>
              </div>

              <div className="l-float l-float-music rise rise-5" aria-hidden>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/composer/music.png" alt="" width={40} height={40} />
                <span className="flex flex-col leading-tight">
                  <span className="text-[13px] font-bold">يسمع الآن</span>
                  <span className="text-[11.5px] text-muted">من سبوتيفاي · مع دائرته</span>
                </span>
              </div>

              <div className="l-float l-float-circle rise rise-5" aria-hidden>
                <span className="l-num">١٥٠</span>
                <span className="text-[11.5px] leading-snug text-ink-2">
                  صديقاً سقفُ دائرتك
                  <br />
                  ولا يُباع بأيّ مبلغ
                </span>
              </div>

              <div className="l-float-stamp rise rise-4">
                <Stamp text="حمّل التطبيق · لحظاتك مع ناسك · " href="#download" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────── ماذا تنشر ───────────── */}
      <section className="l-wide pt-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="l-title">{text["post.title"]}</h2>
            <p className="l-sub">{text["post.sub"]}</p>
          </div>
        </div>

        <div className="l-posts mt-8">
          {POSTS.map((key, index) => (
            <article key={key} className="l-post">
              {/* الرسمُ عائمٌ بلا قرصٍ ولا أرضية — بقرار المالك — يطفو بظلّه وحده. */}
              <div className="l-post-tile" aria-hidden>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/composer/${key}.png`} alt="" width={88} height={88} style={{ animationDelay: `${index * 0.4}s` }} />
              </div>
              <div className="l-post-text">
                <h3 className="text-[17px] font-extrabold" style={{ fontFamily: "var(--font-display)" }}>
                  {text[`post.${key}.title` as const]}
                </h3>
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {lines(text[`post.${key}.tags` as const]).map((tag) => (
                    <li key={tag} className="l-chip">
                      {tag}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ───────────── من داخل التطبيق ───────────── */}
      <section className="l-wide pt-20">
        <div className="l-banner">
          <ShotsCarousel shots={shots} />
          <div className="l-banner-cap">
            <span className="l-pill">من داخل التطبيق</span>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 sm:items-end">
              <h2 className="l-title" style={{ color: "var(--color-chrome-ink)" }}>
                {text["shots.title"]}
              </h2>
              <p className="text-[13.5px] leading-[1.9]" style={{ color: "#c9d2d9" }}>
                {text["shots.sub"]}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────── ليش آثار ───────────── */}
      <section className="l-wide pt-20">
        <div className="text-center">
          <h2 className="l-title">{text["why.title"]}</h2>
          <p className="l-sub mx-auto">{text["why.sub"]}</p>
        </div>

        <div className="l-why mt-10">
          <div className="l-why-art">
            <figure className="l-phone l-phone-why">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/shots/notes.webp" alt="الأصدقاء والنوت في آثار مومنتس" />
            </figure>
            <div className="l-why-stamp">
              <Stamp text={text["why.stamp"]} />
            </div>
          </div>

          <ul className="l-why-list">
            {FEATURES.map((feature, index) => (
              <li key={feature.key} className={index === 1 ? "l-why-item l-why-item-on" : "l-why-item"}>
                <FeatureIcon>{feature.icon}</FeatureIcon>
                <span>
                  <h3 className="text-[15px] font-extrabold" style={{ fontFamily: "var(--font-display)" }}>
                    {text[`feature.${feature.key}.title` as const]}
                  </h3>
                  <p className="mt-1 text-[13.5px] leading-[1.9] text-ink-2">
                    {text[`feature.${feature.key}.body` as const]}
                  </p>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ───────────── الخصوصية ───────────── */}
      <section className="l-wide pt-20">
        <div className="l-privacy">
          <div>
            <h2 className="l-title" style={{ color: "var(--color-chrome-ink)" }}>
              {text["privacy.title"]}
            </h2>
            <p className="mt-3 max-w-md text-[14px] leading-[1.95]" style={{ color: "#c9d2d9" }}>
              {text["privacy.body"]}
            </p>
            <p className="mt-6 text-[12.5px]" style={{ color: "var(--color-chrome-muted)" }}>
              التفاصيل كاملةً في{" "}
              <Link href="/privacy" className="font-semibold" style={{ color: "var(--color-gold-bright)" }}>
                سياسة الخصوصية
              </Link>
              .
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <ul className="flex flex-col gap-3">
              {lines(text["privacy.no"]).map((line) => (
                <li key={line} className="flex items-center gap-3 text-[14.5px]" style={{ color: "#e4e9ed" }}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#ff7a5a" strokeWidth="1.9" strokeLinecap="round" aria-hidden>
                    <circle cx="12" cy="12" r="9" />
                    <path d="M8.5 8.5 L15.5 15.5 M15.5 8.5 L8.5 15.5" />
                  </svg>
                  {line}
                </li>
              ))}
            </ul>
            <ul className="flex flex-col gap-3">
              {lines(text["privacy.yes"]).map((line) => (
                <li key={line} className="flex items-center gap-3 text-[14.5px]" style={{ color: "#e4e9ed" }}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#f6b93b" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <circle cx="12" cy="12" r="9" />
                    <path d="M8 12.3 L11 15.2 L16.2 9.2" />
                  </svg>
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ───────────── التفاعلات والتحميل ───────────── */}
      <section id="download" className="l-wide pb-20 pt-20">
        <div className="l-react">
          <div className="l-react-grid-wrap">
            <span className="l-react-badge">{text["react.badge"]}</span>
            <div className="l-react-grid">
              {REACTIONS.map((r, i) => (
                <span key={r} className="l-react-face" style={{ animationDelay: `${i * 0.35}s` }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/reactions/${r}.png`} alt="" width={64} height={64} />
                </span>
              ))}
            </div>
          </div>

          <div>
            <h2 className="l-title">{text["react.title"]}</h2>
            <p className="mt-3 max-w-md text-[14px] leading-[1.95] text-ink-2">{text["react.body"]}</p>

            <h3 className="mt-9 text-[20px] font-extrabold" style={{ fontFamily: "var(--font-display)" }}>
              {text["download.title"]}
            </h3>
            <p className="mt-1.5 max-w-md text-[13.5px] leading-[1.9] text-muted">{text["download.body"]}</p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <StoreButtons ios={ios} android={android} />
              <Link href="/contact" className="l-cta">
                {text["download.cta"]}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
