import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { circleIds } from "@/lib/circle";
import { signOut } from "@/app/actions";
import { archive, myMoments } from "@/lib/feed";
import { MomentCard } from "@/components/moment-card";
import { EditProfileSheet } from "./edit-sheet";
import { ProfileCover } from "./cover";
import { ProfileShell } from "./shell";
import { Accessories, type Owned } from "./accessories";
import { coverStyle, NameTag } from "@/components/ui";
import { AvatarMenu } from "@/components/avatar-menu";
import { TabBar } from "@/components/tab-bar";
import { BookIcon, ExitIcon, GearIcon, GiftIcon, SparkIcon, WithIcon } from "@/components/icons";
import { AthrPageMark } from "@/components/brand";
import { ShareProfile } from "./share";
import { ar, dayLabel } from "@/lib/format";

const MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

export default async function ProfilePage({
  searchParams,
}: {
  /** `?edit=1` يفتح نافذة التعديل — خطوةُ «ضع صورتك» في بطاقة الترحيب. */
  searchParams: Promise<{ edit?: string }>;
}) {
  const startEdit = (await searchParams).edit === "1";
  const user = await currentUser();
  if (!user) redirect("/login");

  const [ids, moments, mine, places, purchases, sentGifts] = await Promise.all([
    circleIds(user.id),
    archive(user.id),
    myMoments(user.id),
    prisma.moment.findMany({
      where: { authorId: user.id, placeName: { not: null } },
      select: { placeName: true },
      distinct: ["placeName"],
    }),
    // ما تملكه من المتجر — يُلبَس من هنا لا من صفحة الشراء.
    prisma.purchase.findMany({
      where: { userId: user.id, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      select: {
        item: {
          select: {
            id: true,
            name: true,
            spec: true,
            kind: true,
            mediaId: true,
            frameHole: true,
            priceCoins: true,
            plusOnly: true,
          },
        },
        giftedBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    // الهدايا تُعدّ من `Purchase.giftedById` — لا عمودَ عدادٍ يُكتب ويُنسى.
    prisma.purchase.count({ where: { giftedById: user.id } }),
  ]);

  const joined = `${MONTHS[user.createdAt.getMonth()]} ${ar(user.createdAt.getFullYear())}`;

  const days: { label: string; items: typeof mine }[] = [];
  for (const moment of mine) {
    const label = dayLabel(moment.createdAt);
    const last = days.at(-1);
    if (last && last.label === label) last.items.push(moment);
    else days.push({ label, items: [moment] });
  }

  // ما تلبسه أنت: يُقرأ من مشترياتك بمعرّفه الملبوس.
  const worn = (id: string | null) =>
    purchases.find((row) => row.item.id === id)?.item ?? null;

  // ما وصلك هديةً: شراءٌ باسمك دفع ثمنه غيرك.
  const gotGifts = purchases.filter((row) => row.giftedBy).length;

  /* أربعة أرقام بأيقوناتها: ما نشرت، ومن معك، وما أهديت، وما أُهدي إليك.
     و«شهر معنا» انتقل إلى رأس اللحظات تحت الاسم، فمكانه هناك لا هنا. */
  const stats = [
    { value: ar(moments.length), label: "لحظة", icon: <BookIcon size={14} /> },
    { value: ar(ids.length), label: "صديق", icon: <WithIcon size={14} /> },
    { value: ar(sentGifts), label: "أهديت", icon: <GiftIcon size={14} /> },
    { value: ar(gotGifts), label: "أُهدي لك", icon: <GiftIcon size={14} /> },
  ];

  return (
    <div className="screen">
      {/* رأسٌ كبقية التبويبات: العلامة ثم فاصل ثم اسم الشاشة. */}
      {/* بلا ترسٍ في الرأس: الخصوصية زرٌّ بجانب الإكسسوارات تحت. */}
      {/* المشاركة في الطرف المقابل للعلامة: رابط ملفك ورقم عضويتك. */}
      <header className="chrome flex items-center justify-between px-5 pb-3 pt-4">
        <AthrPageMark label="الملف الشخصي" />
        <ShareProfile name={user.name} memberNo={user.memberNo} />
      </header>

      {/*
        الرأس ثابت — الغلاف والصورة والبيانات وزرّ التعديل — ولحظاتي
        وحدها تمرّ تحته. قبلها كانت الصفحة كلها تمرّ فتتداخل اللحظات مع
        الغلاف عند النزول.
      */}
      <ProfileShell
        cover={
          <ProfileCover
            mediaId={user.coverMediaId}
            spec={user.background?.spec ?? null}
            initialY={user.coverY}
            x={user.coverX}
            zoom={user.coverZoom}
            height={176}
          />
        }
        avatar={
          <AvatarMenu
            name={user.name}
            size={104}
            frame={user.frame}
            charm={user.charm}
            mediaId={user.avatarMediaId}
            frameItem={worn(user.frameId)}
            charmItem={worn(user.charmId)}
            owned={purchases.map((row) => row.item.id)}
          />
        }
        identity={
          <>
            <h1 className="flex flex-wrap items-center justify-center gap-2 text-center text-[20px] font-semibold text-ground-ink">
              {user.name}
              <NameTag isPlus={user.isPlus} tag={user.tag} size={12} />
            </h1>
            {user.handle ? (
              <p dir="ltr" className="mt-0.5 text-center text-[13px] text-ground-muted">
                @{user.handle}
              </p>
            ) : null}
          </>
        }
        fold={
          <>
            {user.bio ? (
              <p className="mx-auto mt-2 max-w-[300px] text-center text-[12.5px] leading-relaxed text-ground-ink-2">
                {user.bio}
              </p>
            ) : null}

            <p className="mt-1.5 text-center text-[11.5px] text-ground-muted">
              عضوية رقم {ar(user.memberNo)}
              {user.city ? ` · ${user.city}` : ""} · انضم {joined}
            </p>

            {/* الأرقام تحت الاسم: أيقونةٌ ثم رقمٌ ثم اسمه. */}
            <div className="mx-auto mb-1 mt-3 flex max-w-[320px] items-stretch">
              {stats.map((stat, index) => (
                <div
                  key={stat.label}
                  className="flex-1 px-1 text-center"
                  style={{ borderRight: index === 0 ? "none" : "1px solid var(--color-line)" }}
                >
                  <span
                    className="mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-full"
                    style={{ background: "var(--color-chip)", color: "var(--color-ground-ink-2)" }}
                  >
                    {stat.icon}
                  </span>
                  <p className="text-[15px] font-bold leading-none text-ground-ink">{stat.value}</p>
                  <p className="mt-0.5 text-[10px] text-ground-muted">{stat.label}</p>
                </div>
              ))}
            </div>
          </>
        }
        actions={
          <div className="mb-4 flex gap-2.5">
            <EditProfileSheet
              name={user.name}
              isPlus={user.isPlus}
              handle={user.handle}
              bio={user.bio}
              city={user.city}
              gender={user.gender}
              avatarMediaId={user.avatarMediaId}
              frame={user.frame}
              charm={user.charm}
              coverMediaId={user.coverMediaId}
              coverSpec={user.background?.spec ?? null}
              coverY={user.coverY}
              startOpen={startEdit}
            />
            <Accessories
              /* والحزمة لا تُلبَس: ما فيها من أصناف مُلّك وحده، فهو ما يُعرض. */
              owned={purchases
                .filter((row): row is typeof row & { item: { kind: Owned["kind"] } } => row.item.kind !== "BUNDLE")
                .map((row) => ({
                  id: row.item.id,
                  name: row.item.name,
                  spec: row.item.spec,
                  kind: row.item.kind,
                  mediaId: row.item.mediaId,
                  frameHole: row.item.frameHole,
                  giftedBy: row.giftedBy?.name ?? null,
                }))}
              equippedFrame={user.frameId}
              equippedTheme={user.backgroundId}
              equippedCharm={user.charmId}
            />
            <Link
              href="/settings"
              aria-label="الإعدادات والخصوصية"
              className="flex w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-card text-ink-2"
              style={{ height: 46 }}
            >
              <GearIcon size={18} />
            </Link>
            {/* الخروج هنا وحده: كان مكرّراً فوق الغلاف بلا داعٍ. */}
            <form action={signOut} className="shrink-0">
              <button
                type="submit"
                aria-label="خروج"
                className="flex w-11 items-center justify-center rounded-xl border border-line bg-card text-ink-2"
                style={{ height: 46 }}
              >
                <ExitIcon size={18} />
              </button>
            </form>
          </div>
        }
      >
        {/* لحظاتي أسفل زرّ التعديل مباشرة — هذا ما يُفتح التبويب لأجله. */}
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-ground-ink">
            لحظاتي <span className="text-[12px] font-normal text-ground-muted">{ar(moments.length)}</span>
          </h2>
          {/*
            «أرشيفي» و«سنتك في كتاب» (القاعدة ٢٤٤): كانا بطاقتين بعد آخر لحظة لا
            يفتحان شيئاً. صارا صفحةً بابُها هنا عند لحظاتك.
          */}
          <Link
            href="/archive"
            className="flex items-center gap-1.5 rounded-full px-3 text-[12.5px] font-bold"
            style={{ height: 32, background: "var(--color-gold-soft)", color: "var(--color-clay-ink)" }}
          >
            <BookIcon size={14} /> أرشيفي وكتاب سنتي
          </Link>
        </div>

        {mine.length === 0 ? (
          <p className="mb-6 rounded-2xl border border-line bg-card px-4 py-8 text-center text-[13px] text-muted">
            ما نشرت شي بعد. اضغط الزائد في «اللحظات».
          </p>
        ) : (
          <div className="spine relative mb-6">
            {days.map((day) => (
              <section key={day.label}>
                <div className="relative flex items-center gap-3 py-4">
                  <div className="flex w-14 justify-center">
                    <span className="block h-1.5 w-1.5 rounded-full bg-ground-line" />
                  </div>
                  <h3 className="text-[15px] font-bold text-ground-ink-2">{day.label}</h3>
                </div>
                {day.items.map((moment) => (
                  <MomentCard
                    key={moment.id}
                    moment={moment}
                    viewerId={user.id}
                    isPlus={user.isPlus}
                  />
                ))}
              </section>
            ))}
          </div>
        )}

        {/*
           و`a` لا `Link`: اللوحة خارج جذر التطبيق (`/app` — القاعدة
           ١٢٢)، و`next/link` يسبق كلَّ مسارٍ بالجذر فيصير `/app/admin`
           — وذاك بابٌ حُذف.
        */}
        {user.role === "ADMIN" ? (
          <a
            href="/admin"
            className="mb-3 flex items-center justify-center gap-2 rounded-xl border border-line bg-card text-[14px] font-semibold text-ink-2"
            style={{ height: 48 }}
          >
            لوحة التحكم
          </a>
        ) : null}

        {!user.isPlus ? (
          <Link
            href="/subscribe"
            className="brand-gradient mb-8 flex items-center justify-center gap-2 rounded-xl text-[15px] font-bold"
            style={{ height: 52, color: "var(--color-on-brand)" }}
          >
            <SparkIcon size={17} />
            اشترك في آثار+
          </Link>
        ) : (
          <div className="mb-8 rounded-2xl border border-line bg-card p-4 text-center">
            <p className="text-[13px] text-ink-2">
              رصيد المتجر: <span className="font-semibold">{ar(user.coins / 100)} ر.س</span>
            </p>
          </div>
        )}
      </ProfileShell>

      <TabBar active="/me" />
    </div>
  );
}
