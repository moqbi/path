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
import { Accessories } from "./accessories";
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

export default async function ProfilePage() {
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
      where: { userId: user.id },
      select: {
        item: {
          select: {
            id: true,
            name: true,
            spec: true,
            kind: true,
            mediaId: true,
            priceHalalas: true,
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
  const tiles = moments.filter((m) => m.imageSpec).slice(0, 5);

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
        <ShareProfile id={user.id} name={user.name} memberNo={user.memberNo} />
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
            height={176}
          />
        }
        avatar={
          <AvatarMenu
            name={user.name}
            size={104}
            frameSpec={user.frame?.spec ?? null}
            charm={user.charm}
            mediaId={user.avatarMediaId}
            frame={worn(user.frameId)}
            charmItem={worn(user.charmId)}
            owned={purchases.map((row) => row.item.id)}
          />
        }
        identity={
          <>
            <h1 className="flex flex-wrap items-center justify-center gap-2 text-center text-[20px] font-semibold">
              {user.name}
              <NameTag isPlus={user.isPlus} tag={user.tag} size={12} />
            </h1>
            {user.handle ? (
              <p dir="ltr" className="mt-0.5 text-center text-[13px] text-muted">
                @{user.handle}
              </p>
            ) : null}
          </>
        }
        fold={
          <>
            {user.bio ? (
              <p className="mx-auto mt-2 max-w-[300px] text-center text-[12.5px] leading-relaxed text-ink-2">
                {user.bio}
              </p>
            ) : null}

            <p className="mt-1.5 text-center text-[11.5px] text-muted">
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
                    style={{ background: "var(--color-chip)", color: "var(--color-ink-2)" }}
                  >
                    {stat.icon}
                  </span>
                  <p className="text-[15px] font-bold leading-none">{stat.value}</p>
                  <p className="mt-0.5 text-[10px] text-muted">{stat.label}</p>
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
              avatarMediaId={user.avatarMediaId}
              frameSpec={user.frame?.spec ?? null}
              charm={user.charm}
              coverMediaId={user.coverMediaId}
              coverSpec={user.background?.spec ?? null}
              coverY={user.coverY}
            />
            <Accessories
              owned={purchases.map((row) => ({
                id: row.item.id,
                name: row.item.name,
                spec: row.item.spec,
                kind: row.item.kind,
                mediaId: row.item.mediaId,
                giftedBy: row.giftedBy?.name ?? null,
              }))}
              equippedFrame={user.frameId}
              equippedTheme={user.backgroundId}
              equippedCharm={user.charmId}
            />
            <Link
              href="/settings/privacy"
              aria-label="الخصوصية والإعدادات"
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
          <h2 className="text-[15px] font-bold">لحظاتي</h2>
          <span className="text-[12px] text-muted">{ar(mine.length)}</span>
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
                    <span className="block h-1.5 w-1.5 rounded-full bg-line" />
                  </div>
                  <h3 className="text-[15px] font-bold text-ink-2">{day.label}</h3>
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

        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[14.5px] font-semibold">أرشيفك</h2>
          <span className="text-[12px] text-clay">
            {user.isPlus ? "كامل" : "آخر ٦ أشهر"}
          </span>
        </div>

        {moments.length === 0 ? (
          <p className="rounded-2xl border border-line bg-card px-4 py-8 text-center text-[13px] text-muted">
            ما نشرت شي بعد.
          </p>
        ) : (
          <div className="mb-5 grid grid-cols-3 gap-2">
            {tiles.map((m) => (
              <Link
                key={m.id}
                href={`/m/${m.id}`}
                className="rounded-xl"
                style={{ aspectRatio: "1", background: m.imageSpec ?? "var(--color-chip)" }}
              />
            ))}
            <div
              className="flex items-center justify-center rounded-xl bg-chip text-[12px] text-muted"
              style={{ aspectRatio: "1" }}
            >
              {ar(Math.max(0, moments.length - tiles.length))}+
            </div>
          </div>
        )}

        <div
          className="mb-6 flex items-center gap-3 rounded-2xl border p-4"
          style={{ background: "var(--color-gold-soft)", borderColor: "var(--color-gold-line)" }}
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: "var(--color-gold-line)", color: "var(--color-gold-bright)" }}
          >
            <BookIcon size={20} />
          </span>
          <div className="grow">
            <p className="mb-0.5 text-[13.5px] font-semibold">سنتك في كتاب</p>
            <p className="text-[11.5px] text-muted">
              {ar(moments.length)} لحظة، مطبوعة ومرسلة لبابك
            </p>
          </div>
        </div>

        {user.role === "ADMIN" ? (
          <Link
            href="/admin"
            className="mb-3 flex items-center justify-center gap-2 rounded-xl border border-line bg-card text-[14px] font-semibold text-ink-2"
            style={{ height: 48 }}
          >
            لوحة التحكم
          </Link>
        ) : null}

        {!user.isPlus ? (
          <Link
            href="/subscribe"
            className="brand-gradient mb-8 flex items-center justify-center gap-2 rounded-xl text-[15px] font-bold"
            style={{ height: 52, color: "var(--color-on-brand)" }}
          >
            <SparkIcon size={17} />
            اشترك في أثر+
          </Link>
        ) : (
          <div className="mb-8 rounded-2xl border border-line bg-card p-4 text-center">
            <p className="text-[13px] text-ink-2">
              رصيد المتجر: <span className="font-semibold">{ar(user.storeCredit / 100)} ر.س</span>
            </p>
          </div>
        )}
      </ProfileShell>

      <TabBar active="/me" />
    </div>
  );
}
