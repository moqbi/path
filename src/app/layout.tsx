import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
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

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // الوضع يُقرأ على الخادم فيُرسم صحيحاً من أول إطار بلا ومضة بيضاء.
  const theme = (await cookies()).get("athr:theme")?.value === "dark" ? "dark" : "light";

  return (
    <html lang="ar" dir="rtl" data-theme={theme}>
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
        <div className="shell">{children}</div>
      </body>
    </html>
  );
}
