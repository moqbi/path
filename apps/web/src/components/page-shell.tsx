import { AthrMark } from "@/components/brand";
import { ar } from "@/lib/format";

/**
 * هيكلُ صفحات الموقع الداخلية — عن آثار، والخصوصية، والشروط، والتواصل،
 * والوظائف، وحذف الحساب.
 *
 * رأسٌ داكنٌ في الوسط بالعلامة والعنوان وسطرٍ يقول ما في الصفحة، ثمّ
 * البطاقاتُ تصعد فوق حافّته قليلاً (`margin-top` سالب) فتُقرأ الصفحةُ
 * قطعةً واحدة لا شريطاً ثمّ نصّاً.
 */
export function PageHero({
  eyebrow,
  title,
  lead,
  children,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="page-hero">
      <div className="mx-auto flex max-w-2xl flex-col items-center">
        <AthrMark size={52} />
        {eyebrow ? (
          <span
            className="mt-5 rounded-full px-3 py-1 text-[11px] font-bold"
            style={{ background: "rgba(246,185,59,0.14)", color: "var(--color-gold-bright)" }}
          >
            {eyebrow}
          </span>
        ) : null}
        <h1
          className="mt-4 text-[30px] leading-[1.3] sm:text-[40px]"
          style={{ fontFamily: "var(--font-display)", fontWeight: 800 }}
        >
          {title}
        </h1>
        {lead ? (
          <p className="mt-3 max-w-xl text-[14.5px] leading-[1.95]" style={{ color: "#cfd8df" }}>
            {lead}
          </p>
        ) : null}
        {children}
      </div>
    </section>
  );
}

export function PageBody({ children, narrow = false }: { children: React.ReactNode; narrow?: boolean }) {
  return (
    <div className="page-body" style={narrow ? { maxWidth: 720 } : undefined}>
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  );
}

/** قسمٌ في بطاقته: رقمٌ أو أيقونةٌ صغيرة، ثمّ العنوان، ثمّ المتن. */
export function DocSection({
  index,
  icon,
  title,
  children,
  id,
}: {
  index?: number;
  icon?: React.ReactNode;
  title: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="doc-card scroll-mt-24">
      <div className="mb-3 flex items-center gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[13px] font-bold"
          style={{ background: "var(--color-gold-soft)", color: "var(--color-clay-ink)" }}
        >
          {icon ?? (index !== undefined ? ar(index) : null)}
        </span>
        <h2 className="text-[17px] font-bold text-ink sm:text-[18px]" style={{ fontFamily: "var(--font-display)" }}>
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

/** سطرُ «آخر تحديث» وفهرسٌ قصير بأقسام الصفحة — للخصوصية والشروط. */
export function DocIndex({ updated, sections }: { updated: string; sections: { id: string; title: string }[] }) {
  return (
    <nav className="doc-card" aria-label="أقسام الصفحة">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13px] font-bold text-ink">في هذه الصفحة</span>
        <span className="text-[11.5px] text-faint">آخر تحديث: {updated}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {sections.map((section, index) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="rounded-full border border-line bg-paper px-3 py-1.5 text-[12px] font-semibold text-ink-2 hover:border-clay"
          >
            {ar(index + 1)}. {section.title}
          </a>
        ))}
      </div>
    </nav>
  );
}
