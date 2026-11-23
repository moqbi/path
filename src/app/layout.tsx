import type { Metadata, Viewport } from "next";
import { MoodSheet } from "@/components/mood-sheet";
import "./globals.css";
import { TAGLINE_AR, TAGLINE_EN } from "@/components/brand";
import { currentUser } from "@/lib/auth";
import { canTryStickers } from "@/lib/stickers";
import { OfflineBanner } from "@/components/offline-banner";
import { OpeningPromo } from "@/components/opening-promo";
import { parsePalette, themeVars, veilOf } from "@/lib/theme";
import { NavProbe } from "@/components/nav";
import { BASE, asset } from "@/lib/base";
import { isDesktopRequest } from "@/lib/device";
import { headers } from "next/headers";
import { DeskRail } from "@/components/desk/rail";
import { DeskDetail, EmbedGuard } from "@/components/desk/detail";
import { DeskRefresh } from "@/components/desk/refresh";
import { unreadCount } from "@/lib/dm";
import { unseenCount } from "@/lib/notifications";

export const metadata: Metadata = {
  title: "آثار مومنتس · ATHAR Moments",
  description: `${TAGLINE_AR} ${TAGLINE_EN}`,
  /* أيقونة التبويب والاختصار على الشاشة الرئيسة: العلامة نفسها. */
  icons: {
    icon: asset("/icon.png"),
    apple: asset("/apple-icon.png"),
  },
};

export const viewport: Viewport = {
  themeColor: "#f7f5ef",
  width: "device-width",
  initialScale: 1,
};

/**
 * الثيم يُلبَس هنا لا في كل شاشة.
 *
 * وهو ثوبٌ كامل لا خلفية: صورةٌ تملأ الهيكل وفوقها حجابٌ من لون أرضيته،
 * ومعها ألوان التطبيق كلها — البطاقات والحبر واللمسة والشريطان — تُكتب
 * متغيّراتِ CSS على الهيكل فترثها كل شاشة تحته. مكانٌ واحد يُضبط منه
 * كل مكان.
 */
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await currentUser();
  const theme = user?.background ?? null;
  const image = theme?.mediaId ? `url(${BASE}/api/media/${theme.mediaId})` : null;
  const palette = parsePalette(theme?.palette);
  // حجابٌ خفيف: يكفي لقراءة النصّ ولا يطمس الصورة. أعلى من هذا كان يخفيها.
  const veil = veilOf(palette);
  // سطح المكتب شريطٌ وهيكلٌ ولوحةُ لحظة (`.desk`)، والجوّال الهيكلُ وحده كما هو.
  // والصفحةُ داخل اللوحة نفسها (إطار) هيكلٌ وحده: لا لوحةَ داخل لوحة.
  const framed = (await headers()).get("sec-fetch-dest") === "iframe";
  const desk = user && !framed ? await isDesktopRequest() : false;
  const [unread, unseen] = desk && user ? await Promise.all([unreadCount(user.id), unseenCount(user.id)]) : [0, 0];

  const shell = (
    <div
      className="shell"
      style={{
        ...(palette ? themeVars(palette) : null),
        ...(image
          ? { backgroundImage: `${veil}, ${image}`, backgroundSize: "cover", backgroundPosition: "center" }
          : theme
            ? { backgroundImage: `${veil}, ${theme.spec}` }
            : null),
      }}
    >
      <NavProbe />
      <EmbedGuard />
      {/* «ما فيه اتصال» (القاعدة ٣٢١) — للمالك وممنوحي اللوحة كلّها كنسخة التطوير. */}
      {user && canTryStickers(user) ? <OfflineBanner /> : null}
      {/* بطاقةُ الإعلان عند الفتح (القاعدتان ٢٦٧ و٣٣٥). */}
      {user ? <OpeningPromo coins={user.coins} isPlus={user.isPlus} /> : null}
      {/* «مود» و«سؤال» نافذتان في الجذر يفتحهما قوسُ النشر (القاعدة ٤٨٤). */}
      {user ? <MoodSheet /> : null}
      {children}
    </div>
  );

  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* خطوط الهوية: Tajawal للعربي، Montserrat للاتيني. */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&family=Tajawal:wght@500;700;800&family=Montserrat:wght@500;600;700&display=swap"
        />
      </head>
      <body>
        {desk && user ? (
          /*
            سطح المكتب — **بقرار المالك** (القاعدة ٤٥٦): شريطُ أيقوناتٍ في طرف
            البداية، فالهيكلُ نفسه بكلّ صفحاته، فلوحةُ اللحظة المختارة. وتحت
            ١٢٠٠ بكسل يختفي الشريطُ واللوحة ويعود الهيكلُ وحده.
          */
          // ألوانُ الثيم على الثلاثة لا على الهيكل وحده.
          <div className="desk" style={palette ? themeVars(palette) : undefined}>
            <DeskRail me={{ name: user.name, avatarMediaId: user.avatarMediaId }} unread={unread} unseen={unseen} />
            {shell}
            <DeskDetail />
            <DeskRefresh />
          </div>
        ) : (
          shell
        )}
      </body>
    </html>
  );
}
