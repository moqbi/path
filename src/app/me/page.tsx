import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { circleIds } from "@/lib/circle";
import { archive } from "@/lib/feed";
import { signOut } from "@/app/actions";
import { Avatar, TabBar } from "@/components/ui";
import { BookIcon, SparkIcon } from "@/components/icons";
import { ar } from "@/lib/format";

const MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

export default async function ProfilePage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const [ids, moments, places] = await Promise.all([
    circleIds(user.id),
    archive(user.id),
    prisma.moment.findMany({
      where: { authorId: user.id, placeName: { not: null } },
      select: { placeName: true },
      distinct: ["placeName"],
    }),
  ]);

  const joined = `${MONTHS[user.createdAt.getMonth()]} ${ar(user.createdAt.getFullYear())}`;
  const tiles = moments.filter((m) => m.imageSpec).slice(0, 5);

  return (
    <div className="flex min-h-dvh flex-col">
      <div
        className="relative shrink-0"
        style={{
          height: 152,
          background:
            user.background?.spec ?? "linear-gradient(140deg,#3d5a50,#2a4038 60%,#22312b)",
        }}
      >
        {user.background ? (
          <span
            className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full px-3 py-1.5"
            style={{ background: "rgba(27,25,23,.32)" }}
          >
            <SparkIcon size={13} className="text-[#f0e4c8]" />
            <span className="text-[11px] font-semibold text-[#f0e4c8]">خلفيتك</span>
          </span>
        ) : null}
      </div>

      <main className="grow px-5" style={{ marginTop: -46 }}>
        <div className="mb-4 flex items-end justify-between">
          <Avatar name={user.name} size={92} frameSpec={user.frame?.spec} />
          <form action={signOut} className="pb-1.5">
            <button
              type="submit"
              className="flex items-center rounded-xl border border-line bg-card px-4 text-[13px] font-medium text-ink-2"
              style={{ height: 40 }}
            >
              خروج
            </button>
          </form>
        </div>

        <h1 className="mb-1 flex items-center gap-2 text-[21px] font-semibold">
          {user.name}
          {user.isPlus ? <SparkIcon size={17} className="text-gold" /> : null}
        </h1>
        <p className="mb-5 text-[12.5px] text-muted">
          {user.city ? `${user.city} · ` : null}معك من {joined}
        </p>

        <div className="mb-5 grid grid-cols-3 gap-2.5">
          {[
            { value: moments.length, label: "لحظة" },
            { value: ids.length, label: "في دائرتك" },
            { value: places.length, label: "مكان" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-line bg-card px-2.5 py-3.5 text-center"
            >
              <p className="mb-0.5 text-[25px]" style={{ fontFamily: "var(--font-display)" }}>
                {ar(stat.value)}
              </p>
              <p className="text-[11px] text-muted">{stat.label}</p>
            </div>
          ))}
        </div>

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
            style={{ background: "#f0e4c8", color: "var(--color-gold)" }}
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

        {!user.isPlus ? (
          <Link
            href="/subscribe"
            className="mb-8 flex items-center justify-center gap-2 rounded-xl text-[15px] font-semibold text-card"
            style={{ height: 52, background: "var(--color-gold)" }}
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
      </main>

      <TabBar active="/me" />
    </div>
  );
}
