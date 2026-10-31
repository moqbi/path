import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { book } from "@/lib/archive";
import { Avatar, ScreenHeader } from "@/components/ui";
import { AthrMark } from "@/components/brand";
import { BASE } from "@/lib/base";
import { ar, MONTHS } from "@/lib/format";
import { ReactionGlyph } from "@/components/reactions";
import { PrintButton } from "./print-button";
import { BOOK_SECTION_LABEL, bookBlocks, type BookCover, type BookSection } from "@/lib/book-prefs";

type Moment = Awaited<ReturnType<typeof book>>["moments"][number];

// ورقُ الكتاب وحبرُه — كالـPDF (`apps/api/src/services/book-print.ts`) لا ألوانُ الثيم.
const PAPER = "#FBF8F1";
const INK = "#182830";
const RULE = "#E4DCC8";
const MUTED = "#8a949a";
const KICKER = "#b07d1c";
const NIGHT = "#0E1A24";
const GOLD = "#F6B93B";
// صوتُ الراوي — بنّيٌّ دافئ يفصله عن كلام صاحب اللحظة (القاعدة ٢٥٩).
const STORY = "#6a5420";

const WEEKDAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

const names = (list: string[]) =>
  list.length <= 1 ? list.join("") : `${list.slice(0, -1).join("، ")} و${list.at(-1)}`;

/** لمن كانت اللحظة الخاصّة — بلسان صاحبها (القاعدة ٢٥٦). */
function privateNote(moment: Moment): string | null {
  const p = moment.private;
  if (!p) return null;
  if (p.audience === "PICKED") return p.people.length ? `لحظة خاصة — شاركتها مع ${names(p.people)}` : "لحظة خاصة";
  if (p.audience === "GROUP") return p.group ? `لحظة خاصة — لتصنيف ${p.group}` : "لحظة خاصة";
  // «الكل ما عدا» عامّةٌ لا خاصّة — بقرار المالك: يُقال لمن لم تكن، بلا «خاصة».
  return p.group ? `للكل ما عدا ${p.group}` : null;
}

function clock(at: Date): string {
  const h = at.getHours();
  return `${ar(h % 12 || 12)}:${ar(String(at.getMinutes()).padStart(2, "0"))} ${h < 12 ? "ص" : "م"}`;
}

/**
 * «سنتك في كتاب» على الويب (القاعدة ٢٤٤): صفحاتٌ تُقرأ ثمّ تُطبع — **كلُّ يومٍ
 * صفحة** ولحظاتُه مرقّمةٌ فيها (القاعدة ٢٥٦) — فالطباعةُ ورقٌ حقيقيّ أو PDF يُحفظ.
 */
export default async function BookPage({ params }: { params: Promise<{ year: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const year = Number((await params).year);
  if (!Number.isInteger(year) || year < 2024 || year > 2100) notFound();
  const data = await book(user.id, year);
  const s = data.stats;

  const sections: { month: number; days: typeof data.days }[] = [];
  for (const day of data.days) {
    const month = Number(day.day.slice(5, 7)) - 1;
    const last = sections.at(-1);
    if (last && last.month === month) last.days.push(day);
    else sections.push({ month, days: [day] });
  }

  return (
    <div className="screen book">
      <style>{`
        .book .page { break-after: page; }
        .book .sheet { border-radius: 6px; box-shadow: 0 1px 2px rgba(14,26,36,.08), 0 10px 28px rgba(14,26,36,.12); }
        .book .display { font-family: var(--font-display); }
        .book .moment { break-inside: avoid; }
        @media print {
          .screen, .scroll-area, .shell { height: auto !important; overflow: visible !important; }
          .chrome, .tabbar, .no-print, nav { display: none !important; }
          .book .page { min-height: 96vh; margin: 0 !important; border: 0 !important; border-radius: 0 !important; box-shadow: none !important; }
          body { background: #fff !important; }
        }
      `}</style>
      <ScreenHeader title={`كتاب ${ar(year)}`} back="/archive" mark />
      <main className="scroll-area px-5 pb-10 pt-4">
        <div className="no-print mb-4 flex items-center justify-between gap-3">
          <p className="text-[12px] text-muted">
            {ar(data.moments.length)} لحظة في {ar(data.days.length)} يوماً — كلّ يوم صفحة
          </p>
          <PrintButton />
        </div>

        <Cover cover={data.prefs.cover} title={data.prefs.title} year={year} name={data.name} memberNo={data.memberNo} avatarMediaId={data.avatarMediaId} />
        {data.prefs.dedication ? (
          <section className="page sheet mb-6 flex flex-col items-center justify-center p-10 text-center" style={{ background: PAPER, minHeight: 340 }}>
            <span className="block h-[2px] w-9 rounded" style={{ background: GOLD }} />
            <p className="display mt-4 text-[19px] font-bold leading-[1.8]" style={{ color: "#3c4a52" }}>{data.prefs.dedication}</p>
          </section>
        ) : null}

        {bookBlocks(data.prefs).map((block) =>
          Array.isArray(block) ? (
            <Intro key={block.join("-")} ids={block} data={data} />
          ) : block === "end" ? (
            <End key="end" moments={s.moments} year={year} />
          ) : (
            <div key="months">
        {sections.map((section) => (
          <div key={section.month}>
            <section className="page sheet relative mb-6 flex flex-col justify-end overflow-hidden p-6 pb-8" style={{ background: PAPER, color: INK, minHeight: 340 }}>
              <span className="display absolute left-4 top-1 text-[150px] font-extrabold leading-none" style={{ color: "#F1E8D2" }}>{ar(section.month + 1)}</span>
              <p className="relative text-[11px] tracking-[3px]" style={{ color: KICKER }}>{ar(year)}</p>
              <p className="display relative text-[46px] font-extrabold leading-tight">{MONTHS[section.month]}</p>
              <span className="relative mt-2.5 block h-[2px] w-9 rounded" style={{ background: GOLD }} />
              <p className="relative mt-2.5 text-[12px]" style={{ color: "#6b7880" }}>
                {ar(section.days.reduce((sum, day) => sum + day.moments.length, 0))} لحظة
              </p>
            </section>
            {section.days.map((day) => {
              const [y, m, d] = day.day.split("-").map(Number);
              const count = day.moments.length;
              return (
                <section key={day.day} className="page sheet mb-6 p-5" style={{ background: PAPER, color: INK }}>
                  <div className="mb-4 flex items-end gap-3 border-b pb-3" style={{ borderColor: RULE }}>
                    <span className="display text-[46px] font-extrabold leading-[1]">{ar(d)}</span>
                    <span className="min-w-0 flex-1 pb-0.5">
                      <span className="display block text-[17px] font-extrabold">{MONTHS[m - 1]}</span>
                      <span className="block text-[11.5px]" style={{ color: "#6b7880" }}>{WEEKDAYS[new Date(y, m - 1, d).getDay()]}</span>
                    </span>
                    <span className="mb-1 rounded-full border px-2.5 py-0.5 text-[11px]" style={{ borderColor: RULE, color: "#8a7a55" }}>
                      {ar(count)} {count === 1 ? "لحظة" : "لحظات"}
                    </span>
                  </div>
                  <ol>
                    {day.moments.map((moment, index) => {
                      const note = privateNote(moment);
                      const last = index === count - 1;
                      // ما فعله يُروى، وكلامُه هو يبقى كما كتبه (القاعدة ٢٥٩).
                      const own = moment.kind === "PHOTO" || moment.kind === "THOUGHT" ? (moment.text ?? "") : "";
                      const quote = moment.echo?.quote;
                      return (
                        <li key={moment.id} className="moment flex gap-3">
                          <span className="flex w-[22px] shrink-0 flex-col items-center">
                            <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full text-[11px] font-bold" style={{ background: NIGHT, color: GOLD }}>
                              {ar(index + 1)}
                            </span>
                            {last ? null : <span className="mt-0.5 w-px flex-1" style={{ background: RULE }} />}
                          </span>
                          <Link href={`/m/${moment.id}`} className={`block min-w-0 flex-1 ${last ? "" : "pb-5"}`}>
                            <p className="mb-1.5 mt-[3px] text-[11px]" style={{ color: MUTED }}>
                              {clock(moment.createdAt)}
                              {moment.placeName && moment.kind === "PHOTO" ? ` · ${moment.placeName}` : ""}
                            </p>
                            {moment.story ? (
                              <p className="mb-2 text-[13.5px] leading-[1.8]" style={{ color: STORY }}>
                                {moment.story}
                              </p>
                            ) : null}
                            {moment.mediaId ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={`${BASE}/api/media/${moment.mediaId}`}
                                alt=""
                                className="mb-2 w-full rounded-[10px] object-cover"
                                style={{ aspectRatio: "5 / 4", objectPosition: `${moment.photoX ?? 50}% ${moment.photoY ?? 50}%`, boxShadow: "0 6px 16px rgba(14,26,36,.08)" }}
                              />
                            ) : null}
                            {own ? (
                              <p className={moment.mediaId ? "text-[14px] leading-[1.8]" : "display text-[18px] font-bold leading-[1.55]"}>{own}</p>
                            ) : null}
                            {moment.echoText ? (
                              <p className="mt-2.5 flex items-start gap-2 text-[12.5px] leading-[1.75]" style={{ color: "#3c4a52" }}>
                                {moment.echo?.top ? (
                                  <span className="mt-0.5 shrink-0">
                                    <ReactionGlyph kind={moment.echo.top.kind} emoji={moment.echo.top.emoji} size={20} />
                                  </span>
                                ) : null}
                                <span className="min-w-0 flex-1">{moment.echoText}</span>
                              </p>
                            ) : null}
                            {quote ? (
                              <blockquote className="mt-1.5 rounded-l-lg border-r-2 px-3 py-2 text-[13.5px] leading-[1.8]" style={{ borderColor: GOLD, background: "#F6EFDD" }}>
                                «{quote.text}»
                                <cite className="mt-0.5 block text-[11px] not-italic" style={{ color: "#8a7a55" }}>— {quote.name}</cite>
                              </blockquote>
                            ) : null}
                            {note ? (
                              <p className="mt-2 inline-block rounded-md border px-2 py-0.5 text-[11px]" style={{ background: "#FBF1DA", borderColor: "#EBD9AE", color: "#8a5f10" }}>
                                {note}
                              </p>
                            ) : null}
                          </Link>
                        </li>
                      );
                    })}
                  </ol>
                </section>
              );
            })}
          </div>
        ))}

            </div>
          ),
        )}
      </main>
    </div>
  );
}

type Data = Awaited<ReturnType<typeof book>>;

/** الغلافُ بتصميمه (القاعدة ٣٧٨) — كالـPDF: ليليٌّ كما كان، وكلاسيكيٌّ بورقه وإطاره، وبسيطٌ بخطٍّ مرجانيّ. */
function Cover({ cover, title, year, name, memberNo, avatarMediaId }: { cover: BookCover; title: string | null; year: number; name: string; memberNo: number; avatarMediaId: string | null }) {
  if (cover === "minimal") {
    return (
      <section className="page sheet relative mb-6 flex flex-col px-8 pb-8 pt-12" style={{ background: "#EDE6D8", color: INK, minHeight: 560 }}>
        <span className="absolute right-6 top-12 block w-[3px] rounded" style={{ background: "#FF7A5A", height: "58%" }} />
        <div className="mr-3">
          <p className="text-[10.5px] tracking-[3px]" style={{ color: KICKER }}>كتاب السنة</p>
          <p className={`display mt-1.5 font-extrabold ${title ? "text-[30px] leading-[1.45]" : "text-[46px] leading-tight"}`}>{title ?? ar(year)}</p>
          {title ? <p className="mt-1 text-[14px]" style={{ color: "#6b7880" }}>{ar(year)}</p> : null}
        </div>
        <div className="mt-auto flex items-end justify-between pt-16">
          <span className="text-[12px]" style={{ color: "#3c4a52" }}>{name} · عضوية {ar(memberNo)}</span>
          <AthrMark size={30} />
        </div>
      </section>
    );
  }
  const paper = cover === "paper";
  const ink = paper ? INK : "#f7f5ef";
  return (
    <section className="page sheet relative mb-6 flex flex-col items-center px-6 pb-8 pt-12 text-center" style={{ background: paper ? PAPER : NIGHT, minHeight: 560 }}>
      {paper ? (
        <span className="pointer-events-none absolute inset-4 border" style={{ borderColor: "#D9C9A3" }}>
          <span className="absolute inset-1 border" style={{ borderColor: "#EBDFC4" }} />
        </span>
      ) : null}
      <AthrMark size={60} />
      <p className="mt-7 text-[11px] tracking-[3px]" style={{ color: paper ? KICKER : "rgba(247,245,239,.55)" }}>كتاب السنة</p>
      <p className="display mt-1 text-[80px] font-extrabold leading-none" style={{ color: paper ? "#B9A27A" : ink }}>{ar(year)}</p>
      <span className="mt-5 block h-[2px] w-9 rounded" style={{ background: GOLD }} />
      {title ? <p className={`display mt-4 font-extrabold leading-[1.5] ${paper ? "text-[24px]" : "text-[21px]"}`} style={{ color: ink }}>{title}</p> : null}
      <div className="relative mt-auto flex flex-col items-center pt-16">
        <Avatar name={name} mediaId={avatarMediaId} size={64} />
        <p className="display mt-2.5 text-[19px] font-extrabold" style={{ color: ink }}>{name}</p>
        <p className="text-[11px]" style={{ color: paper ? MUTED : "rgba(247,245,239,.5)" }}>عضوية رقم {ar(memberNo)}</p>
      </div>
      <p className="relative mt-7 text-[12.5px] tracking-[1px]" style={{ color: paper ? KICKER : GOLD }}>لحظاتك، مع ناسك.</p>
    </section>
  );
}

/** صفحةُ المقدّمة بأقسامها المتجاورة (القاعدة ٣٧٨). */
function Intro({ ids, data }: { ids: BookSection[]; data: Data }) {
  const s = data.stats;
  const facts = (rows: (string[] | null)[]) => {
    const list = rows.filter(Boolean) as string[][];
    return list.length ? (
      <div className="mt-4">
        {list.map(([k, v]) => (
          <div key={k} className="flex gap-3 border-b py-2.5 text-[13.5px]" style={{ borderColor: "#EFE8D8" }}>
            <span className="w-[92px] shrink-0 pt-0.5 text-[11.5px]" style={{ color: "#8a7a55" }}>{k}</span>
            <span className="min-w-0 flex-1">{v}</span>
          </div>
        ))}
      </div>
    ) : null;
  };
  const part = (id: BookSection, first: boolean) => {
    if (id === "numbers")
      return (
        <div className="mt-5 grid grid-cols-2 border-t" style={{ borderColor: RULE }}>
          {[
            [s.moments, "لحظة"],
            [data.days.length, "يوماً كتبت فيها"],
            [s.photos, "صورة"],
            [s.places, "مكان"],
            [s.songs, "أغنية"],
            [s.cities.length, "مدينة"],
          ]
            .filter(([n]) => Number(n) > 0)
            .map(([n, label], i) => (
              <div key={String(label)} className="border-b py-4" style={{ borderColor: RULE, ...(i % 2 ? { paddingRight: 14 } : { paddingLeft: 14, borderLeft: `1px solid ${RULE}` }) }}>
                <p className="display text-[36px] font-extrabold leading-tight">{ar(n)}</p>
                <p className="text-[11.5px]" style={{ color: "#6b7880" }}>{label}</p>
              </div>
            ))}
        </div>
      );
    if (id === "places")
      return facts([
        s.cities.length ? ["مدنك", s.cities.join("، ")] : null,
        s.topPlace ? ["أكثر مكان رجعت له", `${s.topPlace.name}${s.topPlace.visits > 1 ? ` — ${ar(s.topPlace.visits)} مرّات` : ""}`] : null,
      ]);
    if (id === "song") return facts([s.topSong ? ["أغنيتك", s.topSong] : null]);
    if (id === "circle" && s.circleLines.length)
      return (
        <div className={first ? "mt-3" : "mt-5 border-t pt-3.5"} style={{ borderColor: RULE }}>
          {first ? null : <p className="mb-1.5 text-[10.5px] tracking-[3px]" style={{ color: KICKER }}>دائرتك</p>}
          {s.circleLines.map((text) => (
            <p key={text} className="text-[13px] leading-[1.85]" style={{ color: "#3c4a52" }}>
              {text}
            </p>
          ))}
        </div>
      );
    return null;
  };
  return (
    <section className="page sheet mb-6 p-6" style={{ background: PAPER, color: INK }}>
      <p className="text-[10.5px] tracking-[3px]" style={{ color: KICKER }}>مقدّمة</p>
      <h2 className="display text-[26px] font-extrabold">{BOOK_SECTION_LABEL[ids[0]]}</h2>
      {ids.map((id, at) => (
        <div key={id}>{part(id, at === 0)}</div>
      ))}
      {data.partial ? <p className="mt-4 text-[11px]" style={{ color: MUTED }}>هذا الكتاب من آخر ستة أشهر من سنتك — السنة كاملة مع آثار+.</p> : null}
    </section>
  );
}

function End({ moments, year }: { moments: number; year: number }) {
  return (
        <section className="page sheet flex flex-col items-center justify-center p-8 text-center" style={{ background: NIGHT, minHeight: 340 }}>
          <AthrMark size={48} />
          <p className="display mt-5 text-[21px] font-extrabold leading-relaxed" style={{ color: "#f7f5ef" }}>
            {ar(moments)} لحظة تركت أثرها
            <br />
            في {ar(year)}
          </p>
          <span className="mt-3.5 block h-[2px] w-9 rounded" style={{ background: GOLD }} />
          <p className="mt-3 text-[12.5px]" style={{ color: "rgba(247,245,239,.6)" }}>والصفحة الجاية تكتبها أنت.</p>
        </section>
  );
}
