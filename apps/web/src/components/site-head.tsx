"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * رأسُ الموقع العامّ: يصير زجاجاً حين يمرّ المحتوى تحته، وفي أسفله خطٌّ رفيع
 * يقول كم قُرئ من الصفحة، والقسمُ المفتوح تحته خطٌّ كهرمانيّ.
 *
 * كان الرأسُ يحمل «الخصوصية · الشروط» وحدهما، و«عن آثار» والمزايا وتواصل معنا
 * لا يبلغها إلا من نزل إلى الذيل. **والخصوصيةُ والشروطُ تبقيان ظاهرتين على كلّ
 * عرض** باسمهما الإنجليزيّ (القاعدة ١٧٨): مراجعُ تيك توك ردّ التطبيقَ حين لم
 * يجدهما. وما سواهما يظهر حيث يتّسع.
 */
const LINKS: { href: string; label: string; latin?: string; wide?: boolean; spy?: string }[] = [
  { href: "/", label: "الرئيسية", wide: true },
  { href: "/#why", label: "المزايا", wide: true, spy: "why" },
  { href: "/about", label: "عن آثار", wide: true },
  { href: "/contact", label: "تواصل معنا", wide: true },
  { href: "/privacy", label: "الخصوصية", latin: "Privacy" },
  { href: "/terms", label: "الشروط", latin: "Terms" },
];

export function SiteHead({ brand, action }: { brand: React.ReactNode; action: React.ReactNode }) {
  const path = usePathname();
  const [glass, setGlass] = useState(false);
  const [spied, setSpied] = useState<string | null>(null);
  const bar = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let frame = 0;
    const read = () => {
      frame = 0;
      const top = window.scrollY;
      const room = document.documentElement.scrollHeight - window.innerHeight;
      setGlass(top > 24);
      // التحويلُ لا العرض: لا يُعاد تخطيطُ الرأس مع كلّ حركة إصبع.
      if (bar.current) bar.current.style.transform = `scaleX(${room > 0 ? Math.min(1, top / room) : 0})`;
      if (path === "/") {
        const why = document.getElementById("why");
        setSpied(why && why.getBoundingClientRect().top < window.innerHeight * 0.4 && why.getBoundingClientRect().bottom > 80 ? "why" : null);
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [path]);

  const active = (link: (typeof LINKS)[number]) =>
    link.spy ? spied === link.spy : link.href === "/" ? path === "/" && !spied : path.startsWith(link.href);

  return (
    <header className={glass ? "site-head site-head-glass" : "site-head"}>
      <div className="l-wide flex items-center justify-between gap-3 py-3">
        {brand}
        <nav className="site-nav" aria-label="أقسام الموقع">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`${active(link) ? "site-nav-on " : ""}${link.wide ? "site-nav-wide" : ""}`}
              aria-current={active(link) ? "page" : undefined}
            >
              {link.latin ? (
                <>
                  <span className="hidden sm:inline">{link.label} · </span>
                  <span style={{ fontFamily: "var(--font-latin)" }}>{link.latin}</span>
                </>
              ) : (
                link.label
              )}
            </Link>
          ))}
        </nav>
        {action}
      </div>
      <span ref={bar} className="site-head-progress" aria-hidden />
    </header>
  );
}
