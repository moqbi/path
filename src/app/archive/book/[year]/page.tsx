import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { book } from "@/lib/archive";
import { Avatar, ScreenHeader } from "@/components/ui";
import { AthrMark } from "@/components/brand";
import { BASE } from "@/lib/base";
import { ar, MONTHS } from "@/lib/format";
import { PrintButton } from "./print-button";

type Moment = Awaited<ReturnType<typeof book>>["moments"][number];

function line(moment: Moment): string {
  switch (moment.kind) {
    case "PLACE":
      return moment.placeName ?? "مكان";
    case "MUSIC":
      return moment.musicTitle ? `${moment.musicTitle}${moment.musicArtist ? ` — ${moment.musicArtist}` : ""}` : "أغنية";
    case "CITY":
      return `وصل إلى ${moment.text ?? moment.placeCity ?? ""}`;
    case "SLEEP":
      return "نام";
    case "WAKE":
      return "صحى";
    default:
      return moment.text ?? "";
  }
}

/**
 * «سنتك في كتاب» على الويب (القاعدة ٢٤٤): صفحاتٌ تُقرأ ثمّ تُطبع — كلُّ لحظةٍ
 * صفحة (`break-after`) — فالطباعةُ ورقٌ حقيقيّ أو PDF يُحفظ. كانت بطاقةً
 * تَعِد «مطبوعة ومرسلة لبابك» ولا خدمةَ خلفها.
 */
export default async function BookPage({ params }: { params: Promise<{ year: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const year = Number((await params).year);
  if (!Number.isInteger(year) || year < 2024 || year > 2100) notFound();
  const data = await book(user.id, year);
  const s = data.stats;

  const sections: { month: number; items: Moment[] }[] = [];
  for (const moment of data.moments) {
    const month = moment.createdAt.getMonth();
    const last = sections.at(-1);
    if (last && last.month === month) last.items.push(moment);
    else sections.push({ month, items: [moment] });
  }

  return (
    <div className="screen book">
      <style>{`
        .book .page { break-after: page; break-inside: avoid; }
        @media print {
          .screen, .scroll-area, .shell { height: auto !important; overflow: visible !important; }
          .chrome, .tabbar, .no-print, nav { display: none !important; }
          .book .page { min-height: 96vh; margin: 0 !important; border: 0 !important; }
          body { background: #fff !important; }
        }
      `}</style>
      <ScreenHeader title={`كتاب ${ar(year)}`} back="/archive" mark />
      <main className="scroll-area px-5 pb-10 pt-4">
        <div className="no-print mb-4 flex items-center justify-between gap-3">
          <p className="text-[12px] text-muted">{ar(data.moments.length)} لحظة — كلّ لحظة صفحة</p>
          <PrintButton />
        </div>

        <section className="page mb-4 flex flex-col items-center justify-center rounded-3xl p-8 text-center" style={{ background: "var(--color-night)", minHeight: 520 }}>
          <AthrMark size={64} />
          <p className="mt-6 text-[56px] font-extrabold leading-none" style={{ color: "#f7f5ef" }}>{ar(year)}</p>
          <div className="mt-8 flex flex-col items-center">
            <Avatar name={data.name} mediaId={data.avatarMediaId} size={76} />
            <p className="mt-3 text-[20px] font-extrabold" style={{ color: "#f7f5ef" }}>{data.name}</p>
            <p className="text-[12px]" style={{ color: "rgba(247,245,239,.6)" }}>عضوية رقم {ar(data.memberNo)}</p>
          </div>
          <p className="mt-10 text-[15px] font-bold" style={{ color: "#F6B93B" }}>لحظاتك، مع ناسك.</p>
        </section>

        <section className="page mb-4 rounded-3xl border border-line bg-card p-6">
          <h2 className="mb-4 text-[22px] font-extrabold">سنتك بالأرقام</h2>
          <div className="mb-4 grid grid-cols-2 gap-2.5">
            {[
              [s.moments, "لحظة"],
              [s.photos, "صورة"],
              [s.places, "مكان"],
              [s.songs, "أغنية"],
            ]
              .filter(([n]) => Number(n) > 0)
              .map(([n, label]) => (
                <div key={label} className="rounded-2xl bg-paper p-3.5">
                  <p className="text-[28px] font-extrabold">{ar(n)}</p>
                  <p className="text-[12px] text-muted">{label}</p>
                </div>
              ))}
          </div>
          <div className="flex flex-col gap-2 text-[14px] text-ink-2">
            {s.cities.length ? <p>مدنك: {s.cities.join("، ")}</p> : null}
            {s.topPlace ? (
              <p>
                أكثر مكان رجعت له: {s.topPlace.name}
                {s.topPlace.visits > 1 ? ` — ${ar(s.topPlace.visits)} مرّات` : ""}
              </p>
            ) : null}
            {s.topSong ? <p>أغنيتك: {s.topSong}</p> : null}
            {data.partial ? <p className="text-[11.5px] text-muted">الكتاب من آخر ستة أشهر — السنة كاملة مع آثار+.</p> : null}
          </div>
        </section>

        {sections.map((section) => (
          <div key={section.month}>
            <section className="page mb-4 flex flex-col items-center justify-center rounded-3xl p-8" style={{ background: "var(--color-gold-soft)", minHeight: 240 }}>
              <p className="text-[14px] font-bold" style={{ color: "var(--color-clay-ink)" }}>{ar(year)}</p>
              <p className="mt-1 text-[42px] font-extrabold">{MONTHS[section.month]}</p>
              <p className="mt-1 text-[13px] text-muted">{ar(section.items.length)} لحظة</p>
            </section>
            {section.items.map((moment) => (
              <Link key={moment.id} href={`/m/${moment.id}`} className="page mb-4 block overflow-hidden rounded-3xl border border-line bg-card">
                {moment.mediaId ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`${BASE}/api/media/${moment.mediaId}`}
                    alt=""
                    className="w-full object-cover"
                    style={{ aspectRatio: "5 / 4", objectPosition: `${moment.photoX ?? 50}% ${moment.photoY ?? 50}%` }}
                  />
                ) : null}
                <div className="p-5">
                  <p className="mb-2 text-[12.5px] text-muted">
                    {ar(moment.createdAt.getDate())} {MONTHS[moment.createdAt.getMonth()]}
                    {moment.placeName && moment.kind !== "PLACE" ? ` · ${moment.placeName}` : ""}
                  </p>
                  {line(moment) ? (
                    <p className={moment.mediaId ? "text-[15px] leading-relaxed" : "text-[21px] font-bold leading-relaxed"}>{line(moment)}</p>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        ))}

        <section className="page flex flex-col items-center justify-center rounded-3xl p-8 text-center" style={{ background: "var(--color-night)", minHeight: 300 }}>
          <AthrMark size={48} />
          <p className="mt-4 text-[20px] font-extrabold" style={{ color: "#f7f5ef" }}>
            {ar(s.moments)} لحظة تركت أثرها في {ar(year)}
          </p>
          <p className="mt-2 text-[13px]" style={{ color: "rgba(247,245,239,.6)" }}>والصفحة الجاية تكتبها أنت.</p>
        </section>
      </main>
    </div>
  );
}
