import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { archive, years } from "@/lib/archive";
import { ScreenHeader } from "@/components/ui";
import { BookIcon, LockIcon, MoonIcon, MusicIcon, PinIcon, PlaneIcon, SparkIcon, SunIcon } from "@/components/icons";
import { BASE } from "@/lib/base";
import { ar, MONTHS } from "@/lib/format";
import { canTryStickers } from "@/lib/stickers";
import { HALL_SKIN } from "@/lib/gallery-skin";

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
  // «المعرض وكتاب السنة» بدل الأرشيف (القاعدة ٣٤٦) — للمالك وممنوحي اللوحة كلّها الآن.
  if (canTryStickers(user)) return <Lobby userId={user.id} />;
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

/**
 * المدخل (القاعدة ٣٤٦): كتابُ السنة في أعلاه كما هو، وتحته بابُ القاعة — نسخةُ
 * `components/gallery-lobby.tsx` في الجوّال. والـPDF من داخل الكتاب (نافذةُ الطباعة).
 */
async function Lobby({ userId }: { userId: string }) {
  const skin = HALL_SKIN;
  const [head, list] = await Promise.all([archive(userId, { limit: 1 }), years(userId)]);
  const [latest, ...older] = list.years;
  return (
    <div className="screen">
      <ScreenHeader title="المعرض وكتاب السنة" back="/me" mark />
      <main className="scroll-area flex flex-col gap-3 px-4 pb-10 pt-4">
        <p className="text-[12.5px] font-extrabold text-ground-ink">كتاب السنة</p>
        {list.years.length === 0 ? <p className="text-[13px] text-ground-ink">انشر لحظتك الأولى ويبدأ كتابك ومعرضك.</p> : null}
        {list.years.map((row) => (
          <div key={row.year} className="flex gap-3.5 rounded-[18px] border border-line bg-card p-3.5">
            <div
              className="flex shrink-0 flex-col justify-between p-2.5"
              style={{ width: 78, height: 104, borderRadius: "6px 12px 12px 6px", background: "#FBF8F1", boxShadow: "inset 6px 0 0 #E6DCC6, 0 5px 12px rgba(14,26,36,.16)" }}
            >
              <span className="font-display text-[22px] font-extrabold" style={{ color: "#0E1A24" }}>{ar(row.year)}</span>
              <span className="text-[9.5px]" style={{ color: "#5B5446" }}>{ar(row.moments)} لحظة</span>
            </div>
            <div className="flex min-w-0 grow flex-col gap-1.5">
              <p className="font-display text-[16px] font-extrabold">سنتك في كتاب</p>
              <p className="text-[12.5px] leading-5 text-muted">يومٌ لكلّ صفحة، ويُروى بلسانك.</p>
              <Link
                href={`/archive/book/${row.year}`}
                className="mt-auto flex h-[34px] w-fit items-center rounded-full px-3.5 text-[12.5px] font-extrabold"
                style={{ background: "var(--color-clay)", color: "var(--color-on-brand)" }}
              >
                افتح الكتاب
              </Link>
            </div>
          </div>
        ))}

        {latest ? (
          <>
            <p className="mt-1.5 text-[12.5px] font-extrabold text-ground-ink">المعرض</p>
            <Link
              href={`/archive/hall/${latest.year}`}
              aria-label={`ادخل قاعة ${latest.year}`}
              className="relative block overflow-hidden rounded-[22px]"
              style={{ height: 270, background: skin.ceiling }}
            >
              <span className="absolute inset-x-0 bottom-0" style={{ height: 86, background: skin.floor }} />
              <span
                className="absolute left-1/2 flex -translate-x-1/2 items-end justify-center gap-2.5 pb-6"
                style={{ bottom: 86, width: 220, height: 160, borderRadius: "110px 110px 0 0", background: skin.wall, border: "8px solid #2A3946", borderBottom: 0 }}
              >
                {[
                  { w: 40, h: 50, c: "#2B4A63", f: "#3A2A1C" },
                  { w: 52, h: 64, c: "#C86F4F", f: skin.photo.frame },
                  { w: 40, h: 50, c: "#8FA38A", f: "#3A2A1C" },
                ].map((frame, at) => (
                  <span key={at} className="block" style={{ width: frame.w, height: frame.h, background: frame.c, border: `4px solid ${frame.f}`, marginBottom: at === 1 ? 6 : 0 }} />
                ))}
              </span>
              <span className="absolute inset-x-4 bottom-4 flex items-end justify-between">
                <span>
                  <span className="font-display block text-[21px] font-extrabold" style={{ color: "#FDFCF8" }}>قاعة {ar(latest.year)}</span>
                  <span className="block text-[12px]" style={{ color: "rgba(253,252,248,.8)" }}>{ar(latest.moments)} لحظة — شهرٌ لكلّ جدار</span>
                </span>
                <span className="flex h-9 items-center rounded-full px-4 text-[13px] font-extrabold" style={{ background: skin.accent.bg, color: skin.accent.ink }}>
                  ادخل
                </span>
              </span>
            </Link>
            <div className="grid grid-cols-2 gap-2.5">
              {older.map((row) => (
                <Link key={row.year} href={`/archive/hall/${row.year}`} className="rounded-2xl border border-line bg-card p-3">
                  <p className="font-display text-[15px] font-extrabold">قاعة {ar(row.year)}</p>
                  <p className="text-[11.5px] text-muted">{ar(row.moments)} لحظة</p>
                </Link>
              ))}
              {head.limited && head.hidden > 0 ? (
                <Link href="/subscribe" className="rounded-2xl border border-dashed border-line bg-paper p-3">
                  <p className="font-display flex items-center gap-1.5 text-[15px] font-extrabold text-muted">
                    <LockIcon size={13} /> لحظات أقدم
                  </p>
                  <p className="flex items-center gap-1 text-[11.5px]" style={{ color: "var(--color-clay-ink)" }}>
                    <SparkIcon size={12} /> {ar(head.hidden)} لحظة مع آثار+
                  </p>
                </Link>
              ) : null}
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
