import type { Metadata, Viewport } from "next";
import "./globals.css";
import { TAGLINE_AR, TAGLINE_EN } from "@/components/brand";

export const metadata: Metadata = {
  title: "أثر · ATHR",
  description: `${TAGLINE_AR} ${TAGLINE_EN}`,
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
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
        <link rel="preconnect" href="https://cdn.fontshare.com" crossOrigin="" />
        {/* Cairo للعربي من جوجل، وSatoshi للاتيني من Fontshare — كلاهما في دليل الهوية. */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f%5B%5D=satoshi@400,500,700&display=swap"
        />
      </head>
      <body>
        <div className="shell">{children}</div>
      </body>
    </html>
  );
}
