import type { Metadata, Viewport } from "next";
import "./globals.css";
import { TAGLINE_AR, TAGLINE_EN } from "@/components/brand";
import { currentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "أثر · ATHR",
  description: `${TAGLINE_AR} ${TAGLINE_EN}`,
};

export const viewport: Viewport = {
  themeColor: "#f7f5ef",
  width: "device-width",
  initialScale: 1,
};

/**
 * الثيم يُلبَس هنا لا في كل شاشة: صورةٌ تملأ الهيكل، وفوقها حجابٌ فاتح
 * يبقي النصّ مقروءاً. فيراها صاحبها في اللحظات والملف والأصدقاء
 * والإشعارات والرسائل — مكانٌ واحد يُضبط منه كل مكان.
 */
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await currentUser();
  const theme = user?.background ?? null;
  const image = theme?.mediaId ? `url(/api/media/${theme.mediaId})` : null;
  const veil = "linear-gradient(rgba(247,245,239,.82),rgba(247,245,239,.82))";
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
        <div
          className="shell"
          style={
            image
              ? { backgroundImage: `${veil}, ${image}`, backgroundSize: "cover", backgroundPosition: "center" }
              : theme
                ? { backgroundImage: `${veil}, ${theme.spec}` }
                : undefined
          }
        >
          {children}
        </div>
      </body>
    </html>
  );
}
