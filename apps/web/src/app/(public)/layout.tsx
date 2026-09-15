import Link from "next/link";
import { AthrMark } from "@/components/brand";

const LINKS = [
  { href: "/about", label: "عن أثر" },
  { href: "/privacy", label: "الخصوصية" },
  { href: "/terms", label: "الشروط" },
  { href: "/contact", label: "تواصل معنا" },
  { href: "/careers", label: "الوظائف" },
];

/**
 * إطار الصفحات العامة: رأسٌ بالعلامة، ثم الصفحة، ثم ذيلٌ بروابطها.
 *
 * والروابط في الذيل كاملةً لأنّ المتجرين يطلبان الوصول إلى الخصوصية
 * والشروط ووسيلة التواصل من أيّ صفحة — لا من الرئيسة وحدها.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="site">
      <header className="chrome">
        <div className="wrap flex items-center justify-between py-3.5">
          <Link href="/" className="flex items-center gap-2.5">
            <AthrMark size={34} />
            <span className="latin text-[19px] font-bold">ATHR</span>
          </Link>
          <nav className="no-bar flex items-center gap-4 overflow-x-auto text-[12.5px]">
            {LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="shrink-0 opacity-85">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="wrap grow py-10">{children}</main>

      <footer className="border-t border-line">
        <div className="wrap flex flex-wrap items-center justify-between gap-3 py-6 text-[11.5px] text-muted">
          <p>أثر · لحظاتك، مع ناسك.</p>
          <div className="flex flex-wrap gap-4">
            {LINKS.map((link) => (
              <Link key={link.href} href={link.href}>
                {link.label}
              </Link>
            ))}
            <Link href="/delete-account">حذف الحساب</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
