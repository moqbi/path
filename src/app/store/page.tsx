import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TabBar } from "@/components/tab-bar";
import { AthrPageMark } from "@/components/brand";
import { ScreenHeader } from "@/components/ui";
import { FlameIcon, InfoIcon, PlusIcon, SparkIcon } from "@/components/icons";
import { StoreGrid, type Item } from "./grid";
import { coinText } from "@/lib/format";

/** كم صنفاً يظهر في صفّ «وصل حديثاً». */
const FRESH = 10;
/** صفٌّ يُمرَّر بعشرةٍ ثمّ «عرض الكل» — كالجوّال (القاعدة ٢٦٦). */
const STRIP_MAX = 10;

/** شرائحُ الأنواع بعد «المميز» — كالجوّال (القاعدة ٤٤د). */
const KINDS = [
  { key: "charms", label: "التشارمز", kinds: ["CHARM"] },
  { key: "frames", label: "الإطارات", kinds: ["FRAME"] },
  { key: "themes", label: "الثيمات", kinds: ["THEME", "BACKGROUND"] },
] as const;
/** تصنيفٌ باسم نوعٍ لا يُرسم شريحةً ثانية (القاعدة ١٦٥) — والاسمُ القديم معه (القاعدة ٢٧١). */
const KIND_NAMES = new Set(["التشارمز", "التمائم", "الإطارات", "الثيمات"]);

/**
 * المتجر: شريط تصنيفات، ثم صفوف.
 *
 * التصنيفات تأتي من القاعدة فيضيفها المشرف من اللوحة بلا نشر نسخة.
 * و«المميز» ليس تصنيفاً بل واجهة: ما وصل حديثاً، ثم ثيمات آثار، ثم الحزم
 * المحدودة — صفوفٌ مشتقّة من الأصناف نفسها لا مرصوفة يدوياً.
 */
export default async function StorePage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; k?: string; all?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");

  const { c, k, all: expanded } = await searchParams;

  const [categories, every, purchases, bundled, collections] = await Promise.all([
    prisma.storeCategory.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    // والمخفيّ لا يُعرض: بابُ الموسميّ — يُرفع ويُنزل بلا حذفٍ يُضيع
    // ما اشتراه أحد (`hidden`).
    prisma.storeItem.findMany({
      where: { hidden: false },
      orderBy: { sortOrder: "asc" },
      include: {
        // ما تحمله الحزمة: بطاقتُها ترسمه وتعدّه، فلا تُشترى على غير علم.
        holds: {
          where: { item: { hidden: false } },
          select: { item: { select: { id: true, name: true, spec: true, mediaId: true, kind: true } } },
        },
      },
    }),
    prisma.purchase.findMany({ where: { userId: user.id, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, select: { itemId: true } }),
    prisma.bundleItem.findMany({ select: { itemId: true }, distinct: ["itemId"] }),
    prisma.storeCollection.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true, kind: true } }),
  ]);

  // ما في حزمةٍ يُباع فيها وحدها — **بقرار المالك**، كالخادم (`storefront`).
  const inBundle = new Set(bundled.map((row) => row.itemId));
  const all = every.filter((item) => !inBundle.has(item.id));

  const kind = KINDS.find((row) => row.key === k) ?? null;
  const category = kind ? null : (categories.find((row) => row.slug === c) ?? null);
  const chips = categories.filter((row) => !KIND_NAMES.has(row.name.trim()));
  const owned = purchases.map((row) => row.itemId);
  const daysHere = Math.floor((Date.now() - user.createdAt.getTime()) / 86_400_000);

  const shape = (item: (typeof all)[number]): Item => ({
    id: item.id,
    kind: item.kind,
    name: item.name,
    priceCoins: item.priceCoins,
    spec: item.spec,
    plusOnly: item.plusOnly,
    earnedAfterDays: item.earnedAfterDays,
    limited: item.limited,
    mediaId: item.mediaId,
    promoMediaId: item.promoMediaId,
    holds: item.holds.map((row) => row.item),
  });

  const grid = (items: typeof every, row = false) => (
    <StoreGrid
      row={row}
      items={items.map(shape)}
      owned={owned}
      isPlus={user.isPlus}
      credit={user.coins}
      daysHere={daysHere}
      equipped={{ frame: user.frameId, theme: user.backgroundId, charm: user.charmId }}
    />
  );

  const fresh = [...all]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, FRESH);
  // الحزم المحدودة لها صفّها تحت، فلا تُعاد هنا.
  const ofKind = (kinds: readonly string[]) => all.filter((item) => kinds.includes(item.kind) && !item.limited);
  const charms = ofKind(["CHARM"]);
  const frames = ofKind(["FRAME"]);
  const themes = ofKind(["THEME", "BACKGROUND"]);
  // والحزمةُ بمدّة عرضٍ محدودةٌ بطبعها (القاعدة ٢٨٤).
  const timed = (item: (typeof all)[number]) => item.kind === "BUNDLE" && item.hideAt !== null;
  const limited = all.filter((item) => item.limited || timed(item));
  // والحزم صفٌّ بنفسها: ما جُمع في باقةٍ واحدة لا يُقرأ بين الأصناف المفردة.
  const bundles = all.filter((item) => item.kind === "BUNDLE" && !item.limited && !timed(item));

  /*
    «عرض الكل» يفتح القسمَ في صفحته كالجوّال (القاعدة ٣١٠): رابطٌ يُبقي الشريحة
    ويحمل مفتاحَ القسم، والصفحةُ تُرسم بعد أن تُسجَّل الأقسامُ كلُّها (`sections`).
  */
  const base = kind ? `/store?k=${kind.key}` : "/store";
  const sections = new Map<string, { title: string; items: typeof every }>();
  const strip = (key: string, title: string, items: typeof every, flame = false) => {
    if (items.length === 0) return null;
    sections.set(key, { title, items });
    return (
      <Row
        key={key}
        title={title}
        flame={flame}
        more={
          items.length > STRIP_MAX
            ? { href: `${base}${base.includes("?") ? "&" : "?"}all=${encodeURIComponent(key)}`, label: "عرض الكل" }
            : null
        }
      >
        {grid(items.slice(0, STRIP_MAX), true)}
      </Row>
    );
  };

  // أقسامُ النوع بمجموعاته ثمّ «… الأخرى» (القاعدة ٤٤د)، والمختلطةُ في كلّ نوعٍ فيها (١٩٧).
  const kindSections = (() => {
    if (!kind) return null;
    const items = all.filter((item) => (kind.kinds as readonly string[]).includes(item.kind));
    const sections = collections
      .filter((one) => !one.kind || (kind.kinds as readonly string[]).includes(one.kind))
      .map((one) => strip(one.id, one.name, items.filter((item) => item.collectionId === one.id)));
    const rest = items.filter((item) => !item.collectionId || !collections.some((one) => one.id === item.collectionId));
    return (
      <>
        {sections}
        {rest.length > 0 ? strip("rest", `${kind.label} الأخرى`, rest) : null}
        {items.length === 0 ? grid([]) : null}
      </>
    );
  })();

  // ترتيبُ «المميز» (القاعدة ٤٤د): وصل حديثاً، فالتشارمز، فالإطارات، فالثيمات، فالمحدود.
  const featured = (
    <>
      {strip("fresh", "وصل حديثاً", fresh, true)}
      {strip("charms", "التشارمز", charms)}
      {strip("frames", "الإطارات", frames)}
      {strip("themes", "ثيمات آثار", themes)}
      {strip("bundles", "الحزم", bundles)}
      {strip("limited", "حزم محدودة", limited)}
    </>
  );

  const section = expanded && !category ? sections.get(expanded) : undefined;
  if (section) {
    return (
      <div className="screen">
        <ScreenHeader title={section.title} back={base} />
        <main className="scroll-area px-5 pb-6 pt-4">{grid(section.items)}</main>
        <TabBar active="/store" />
      </div>
    );
  }

  return (
    <div className="screen">
      <header className="chrome flex items-center justify-between px-5 pb-3 pt-4">
        <AthrPageMark label="المتجر" />
        {/*
          الرصيد بابُ الشحن: من يقرأ رصيده هو من يريد شحنه، فالطريق من
          حيث يُقرأ. وضغطةٌ تموت تحت الإصبع تُقرأ عطلاً.
          و`/coins` في الويب **عرضٌ لا شراء**: نافذةُ آبل لا تُفتح في
          متصفّح، والشراء في التطبيق على الجوّال (القاعدة ٧٣ج).
        */}
        <Link
          href="/coins"
          className="flex items-center gap-2 rounded-full border px-3.5 py-2"
          style={{ background: "var(--color-gold-soft)", borderColor: "var(--color-gold-line)" }}
        >
          <SparkIcon size={14} className="text-gold" />
          <span className="text-[12.5px] font-semibold text-gold">
            رصيدك {coinText(user.coins)}
          </span>
          {/* «+» يقول إنّ اللافتة بابُ الشحن — كالجوّال (القاعدة ٧٣ج). */}
          <PlusIcon size={14} className="text-gold" />
        </Link>
      </header>

      {/* الشرائح: «المميز»، فالأنواع، فما يضيفه المشرف — كالجوّال (القاعدة ٤٤د). */}
      <div className="shrink-0 px-5 pb-1 pt-3">
        <div className="no-bar flex gap-2 overflow-x-auto">
          {[
            { slug: "", name: "المميز", href: "/store", on: !kind && !category },
            ...KINDS.map((row) => ({ slug: `k-${row.key}`, name: row.label, href: `/store?k=${row.key}`, on: kind?.key === row.key })),
            ...chips.map((row) => ({ slug: row.slug, name: row.name, href: `/store?c=${row.slug}`, on: category?.slug === row.slug })),
          ].map((chip) => {
            const on = chip.on;
            return (
              <Link
                key={chip.slug || "featured"}
                href={chip.href}
                className="shrink-0 rounded-full px-4 py-2 text-[12.5px] font-semibold"
                style={{
                  background: on ? "var(--color-clay)" : "var(--color-card)",
                  color: on ? "var(--color-on-brand)" : "var(--color-ink-2)",
                  border: `1px solid ${on ? "var(--color-clay)" : "var(--color-line)"}`,
                }}
              >
                {chip.name}
              </Link>
            );
          })}
        </div>
      </div>

      <main className="scroll-area px-5 pt-4">
        {category ? (
          grid(all.filter((item) => item.categoryId === category.id))
        ) : kind ? (
          kindSections
        ) : (
          featured
        )}

        {!user.isPlus ? (
          <div
            className="mb-5 flex items-center gap-3 rounded-2xl border p-4"
            style={{ background: "var(--color-gold-soft)", borderColor: "var(--color-gold-line)" }}
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{ background: "#f0e4c8", color: "var(--color-gold)" }}
            >
              <SparkIcon size={19} />
            </span>
            <p className="grow text-[12px] leading-relaxed text-ink-2">
              مشتركو <span className="font-semibold text-gold">آثار+</span> يحصلون على ١٠٠٠
              نقاط شهرياً وخصم ٢٠٪
            </p>
          </div>
        ) : null}

        <p className="flex items-center justify-center gap-2 pb-6 text-center text-[11px] leading-relaxed text-faint">
          <InfoIcon size={13} />
          لا صناديق عشوائية · كل صنف بسعره الواضح
        </p>
      </main>

      <TabBar active="/store" />
    </div>
  );
}

/** عنوان صفٍّ في «المميز» — واللهب رسمٌ لا إيموجي، كبقية أيقونات التطبيق. */
function Row({
  title,
  flame = false,
  more = null,
  children,
}: {
  title: string;
  flame?: boolean;
  /** «عرض الكل» في رأس القسم يفتحه في صفحته (القاعدتان ٢٦٦ و٣١٠). */
  more?: { href: string; label: string } | null;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-1 flex items-center gap-1.5">
        <h2 className="flex grow items-center gap-1.5 text-[16px] font-bold text-ground-ink">
          {flame ? (
            <span style={{ color: "var(--color-live)" }}>
              <FlameIcon size={16} />
            </span>
          ) : null}
          {title}
        </h2>
        {more ? (
          <Link href={more.href} scroll={false} className="shrink-0 text-[12.5px] font-semibold text-clay-ink">
            {more.label}
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}
