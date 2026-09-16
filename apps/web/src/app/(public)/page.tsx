import Link from "next/link";
import { AthrMark, TAGLINE_AR, TAGLINE_EN } from "@/components/brand";
import { HeroArt } from "./hero-art";
import { MomentsShot, CircleShot, StoriesShot, ChatShot } from "./shots";

/** أربع مزايا لا أكثر: ما يفعله المستخدم في التطبيق كل يوم. */
const FEATURES = [
  {
    key: "moments",
    title: "اللحظات",
    body: "صورة، فكرة، مكان، أغنية — سطرٌ صغير يقول أين أنت اليوم.",
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
    title: "القصص",
    body: "صورة أو فيديو يراه أصدقاؤك يوماً ثم يذهب — لا يدخل الخط الزمني.",
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
    title: "الدائرة",
    body: "مئةٌ وخمسون صديقاً سقفاً لا يُباع. بلا متابعين، وبلا غرباء.",
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
    title: "المحادثات",
    body: "نصّ وصورة وصوت، بإيصالٍ يقول وصلت وقُرئت — وتُكنس بعد شهر.",
    icon: (
      <>
        <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7A2.5 2.5 0 0 1 17.5 16H9l-5 4Z" />
        <path d="M8 8.5h8M8 12h5" />
      </>
    ),
  },
] as const;

const SHOTS = [
  { key: "moments", label: "الخط الزمني", node: <MomentsShot /> },
  { key: "circle", label: "الدائرة", node: <CircleShot /> },
  { key: "stories", label: "القصص", node: <StoriesShot /> },
  { key: "chat", label: "المحادثات", node: <ChatShot /> },
] as const;

const PRIVACY_NO = [
  "لا نبيع بياناتك",
  "لا نتبعك خارج التطبيق",
  "لا نعرض إعلانات",
];

const PRIVACY_YES = [
  "دائرة محدودة — ١٥٠ صديقاً",
  "أنت من يقرّر من يرى ماذا",
  "لا متابعين، ولا عدّاد إعجابات",
];

/**
 * أزرار المتجرين.
 *
 * التطبيق لم يُنشر بعد، فالزرّ يقول «قريباً» ولا يحمل رابطاً: رابطٌ ميّت
 * إلى المتجر أسوأ من لا رابط. ويُستبدل الوسم بالرابط يوم النشر.
 */
function StoreButtons({ tone = "light" }: { tone?: "light" | "dark" }) {
  const stores = [
    {
      name: "App Store",
      sub: "حمّله من",
      icon: (
        <path d="M16.2 12.9c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.2-2.8.9-3.5.9s-1.8-.8-3-.8c-1.6 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7c1.3 0 2.1-1.1 2.8-2.3.9-1.3 1.3-2.6 1.3-2.7 0 0-2.5-1-2.5-3.7ZM14 5.9c.6-.8 1-1.9.9-3-.9 0-2 .6-2.7 1.4-.6.7-1.1 1.8-.9 2.9 1 0 2-.5 2.7-1.3Z" />
      ),
    },
    {
      name: "Google Play",
      sub: "حمّله من",
      icon: (
        <path d="M4.3 2.6a1 1 0 0 0-.5.9v17a1 1 0 0 0 .5.9l9.3-9.4ZM14.7 10.8l2.9-2.9-10.4-5.9a1 1 0 0 0-.5-.1ZM14.7 13.2l-8 8a1 1 0 0 0 .5-.1l10.4-5.9ZM18.7 8.6l-3.1 3.2 3.1 3.2 2.8-1.6c.8-.5.8-1.7 0-2.2Z" />
      ),
    },
  ];

  const dark = tone === "dark";

  return (
    <div className="flex flex-wrap justify-center gap-3">
      {stores.map((store) => (
        <span
          key={store.name}
          className="flex items-center gap-3 rounded-2xl px-5 py-2.5"
          style={{
            border: `1px solid ${dark ? "#223140" : "var(--color-line)"}`,
            background: dark ? "rgba(255,255,255,0.04)" : "var(--color-card)",
            color: dark ? "var(--color-chrome-ink)" : "var(--color-ink)",
          }}
        >
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden>
            {store.icon}
          </svg>
          <span className="flex flex-col items-start leading-tight">
            <span className="text-[10px] opacity-70">{store.sub}</span>
            <span className="latin text-[13px] font-semibold" dir="ltr" style={{ letterSpacing: "0.04em" }}>
              {store.name}
            </span>
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-bold"
            style={{
              background: dark ? "rgba(246,185,59,0.16)" : "var(--color-gold-soft)",
              color: dark ? "var(--color-gold-bright)" : "var(--color-clay-ink)",
            }}
          >
            قريباً
          </span>
        </span>
      ))}
    </div>
  );
}

function FeatureIcon({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="flex h-11 w-11 items-center justify-center rounded-2xl"
      style={{ background: "var(--color-gold-soft)", color: "var(--color-clay-ink)" }}
    >
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

export default function LandingPage() {
  return (
    <>
      {/* ───────────── الرأس ───────────── */}
      <section className="hero">
        <HeroArt />

        <div className="hero-inner">
          <AthrMark size={96} />

          <div className="mt-5 flex flex-col items-center gap-1">
            <span
              className="latin whitespace-nowrap text-[24px] font-bold leading-none sm:text-[38px]"
              style={{ color: "var(--color-chrome-ink)" }}
            >
              ATHAR Moments
            </span>
            <span
              className="text-[14px] font-medium sm:text-[15px]"
              style={{ color: "var(--color-chrome-ink)", letterSpacing: "0.22em" }}
            >
              آثار مومنتس
            </span>
          </div>

          <h1
            className="mt-8 text-[40px] leading-[1.25] sm:text-[52px]"
            style={{ fontFamily: "var(--font-display)", fontWeight: 800, color: "var(--color-chrome-ink)" }}
          >
            {TAGLINE_AR}
          </h1>
          <p dir="ltr" className="latin mt-3 text-[13px]" style={{ color: "#c2b6a6" }}>
            {TAGLINE_EN}
          </p>

          <p className="mt-6 max-w-lg text-[15.5px] leading-[1.95]" style={{ color: "#cbd3da" }}>
            شبكةٌ اجتماعية عربية حميمية. دائرةٌ محدودة، وخصوصيةٌ كاملة —
            لحظاتك مع ناسك، لا للعالم.
          </p>

          <div className="mt-8">
            <StoreButtons tone="dark" />
          </div>
        </div>
      </section>

      {/* ───────────── المزايا ───────────── */}
      <section className="wrap py-16">
        <h2 className="section-title">ما الذي في آثار</h2>
        <p className="section-sub">أربعة أشياء تُفعل كل يوم — ولا خامس يزاحمها.</p>

        <div className="mt-8 grid gap-3.5 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <article key={feature.key} className="feature-card">
              <FeatureIcon>{feature.icon}</FeatureIcon>
              <h3 className="mt-4 text-[16px] font-bold">{feature.title}</h3>
              <p className="mt-1.5 text-[13.5px] leading-[1.95] text-ink-2">{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ───────────── من داخل التطبيق ───────────── */}
      <section className="wrap pb-16">
        <h2 className="section-title">من داخل التطبيق</h2>
        <p className="section-sub">الشاشات كما هي — بلا تجميلٍ لا تراه حين تفتحه.</p>

        <div className="no-bar mt-8 flex justify-start gap-4 overflow-x-auto pb-2 lg:justify-center">
          {SHOTS.map((shot) => (
            <figure key={shot.key} className="flex shrink-0 flex-col items-center gap-2.5">
              <div className="phone">{shot.node}</div>
              <figcaption className="text-[12px] font-semibold text-muted">{shot.label}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* ───────────── الخصوصية ───────────── */}
      <section className="band">
        <div className="wrap py-16">
          <h2
            className="text-[30px] font-bold"
            style={{ fontFamily: "var(--font-display)", color: "var(--color-chrome-ink)" }}
          >
            خصوصيةٌ أولاً.
          </h2>
          <p className="mt-2 max-w-xl text-[14px] leading-[1.95]" style={{ color: "var(--color-chrome-muted)" }}>
            ليست وعداً في صفحة، بل قرارٌ في البناء: لا استكشاف، ولا بحثَ يصل
            إليك، ولا طرفٍ ثالثٍ يقرأ ما تنشره.
          </p>

          <div className="mt-8 grid gap-8 sm:grid-cols-2">
            <ul className="flex flex-col gap-3">
              {PRIVACY_NO.map((line) => (
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
              {PRIVACY_YES.map((line) => (
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

          <p className="mt-9 text-[12.5px]" style={{ color: "var(--color-chrome-muted)" }}>
            التفاصيل كاملةً في{" "}
            <Link href="/privacy" className="font-semibold" style={{ color: "var(--color-gold-bright)" }}>
              سياسة الخصوصية
            </Link>
            .
          </p>
        </div>
      </section>

      {/* ───────────── التحميل ───────────── */}
      <section id="download" className="wrap py-16 text-center">
        <h2 className="text-[28px] font-bold" style={{ fontFamily: "var(--font-display)" }}>
          جاهزٌ للانطلاق؟
        </h2>
        <p className="mx-auto mt-2 max-w-md text-[14px] leading-[1.95] text-muted">
          آثار يصل المتجرين قريباً. وحتى ذلك الحين، اكتب لنا إن أردت أن تكون من
          أوّل من يجرّبه.
        </p>

        <div className="mt-7">
          <StoreButtons />
        </div>

        <Link
          href="/contact"
          className="mt-5 inline-flex h-11 items-center rounded-xl px-5 text-[13px] font-bold"
          style={{ background: "var(--color-clay)", color: "var(--color-on-brand)" }}
        >
          اكتب لنا
        </Link>
      </section>
    </>
  );
}
