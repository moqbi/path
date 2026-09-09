import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { circleIds } from "@/lib/circle";
import { archive, myMoments } from "@/lib/feed";
import { signOut } from "@/app/actions";
import { MomentCard } from "@/components/moment-card";
import { plusTag, tagOf } from "@/lib/tags";
import { CoverPicker, ProfileImages } from "./images";
import { DeleteAccount } from "./delete";
import { coverStyle, TagPill } from "@/components/ui";
import { TabBar } from "@/components/tab-bar";
import { BookIcon, GearIcon, SparkIcon } from "@/components/icons";
import { ar, dayLabel } from "@/lib/format";

const MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

export default async function ProfilePage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const [ids, moments, mine, places, auto] = await Promise.all([
    circleIds(user.id),
    archive(user.id),
    myMoments(user.id),
    prisma.moment.findMany({
      where: { authorId: user.id, placeName: { not: null } },
      select: { placeName: true },
      distinct: ["placeName"],
    }),
    plusTag(),
  ]);

  const joined = `${MONTHS[user.createdAt.getMonth()]} ${ar(user.createdAt.getFullYear())}`;
  const tiles = moments.filter((m) => m.imageSpec).slice(0, 5);

  // «سنتان معنا» أصدق من تاريخ انضمام لا يقول شيئاً.
  const years = Math.floor((Date.now() - user.createdAt.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  const months = Math.max(
    1,
    Math.round((Date.now() - user.createdAt.getTime()) / (30.44 * 24 * 60 * 60 * 1000)),
  );

  const days: { label: string; items: typeof mine }[] = [];
  for (const moment of mine) {
    const label = dayLabel(moment.createdAt);
    const last = days.at(-1);
    if (last && last.label === label) last.items.push(moment);
    else days.push({ label, items: [moment] });
  }

  const stats = [
    { value: ar(moments.length), label: "لحظة" },
    { value: ar(ids.length), label: "صديق" },
    years >= 1
      ? { value: ar(years), label: years === 1 ? "سنة معنا" : "سنة معنا" }
      : { value: ar(months), label: "شهر معنا" },
  ];

  return (
    <div className="screen">
      <div
        className="relative shrink-0"
        style={{ height: 168, ...coverStyle(user.coverMediaId, user.background?.spec) }}
      >
        <CoverPicker hasCover={Boolean(user.coverMediaId)} />

        <div className="absolute left-4 top-4 flex gap-2">
          <Link
            href="/settings/privacy"
            aria-label="الخصوصية"
            className="flex h-9 w-9 items-center justify-center rounded-full"
            style={{ background: "rgba(14,26,36,.55)", color: "#f7f5ef" }}
          >
            <GearIcon size={17} />
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              aria-label="خروج"
              className="flex h-9 items-center rounded-full px-3 text-[11px] font-semibold"
              style={{ background: "rgba(14,26,36,.55)", color: "#f7f5ef" }}
            >
              خروج
            </button>
          </form>
        </div>
      </div>

      <main className="scroll-area relative px-5" style={{ marginTop: -52 }}>
        {/* الصورة في الوسط فوق حدّ الغلاف — كما في المخطط. */}
        <div className="mb-3 flex justify-center">
          <ProfileImages
            name={user.name}
            frameSpec={user.frame?.spec ?? null}
            avatarMediaId={user.avatarMediaId}
          />
        </div>

        <h1 className="flex flex-wrap items-center justify-center gap-2 text-center text-[21px] font-semibold">
          {user.name}
          {user.isPlus ? <SparkIcon size={17} className="text-gold" /> : null}
          <TagPill tag={tagOf(user, auto)} size={12} />
        </h1>
        {user.handle ? (
          <p dir="ltr" className="mt-0.5 text-center text-[13px] text-muted">
            @{user.handle}
          </p>
        ) : null}

        {user.bio ? (
          <p className="mx-auto mt-2.5 max-w-[300px] text-center text-[13px] leading-relaxed text-ink-2">
            {user.bio}
          </p>
        ) : null}

        <p className="mt-2 text-center text-[12px] text-muted">
          عضوية رقم {ar(user.memberNo)}
          {user.city ? ` · ${user.city}` : ""} · انضم {joined}
        </p>

        {/* عدد اللحظات وعدد السنوات تحت الاسم مباشرة. */}
        <div className="mx-auto my-5 flex max-w-[320px] items-stretch">
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              className="flex-1 text-center"
              style={{ borderRight: index === 0 ? "none" : "1px solid var(--color-line)" }}
            >
              <p className="text-[22px] font-bold leading-none">{stat.value}</p>
              <p className="mt-1 text-[11px] text-muted">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="mb-6 flex gap-2.5">
          <Link
            href="/me/edit"
            className="flex grow items-center justify-center rounded-xl border border-line bg-card text-[13.5px] font-semibold text-ink-2"
            style={{ height: 46 }}
          >
            تعديل الملف الشخصي
          </Link>
          <Link
            href="/settings/privacy"
            aria-label="الإعدادات"
            className="flex w-12 shrink-0 items-center justify-center rounded-xl border border-line bg-card text-ink-2"
            style={{ height: 46 }}
          >
            <GearIcon size={18} />
          </Link>
        </div>

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
                  <h3 className="text-[15px] font-semibold text-muted">{day.label}</h3>
                </div>
                {day.items.map((moment) => (
                  <MomentCard
                    key={moment.id}
                    moment={moment}
                    viewerId={user.id}
                    isPlus={user.isPlus}
                    circleSize={ids.length}
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

        <DeleteAccount />
      </main>

      <TabBar active="/me" />
    </div>
  );
}
