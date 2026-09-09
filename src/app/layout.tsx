import type { Metadata, Viewport } from "next";
import "./globals.css";
import { TAGLINE_AR, TAGLINE_EN } from "@/components/brand";

export const metadata: Metadata = {
  title: "أثر · ATHR",
  description: `${TAGLINE_AR} ${TAGLINE_EN}`,
};

export const viewport: Viewport = {
  themeColor: "#f7f5ef",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* خطوط الهوية: Tajawal للعربي، Montserrat للاتيني. */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800&family=Montserrat:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>
        <div className="shell">{children}</div>
      </body>
    </html>
  );
}
