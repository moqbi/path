import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { archive, years } from "@/lib/archive";
import { ScreenHeader } from "@/components/ui";
import { BookIcon, MoonIcon, MusicIcon, PinIcon, PlaneIcon, SparkIcon, SunIcon } from "@/components/icons";
import { BASE } from "@/lib/base";
import { ar, MONTHS } from "@/lib/format";

type Row = Awaited<ReturnType<typeof archive>>["moments"][number];

function line(moment: Row): string {
  switch (moment.kind) {
    case "PLACE":
      return moment.placeName ?? "مكان";
    case "MUSIC":
      return moment.musicTitle ?? "أغنية";
    case "CITY":
      return `وصلت إلى ${moment.text ?? moment.placeCity ?? ""}`;
    case "SLEEP":
      return "نمت";
    case "WAKE":
      return "صحيت";
    default:
      return moment.text ?? "";
  }
}

function KindIcon({ kind }: { kind: string }) {
  if (kind === "PLACE") return <PinIcon size={15} />;
  if (kind === "MUSIC") return <MusicIcon size={15} />;
  if (kind === "CITY") return <PlaneIcon size={15} />;
  if (kind === "SLEEP") return <MoonIcon size={15} />;
  if (kind === "WAKE") return <SunIcon size={15} />;
  return <BookIcon size={15} />;
}

/**
 * «أرشيفي» على الويب (القاعدة ٢٤٤): لحظاتُك شبكةً بالشهور، وفي أعلاها
 * «سنتك في كتاب» لكلّ سنة. نسخةُ `app/me/archive.tsx` على الجوّال.
 */
export default async function ArchivePage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const [page, list] = await Promise.all([archive(user.id, { limit: 300 }), years(user.id)]);

  const months = new Map<string, Row[]>();
  for (const moment of page.moments) {
    const key = `${moment.createdAt.getFullYear()}-${moment.createdAt.getMonth()}`;
    if (!months.has(key)) months.set(key, []);
    months.get(key)!.push(moment);
  }

  return (
    <div className="screen">
      <ScreenHeader title="أرشيفي" back="/me" mark />
      <main className="scroll-area px-5 pb-10 pt-4">
        <section
          className="mb-4 rounded-2xl border p-4"
          style={{ background: "var(--color-gold-soft)", borderColor: "var(--color-gold-line)" }}
        >
          <div className="flex items-center gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{ background: "var(--color-gold-line)", color: "var(--color-clay-ink)" }}
            >
              <BookIcon size={19} />
            </span>
            <div className="min-w-0 grow">
              <p className="text-[14.5px] font-bold">سنتك في كتاب</p>
              <p className="text-[11.5px] text-muted">لحظات السنة من أوّلها، صفحةً صفحة — تُقرأ وتُطبع</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {list.years.map((row) => (
              <Link
                key={row.year}
                href={`/archive/book/${row.year}`}
                className="flex items-center gap-1.5 rounded-full px-3.5 text-[13.5px] font-bold"
                style={{ height: 36, background: "var(--color-night)", color: "#f7f5ef" }}
              >
                {ar(row.year)}
                <span className="text-[11px] font-normal opacity-60">{ar(row.moments)} لحظة</span>
              </Link>
            ))}
            {list.years.length === 0 ? (
              <span className="text-[12px] text-muted">انشر لحظتك الأولى ويبدأ كتابك.</span>
            ) : null}
          </div>
        </section>

        {page.limited && page.hidden > 0 ? (
          <Link
            href="/subscribe"
            className="mb-4 flex items-center gap-2 rounded-2xl border border-line bg-card p-3 text-[12.5px] text-ink-2"
          >
            <SparkIcon size={16} /> هنا آخر ستة أشهر — و{ar(page.hidden)} لحظة أقدم محفوظة لك، تفتحها آثار+.
          </Link>
        ) : null}

        {page.moments.length === 0 ? (
          <p className="rounded-2xl border border-line bg-card px-4 py-8 text-center text-[13px] text-muted">
            ما نشرت شي بعد.
          </p>
        ) : null}

        {[...months.entries()].map(([key, items]) => {
          const [year, month] = key.split("-").map(Number);
          return (
            <section key={key} className="mb-5">
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="text-[15px] font-extrabold">
                  {MONTHS[month]} {ar(year)}
                </h2>
                <span className="text-[11.5px] text-muted">{ar(items.length)} لحظة</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {items.map((moment) =>
                  moment.mediaId ? (
                    <Link
                      key={moment.id}
                      href={`/m/${moment.id}`}
                      className="relative overflow-hidden rounded-xl bg-chip"
                      style={{ aspectRatio: "1" }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`${BASE}/api/media/${moment.mediaId}`}
                        alt=""
                        className="h-full w-full object-cover"
                        style={{ objectPosition: `${moment.photoX ?? 50}% ${moment.photoY ?? 50}%` }}
                      />
                      <span className="absolute right-2 top-1.5 text-[11px] font-extrabold text-white" style={{ textShadow: "0 1px 3px rgba(0,0,0,.5)" }}>
                        {ar(moment.createdAt.getDate())}
                      </span>
                    </Link>
                  ) : (
                    <Link
                      key={moment.id}
                      href={`/m/${moment.id}`}
                      className="flex flex-col justify-between rounded-xl border border-line bg-card p-2"
                      style={{ aspectRatio: "1" }}
                    >
                      <span className="flex items-center justify-between" style={{ color: "var(--color-clay-ink)" }}>
                        <KindIcon kind={moment.kind} />
                        <span className="text-[11px] font-bold text-faint">{ar(moment.createdAt.getDate())}</span>
                      </span>
                      <span className="line-clamp-3 text-[11.5px] leading-[17px]">{line(moment)}</span>
                    </Link>
                  ),
                )}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}
