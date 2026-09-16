/**
 * أيقونات التواصل — «تابعنا».
 *
 * الرسوم هنا لا في القاعدة: صفُّ الرابط يحمل اسم المنصّة والعنوان، وهما
 * ما يتغيّر. والرسم ثابتٌ لكلّ منصّة، ولو خُزّن SVG في حقلِ نصٍّ لصار
 * حقلاً يُلصق فيه أيّ شيء ويُرسم في صفحةٍ عامّة.
 *
 * وما لا نعرف منصّته يأخذ حلقةَ رابطٍ عامّة — فلا يُمنع المشرف من إضافة
 * ما لم نتوقّعه.
 */
const PATHS: Record<string, React.ReactNode> = {
  x: <path d="M17.5 3h3l-6.6 7.5L21.8 21h-6l-4.7-6.1L5.6 21H2.5l7-8L2.3 3h6.2l4.2 5.6ZM16.4 19.2h1.7L7.7 4.7H5.9Z" />,
  instagram: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17.2" cy="6.8" r="1.2" />
    </>
  ),
  snapchat: (
    <path d="M12 2.6c2.7 0 4.5 2 4.5 4.6 0 .7-.1 1.5-.1 2 .3.2.8.3 1.3.1.6-.2 1 .5.6.9-.4.4-1.3.7-1.8.9-.3.1-.4.3-.3.6.5 1.5 2 2.8 3.3 3.1.5.1.5.7 0 .9-.7.3-1.7.4-2 .6-.2.1-.1.5-.3.8-.1.2-.4.3-.8.2-.5-.1-1.1-.2-1.8 0-.6.1-1.1.6-1.8 1-.5.3-1.1.5-1.8.5s-1.3-.2-1.8-.5c-.7-.4-1.2-.9-1.8-1-.7-.2-1.3-.1-1.8 0-.4.1-.7 0-.8-.2-.2-.3-.1-.7-.3-.8-.3-.2-1.3-.3-2-.6-.5-.2-.5-.8 0-.9 1.3-.3 2.8-1.6 3.3-3.1.1-.3 0-.5-.3-.6-.5-.2-1.4-.5-1.8-.9-.4-.4 0-1.1.6-.9.5.2 1 .1 1.3-.1 0-.5-.1-1.3-.1-2 0-2.6 1.8-4.6 4.5-4.6Z" />
  ),
  tiktok: <path d="M16.5 3c.3 2.2 1.6 3.6 3.8 3.8v2.7c-1.3.1-2.5-.3-3.8-1v5.9c0 4.5-4.9 6.9-8.3 4.5-2.9-2-2.9-6.4.2-8.2 1-.6 2.2-.8 3.4-.6v2.8c-1.6-.4-2.9.5-2.9 2 0 1.6 1.7 2.5 3 1.8.8-.4 1.1-1.2 1.1-2.2V3Z" />,
  youtube: (
    <>
      <rect x="2.5" y="5.5" width="19" height="13" rx="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M10.4 9.4 15 12l-4.6 2.6Z" />
    </>
  ),
  whatsapp: (
    <path d="M12 3a9 9 0 0 0-7.7 13.6L3 21l4.5-1.2A9 9 0 1 0 12 3Zm4.8 12.4c-.2.6-1.2 1.1-1.7 1.1-.4 0-1 .1-3-.8-2.5-1.1-4-3.7-4.2-3.9-.1-.2-.9-1.3-.9-2.4 0-1.2.6-1.7.8-2 .2-.2.5-.3.6-.3h.5c.2 0 .4 0 .6.4l.8 1.9c0 .2 0 .3-.1.5l-.3.4c-.1.1-.3.3-.1.5.1.3.6 1.1 1.4 1.7 1 .9 1.8 1.1 2 1.2.2.1.4.1.5-.1l.7-.8c.2-.2.3-.2.5-.1l1.8.9c.2.1.4.2.4.3s0 .6-.3 1.1Z" />
  ),
  telegram: <path d="M21.5 4.3 2.9 11.4c-.9.4-.9.9-.2 1.1l4.8 1.5 1.8 5.5c.2.6.4.8.8.8.4 0 .6-.2 1-.5l2.3-2.2 4.7 3.5c.9.5 1.5.2 1.7-.8l3.1-14.5c.3-1.2-.4-1.8-1.4-1.5Zm-3.9 3.4-8.4 7.6-.3 3.6-1.6-5 10-6.6c.4-.3.7-.1.3.4Z" />,
  linkedin: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="3.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M7.4 10v7M7.4 6.9v.1M11 17v-3.6c0-1.9 2.6-2.1 2.6 0V17M11 10v2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
};

const FALLBACK = (
  <>
    <path d="M10.5 13.5a4 4 0 0 0 5.7 0l2.3-2.3a4 4 0 0 0-5.7-5.7l-1.3 1.3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M13.5 10.5a4 4 0 0 0-5.7 0l-2.3 2.3a4 4 0 0 0 5.7 5.7l1.3-1.3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </>
);

export function SocialIcon({ platform, size = 18 }: { platform: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden>
      {PATHS[platform] ?? FALLBACK}
    </svg>
  );
}

/**
 * صفّ «تابعنا». بلا روابط لا يُرسم شيء — عنوانٌ فوق فراغٍ أسوأ من لا
 * عنوان، والمشرف قد لا يكون أضاف حساباته بعد.
 */
export function FollowRow({
  title,
  links,
  tone = "dark",
}: {
  title: string;
  links: { id: string; platform: string; url: string }[];
  tone?: "dark" | "light";
}) {
  if (links.length === 0) return null;

  const dark = tone === "dark";
  return (
    <div>
      <p
        className="mb-2.5 text-[12.5px] font-bold"
        style={{ color: dark ? "var(--color-gold-bright)" : "var(--color-clay-ink)" }}
      >
        {title}
      </p>
      <div className="flex flex-wrap gap-2">
        {links.map((link) => (
          <a
            key={link.id}
            href={link.url}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={link.platform}
            className="flex h-9 w-9 items-center justify-center rounded-full transition-opacity hover:opacity-100"
            style={{
              background: dark ? "rgba(255,255,255,0.08)" : "var(--color-chip)",
              color: dark ? "var(--color-chrome-ink)" : "var(--color-ink-2)",
              opacity: 0.85,
            }}
          >
            <SocialIcon platform={link.platform} />
          </a>
        ))}
      </div>
    </div>
  );
}
