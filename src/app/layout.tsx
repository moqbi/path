import type { Metadata, Viewport } from "next";
import "./globals.css";
import { TAGLINE_AR, TAGLINE_EN } from "@/components/brand";
import { currentUser } from "@/lib/auth";
import { parsePalette, themeVars, veilOf } from "@/lib/theme";
import { NavProbe } from "@/components/nav";
import { BASE, asset } from "@/lib/base";
import { isDesktopRequest } from "@/lib/device";
import { FriendsPanel } from "@/components/desk/friends-panel";
import { MePanel } from "@/components/desk/me-panel";
import { DeskRefresh } from "@/components/desk/refresh";

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
  // سطح المكتب ثلاثة أعمدة (`.desk`)، والجوّال الهيكلُ وحده كما هو.
  const desk = user ? await isDesktopRequest() : false;

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
            ثلاثة أعمدة على سطح المكتب — **بقرار المالك**: الأصدقاء يميناً،
            والخطّ الزمنيّ في الوسط، و«أنا» مع الإشعارات يساراً. والوسطُ هو
            الهيكلُ نفسه بكلّ صفحاته، فما يُفتح فيه يُفتح كما على الجوّال.
            وتحت ١٢٠٠ بكسل يختفي العمودان ويعود الهيكلُ وحده.
          */
          // ألوانُ الثيم على الأعمدة الثلاثة لا على الوسط وحده.
          <div className="desk" style={palette ? themeVars(palette) : undefined}>
            <aside className="desk-side desk-side-start" aria-label="الأصدقاء">
              <FriendsPanel userId={user.id} />
            </aside>
            {shell}
            <aside className="desk-side desk-side-end" aria-label="أنا والإشعارات">
              <MePanel user={user} />
            </aside>
            <DeskRefresh />
          </div>
        ) : (
          shell
        )}
      </body>
    </html>
  );
}
