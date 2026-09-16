import Link from "next/link";
import { AthrMark, AthrWordmark } from "@/components/brand";
import { FollowRow } from "@/components/social";
import { siteText, socialLinks } from "@/lib/site";

const COLUMNS = [
  {
    title: "المنتج",
    links: [
      { href: "/#download", label: "حمّل التطبيق" },
      { href: "/about", label: "عن آثار" },
      { href: "/careers", label: "الوظائف" },
    ],
  },
  {
    title: "القانوني",
    links: [
      { href: "/privacy", label: "سياسة الخصوصية" },
      { href: "/terms", label: "شروط الاستخدام" },
      { href: "/delete-account", label: "حذف الحساب" },
    ],
  },
  {
    title: "التواصل",
    links: [{ href: "/contact", label: "اتصل بنا" }],
  },
];

/**
 * إطار الصفحات العامة: رأسٌ بالعلامة وفعلٍ واحد، ثم الصفحة، ثم ذيلٌ
 * بأعمدته.
 *
 * والفعل واحد في الرأس («حمّل التطبيق») لا ثلاثة تتنافس — وما عداه
 * يُبحث عنه في الذيل. والقانونيّ والتواصلُ وحذفُ الحساب في كل صفحة
 * لأنّ المتجرين يطلبان الوصول إليها من أيّ مكان لا من الرئيسة وحدها.
 */
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const [text, follow] = await Promise.all([siteText(), socialLinks()]);

  return (
    <div className="site">
      <header className="site-head">
        <div className="wrap flex items-center justify-between py-3">
          {/*
            الاسم كاملاً حيث يتّسع، ومختصراً حيث لا يتّسع.

            الرأس يحمل زرّ التحميل بجانبه، فعلى شاشةٍ ٣٢٠ لا يبقى للاسم
            إلا نحو مئةٍ وعشرين بكسلاً — «ATHAR Moments» فيها تُقصّ من
            أوّلها فتُقرأ «HAR Moments». قيس فعلاً. فالكامل من `sm` فما
            فوق، والمختصر تحتها، والذيلُ والبطلُ يحملان الكامل دائماً.
          */}
          <Link href="/" className="flex items-center gap-2.5" aria-label="آثار مومنتس">
            <AthrMark size={32} />
            <span className="flex min-w-0 flex-col leading-none">
              <span className="hidden sm:block">
                <AthrWordmark size={15} />
              </span>
              <span className="latin text-[14px] font-bold sm:hidden">ATHAR</span>
              <span
                className="mt-1 whitespace-nowrap text-[10px] opacity-75"
                style={{ letterSpacing: "0.2em" }}
              >
                آثار<span className="hidden sm:inline"> مومنتس</span>
              </span>
            </span>
          </Link>

          <Link
            href="/#download"
            className="flex h-9 items-center gap-1.5 rounded-full px-4 text-[12.5px] font-bold"
            style={{ background: "var(--color-clay)", color: "var(--color-on-brand)" }}
          >
            حمّل التطبيق
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M19 12H5M11 6l-6 6 6 6" />
            </svg>
          </Link>
        </div>
      </header>

      <main className="grow">{children}</main>

      <footer className="site-foot">
        <div className="wrap py-12">
          <div className="flex flex-wrap justify-between gap-10">
            <div className="flex items-start gap-3">
              <AthrMark size={40} />
              <div className="flex flex-col leading-none">
                <AthrWordmark size={17} />
                <span className="mt-1.5 text-[11px] opacity-75" style={{ letterSpacing: "0.2em" }}>
                  آثار مومنتس
                </span>
                <span className="mt-3 text-[11.5px]" style={{ color: "var(--color-chrome-muted)" }}>
                  {text["foot.tagline"]}
                </span>
              </div>
            </div>

            {/*
              «تابعنا» بجانب أعمدة الروابط لا تحتها: الأيقونات تُلمح
              بالعين ولا تُقرأ سطراً سطراً، فمكانها حيث تُرى لا حيث
              ينتهي النصّ. وروابطُها صفوفٌ في القاعدة تُدار من اللوحة.
            */}
            <nav className="flex flex-wrap gap-x-14 gap-y-8">
              <FollowRow title={text["foot.follow"]} links={follow} />
              {COLUMNS.map((column) => (
                <div key={column.title} className="flex flex-col gap-2.5">
                  <h2 className="text-[12px] font-bold" style={{ color: "var(--color-gold-bright)" }}>
                    {column.title}
                  </h2>
                  {column.links.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="text-[12.5px]"
                      style={{ color: "#cdd6dd" }}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              ))}
            </nav>
          </div>

          <hr className="my-8" style={{ borderColor: "var(--color-chrome-line)" }} />

          <p className="text-[11.5px]" style={{ color: "var(--color-chrome-muted)" }}>
            {text["foot.rights"]}
          </p>
        </div>
      </footer>
    </div>
  );
}
