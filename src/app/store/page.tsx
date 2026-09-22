import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TabBar } from "@/components/tab-bar";
import { AthrPageMark } from "@/components/brand";
import { FlameIcon, InfoIcon, SparkIcon } from "@/components/icons";
import { StoreGrid, type Item } from "./grid";
import { coinText } from "@/lib/format";

/** كم صنفاً يظهر في صفّ «وصل حديثاً» — صفٌّ واحد من ثلاثة. */
const FRESH = 3;

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
  searchParams: Promise<{ c?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");

  const { c } = await searchParams;

  const [categories, all, purchases] = await Promise.all([
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
    prisma.purchase.findMany({ where: { userId: user.id }, select: { itemId: true } }),
  ]);

  const category = categories.find((row) => row.slug === c) ?? null;
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
    holds: item.holds.map((row) => row.item),
  });

  const grid = (items: typeof all) => (
    <StoreGrid
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
  const themes = all.filter(
    (item) => (item.kind === "THEME" || item.kind === "BACKGROUND") && !item.limited,
  );
  const limited = all.filter((item) => item.limited);
  // والحزم صفٌّ بنفسها: ما جُمع في باقةٍ واحدة لا يُقرأ بين الأصناف المفردة.
  const bundles = all.filter((item) => item.kind === "BUNDLE" && !item.limited);

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
        </Link>
      </header>

      {/* شريط التصنيفات: «المميز» أولاً، ثم ما يضيفه المشرف. */}
      <div className="shrink-0 px-5 pb-1 pt-3">
        <div className="no-bar flex gap-2 overflow-x-auto">
          {[{ slug: "", name: "المميز" }, ...categories].map((chip) => {
            const on = (category?.slug ?? "") === chip.slug;
            return (
              <Link
                key={chip.slug || "featured"}
                href={chip.slug ? `/store?c=${chip.slug}` : "/store"}
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
        ) : (
          <>
            <Row title="وصل حديثاً" flame>
              {grid(fresh)}
            </Row>

            <Row title="ثيمات آثار">{grid(themes)}</Row>

            {bundles.length > 0 ? <Row title="باقات">{grid(bundles)}</Row> : null}

            <Row title="حزم محدودة">{grid(limited)}</Row>
          </>
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
  children,
}: {
  title: string;
  flame?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2.5 flex items-center gap-1.5 text-[14px] font-bold">
        {flame ? (
          <span style={{ color: "var(--color-live)" }}>
            <FlameIcon size={16} />
          </span>
        ) : null}
        {title}
      </h2>
      {children}
    </section>
  );
}
