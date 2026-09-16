import type { Metadata, Viewport } from "next";
import "./globals.css";
import { TAGLINE_AR, TAGLINE_EN } from "@/components/brand";
import { SITE_URL, hasSite } from "@athar/shared";

export const metadata: Metadata = {
  /*
    النطاق من البيئة لا من الكود: منه يكمّل Next كل رابطٍ نسبيّ في
    بطاقات المشاركة. وبلا نطاقٍ تبقى الروابط نسبيةً — تعمل الصفحة،
    ويبقى معاينُها بلا صورة حتى يُضبط `NEXT_PUBLIC_SITE_URL`.
  */
  metadataBase: hasSite() ? new URL(SITE_URL) : undefined,
  title: "آثار · ATHAR Moments",
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
 * تخطيط الويب الموحّد: المستند وخطوطه وحدها.
 *
 * والهيكل يُختار تحته: اللوحة في `(admin)` تلبس هيكل الهاتف، والصفحات
 * العامة في `(public)` تأخذ عرض الصفحة كاملاً. ولا ثيمَ مشترٍ هنا —
 * الثيم ثوبٌ يلبسه صاحبه ليرى لحظاته به، وهذا موقعٌ يُقرأ كما هو في كل
 * حساب.
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
      <body>{children}</body>
    </html>
  );
}
