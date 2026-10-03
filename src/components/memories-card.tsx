import Link from "next/link";
import { Avatar } from "@/components/ui";
import { ClockIcon, FlameIcon, SparkIcon, WithIcon } from "@/components/icons";
import { DismissMemories, ShareMemory } from "@/components/memory-share";
import { BASE } from "@/lib/base";
import { ar } from "@/lib/format";
import type { today } from "@/lib/memories";

type Today = Awaited<ReturnType<typeof today>>;
type Item = Today["memories"][number]["moments"][number];

const MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];
const dateText = (at: Date) => `${ar(at.getDate())} ${MONTHS[at.getMonth()]} ${ar(at.getFullYear())}`;
const SHAREABLE = new Set(["PHOTO", "PLACE", "THOUGHT", "MUSIC", "CITY"]);

/** ما تقوله الذكرى في سطر — كالجوّال حرفاً بحرف. */
function memoryTitle(moment: Item) {
  switch (moment.kind) {
    case "PLACE":
      return `كنت في ${moment.placeName ?? moment.placeCity ?? "مكانٍ تذكره"}`;
    case "CITY":
      return `وصلت إلى ${moment.text ?? moment.placeCity ?? "مدينةٍ جديدة"}`;
    case "MUSIC":
      return moment.musicTitle ? `كنت تسمع «${moment.musicTitle}»` : "شاركت أغنية";
    case "JOINED":
      return "انضممت إلى آثار مومنتس";
    case "PHOTO":
      return moment.text || "صورة";
    default:
      return moment.text || "لحظة";
  }
}

function Thumb({ moment, size }: { moment: Item; size: number }) {
  const box = { width: size, height: size };
  if (moment.mediaId) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`${BASE}/api/media/${moment.mediaId}`} alt="" className="shrink-0 rounded-xl object-cover" style={box} />;
  }
  if (moment.musicThumb) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={moment.musicThumb} alt="" className="shrink-0 rounded-xl object-cover" style={box} />;
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-xl text-ink-2"
      style={{ ...box, background: moment.imageSpec ?? "var(--color-chip)" }}
    >
      {moment.imageSpec ? null : <ClockIcon size={20} />}
    </span>
  );
}

/**
 * بطاقةُ اليوم أعلى اللحظات (القاعدة ٢٣٥) — نسخةُ `apps/mobile/components/
 * memories-card.tsx`: ذكرياتُ اليوم ومناسباتُ الصداقة و«آثرك جاهز» في نافذته،
 * لصاحبها وحده. و«×» يطويها لليوم على الجهازين.
 */
export function MemoriesCard({ data }: { data: Today }) {
  const { memories, occasions, moments, recapYear } = data;
  if (memories.length === 0 && occasions.length === 0 && !recapYear) return null;
  const byId = new Map(moments.map((moment) => [moment.id, moment]));

  return (
    <section className="mb-3 rounded-[18px] border border-line bg-card px-3.5 pb-1.5 pt-3">
      {recapYear ? (
        <Link
          href={`/recap/${recapYear}`}
          className="mb-2 flex items-center gap-2.5 rounded-2xl p-3"
          style={{ background: "var(--color-night)" }}
        >
          <span style={{ color: "#F6B93B" }}>
            <SparkIcon size={18} />
          </span>
          <span className="min-w-0 grow">
            <span className="block text-[14px] font-bold" style={{ color: "#f7f5ef" }}>
              آثرك في {ar(recapYear)} جاهز
            </span>
            <span className="block text-[11.5px]" style={{ color: "rgba(247,245,239,.7)" }}>
              سنتك في دقيقة — لحظاتك وأماكنك ومن كان معك
            </span>
          </span>
        </Link>
      ) : null}

      {memories.length > 0 || occasions.length > 0 ? (
        <div className="flex items-center gap-2">
          <span className="text-clay-ink">
            <ClockIcon size={16} />
          </span>
          <h2 className="grow text-[14.5px] font-bold text-ink">
            {memories.length > 0 ? "في مثل هذا اليوم" : "مناسبات اليوم"}
          </h2>
          <DismissMemories />
        </div>
      ) : null}

      {memories.map((group) => (
        <div key={group.months} className="mt-2">
          <span className="inline-block rounded-full bg-paper px-2.5 py-0.5 text-[11.5px] font-bold text-ink-2">
            {group.label}
          </span>
          {group.moments.map((moment) => (
            <div key={moment.id} className="flex items-center gap-3 py-2">
              <Link href={`/m/${moment.id}`} className="flex min-w-0 grow items-center gap-3">
                <Thumb moment={moment} size={54} />
                <span className="min-w-0 grow">
                  <span dir="auto" className="line-clamp-2 block text-[13.5px] font-semibold leading-snug text-ink">
                    {memoryTitle(moment)}
                  </span>
                  <span className="mt-0.5 block text-[11.5px] text-muted">{dateText(moment.createdAt)}</span>
                </span>
              </Link>
              {SHAREABLE.has(moment.kind) ? <ShareMemory momentId={moment.id} /> : null}
            </div>
          ))}
        </div>
      ))}

      {occasions.length > 0 ? (
        <div className={memories.length ? "mt-1.5 border-t border-line pt-1.5" : "mt-2"}>
          {occasions.map((occasion) => {
            const moment = occasion.momentId ? byId.get(occasion.momentId) : null;
            return (
              <div key={occasion.id} className="py-2">
                <Link href={`/u/${occasion.friend.id}`} className="flex items-center gap-3">
                  <span className="relative shrink-0">
                    <Avatar name={occasion.friend.name} size={46} mediaId={occasion.friend.avatarMediaId} />
                    <span
                      className="absolute -bottom-0.5 -right-0.5 flex h-[22px] w-[22px] items-center justify-center rounded-full border border-line bg-card"
                      style={{ color: occasion.kind === "STREAK" ? "var(--color-live)" : "var(--color-ink-2)" }}
                    >
                      {occasion.kind === "STREAK" ? <FlameIcon size={12} /> : <WithIcon size={12} />}
                    </span>
                  </span>
                  <span className="min-w-0 grow">
                    <span className="block text-[13.5px] font-bold leading-snug text-ink">{occasion.title}</span>
                    {occasion.detail ? (
                      <span className="mt-0.5 block text-[12px] leading-snug text-ink-2">{occasion.detail}</span>
                    ) : null}
                  </span>
                </Link>
                {moment ? (
                  <Link
                    href={`/m/${moment.id}`}
                    className="mr-[58px] mt-2 flex items-center gap-2.5 rounded-xl border border-line bg-paper p-2"
                  >
                    {moment.mediaId ? <Thumb moment={moment} size={36} /> : null}
                    <span className="min-w-0 grow">
                      <span dir="auto" className="block truncate text-[12.5px] font-semibold text-ink">
                        {memoryTitle(moment)}
                      </span>
                      <span className="block text-[11px] text-muted">أول لحظة جمعتكما، {dateText(moment.createdAt)}</span>
                    </span>
                  </Link>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
