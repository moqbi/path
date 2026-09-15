import type { Metadata, Viewport } from "next";
import "./globals.css";
import { TAGLINE_AR, TAGLINE_EN } from "@/components/brand";
import { NavProbe } from "@/components/nav";

export const metadata: Metadata = {
  title: "أثر · لوحة التحكم",
  description: `${TAGLINE_AR} ${TAGLINE_EN}`,
  icons: { icon: "/icon.png", apple: "/apple-icon.png" },
  /* لوحةٌ لا صفحةَ هبوط: لا تُفهرس. */
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#f7f5ef",
  width: "device-width",
  initialScale: 1,
};

/**
 * تخطيط الويب الموحّد.
 *
 * وليس فيه ثيمُ المشتري كما في التطبيق: الثيم ثوبٌ يلبسه صاحبه ليرى
 * لحظاته به، واللوحة أداةُ عمل — ألوانها ثابتة حتى يُقرأ ما فيها كما
 * هو في كل حساب.
 */
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&family=Tajawal:wght@500;700;800&family=Montserrat:wght@500;600;700&display=swap"
        />
      </head>
      <body>
        <div className="shell">
          <NavProbe />
          {children}
        </div>
      </body>
    </html>
  );
}
