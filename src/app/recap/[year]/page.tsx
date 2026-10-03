import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { recapFor } from "@/lib/recap";
import { Avatar, ScreenHeader } from "@/components/ui";
import { ShareRecap } from "@/components/memory-share";
import { BASE } from "@/lib/base";
import { ar } from "@/lib/format";

const AMBER = "#F6B93B";
const PAPER = "#f7f5ef";
const SOFT = "rgba(247,245,239,.72)";

/** العددُ وتمييزُه — والفاصلُ فاصلةٌ لا «·» (الصفرُ العربيّ نقطة). */
function counted(n: number, one: string, two: string, few: string, many: string) {
  if (n <= 1) return one;
  if (n === 2) return two;
  return `${ar(n)} ${n <= 10 ? few : many}`;
}
const times = (n: number) => counted(n, "مرة", "مرتين", "مرات", "مرة");

function Block({ kicker, children }: { kicker: string; children: React.ReactNode }) {
  return (
    <section className="mb-4 rounded-3xl p-6" style={{ background: "var(--color-night)" }}>
      <p className="mb-2 text-[14px] font-bold" style={{ color: AMBER }}>{kicker}</p>
      {children}
    </section>
  );
}

/**
 * «آثرك السنويّ» على الويب (القاعدة ٢٣٥): الشرائحُ نفسها صفحةً تُمرَّر —
 * الفأرةُ لا تضغط نصفَي شاشة. وما لا بيانات له لا قسمَ له.
 */
export default async function RecapPage({ params }: { params: Promise<{ year: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const year = Number((await params).year);
  if (!Number.isInteger(year)) notFound();

  const recap = await recapFor(user.id, year).catch(() => null);

  return (
    <div className="screen">
      <ScreenHeader title={`آثرك في ${ar(year)}`} back="/" mark />
      <main className="scroll-area px-5 pb-10 pt-4">
        {!recap ? (
          <p className="mt-10 text-center text-[14px] text-muted">ما فيه لحظات في {ar(year)}، أو لم يُفتح ملخّصها بعد.</p>
        ) : (
          <>
            <Block kicker="سنتك في آثار">
              <p className="text-[40px] font-extrabold leading-tight" style={{ color: PAPER }}>
                {counted(recap.moments, "لحظة واحدة", "لحظتين", "لحظات", "لحظة")}
              </p>
              <p className="mt-1 text-[15px]" style={{ color: SOFT }}>
                كتبتها في {counted(recap.activeDays, "يوم واحد", "يومين", "أيام", "يوماً")}
              </p>
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
                {[
                  { n: recap.byKind.photos, label: "صور" },
                  { n: recap.byKind.places, label: "أماكن" },
                  { n: recap.byKind.thoughts, label: "خواطر" },
                  { n: recap.byKind.songs, label: "أغاني" },
                ]
                  .filter((row) => row.n > 0)
                  .map((row) => (
                    <span key={row.label} className="text-[15px]" style={{ color: SOFT }}>
                      <b className="text-[22px]" style={{ color: PAPER }}>{ar(row.n)}</b> {row.label}
                    </span>
                  ))}
              </div>
            </Block>

            {recap.topPlace || recap.cities.length ? (
              <Block kicker={recap.topPlace ? "أكثر مكان رجعت له" : "مدن وصلتها"}>
                {recap.topPlace ? (
                  <>
                    <p className="text-[30px] font-extrabold" style={{ color: PAPER }}>{recap.topPlace.name}</p>
                    <p className="text-[14px]" style={{ color: SOFT }}>{times(recap.topPlace.count)}</p>
                  </>
                ) : null}
                {recap.cities.length ? (
                  <p className="mt-3 text-[16px] font-bold" style={{ color: PAPER }}>
                    {counted(recap.cities.length, "مدينة واحدة", "مدينتين", "مدن", "مدينة")}: {recap.cities.join("، ")}
                  </p>
                ) : null}
              </Block>
            ) : null}

            {recap.topSong ? (
              <Block kicker="أغنيتك">
                <div className="flex items-center gap-4">
                  {recap.topSong.thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={recap.topSong.thumb} alt="" className="h-24 w-24 shrink-0 rounded-2xl object-cover" />
                  ) : null}
                  <div className="min-w-0">
                    <p className="text-[22px] font-extrabold" style={{ color: PAPER }}>{recap.topSong.title}</p>
                    {recap.topSong.artist ? <p style={{ color: SOFT }}>{recap.topSong.artist}</p> : null}
                    <p className="mt-1 text-[13px]" style={{ color: AMBER }}>شاركتها {times(recap.topSong.count)}</p>
                    {recap.topSong.url ? (
                      <a href={recap.topSong.url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[13px] font-bold" style={{ color: PAPER }}>
                        استمع
                      </a>
                    ) : null}
                  </div>
                </div>
              </Block>
            ) : null}

            {recap.lovedYou || recap.youLoved ? (
              <Block kicker="ناسك هذي السنة">
                {[
                  { label: "أكثر من تفاعل معك", person: recap.lovedYou },
                  { label: "أكثر من تفاعلت معه", person: recap.youLoved },
                ]
                  .filter((row) => row.person)
                  .map(({ label, person }) => (
                    <Link key={label} href={`/u/${person!.id}`} className="mb-3 flex items-center gap-3">
                      <Avatar name={person!.name} size={56} mediaId={person!.avatarMediaId} />
                      <span>
                        <span className="block text-[12.5px]" style={{ color: SOFT }}>{label}</span>
                        <span className="block text-[20px] font-extrabold" style={{ color: PAPER }}>{person!.name}</span>
                        <span className="block text-[12.5px]" style={{ color: AMBER }}>{ar(person!.count)} تفاعل وتعليق</span>
                      </span>
                    </Link>
                  ))}
              </Block>
            ) : null}

            {recap.reactionsGot || recap.commentsGot || recap.newFriends ? (
              <Block kicker="وصلك">
                <div className="flex flex-wrap gap-x-8 gap-y-3">
                  {[
                    { n: recap.reactionsGot, label: "تفاعل على لحظاتك" },
                    { n: recap.commentsGot, label: "تعليق" },
                    { n: recap.newFriends, label: recap.newFriends === 1 ? "صديق جديد" : "أصدقاء جدد" },
                  ]
                    .filter((row) => row.n > 0)
                    .map((row) => (
                      <span key={row.label}>
                        <b className="block text-[30px]" style={{ color: PAPER }}>{ar(row.n)}</b>
                        <span className="text-[14px]" style={{ color: SOFT }}>{row.label}</span>
                      </span>
                    ))}
                </div>
              </Block>
            ) : null}

            {recap.topMoment ? (
              <Block kicker="اللحظة اللي حرّكت دائرتك">
                <Link href={`/m/${recap.topMoment.id}`} className="block overflow-hidden rounded-2xl" style={{ background: "rgba(255,255,255,.08)" }}>
                  {recap.topMoment.mediaId ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`${BASE}/api/media/${recap.topMoment.mediaId}`} alt="" className="aspect-[5/4] w-full object-cover" />
                  ) : null}
                  {recap.topMoment.text ? (
                    <p dir="auto" className="p-3.5 text-[15px] leading-relaxed" style={{ color: PAPER }}>{recap.topMoment.text}</p>
                  ) : null}
                </Link>
              </Block>
            ) : null}

            <Block kicker="هذا آثرك">
              <ShareRecap year={recap.year} />
              <p className="mt-3 text-center text-[11px]" style={{ color: "rgba(247,245,239,.45)" }}>
                المشاركة أرقامٌ بلا أسماء — من تفاعل معك يبقى بينك وبينه
              </p>
            </Block>
          </>
        )}
      </main>
    </div>
  );
}
