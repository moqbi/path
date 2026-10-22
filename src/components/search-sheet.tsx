"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { GlassSheet } from "@/components/glass-sheet";
import { Avatar } from "@/components/ui";
import { MusicIcon, PinIcon, SearchIcon, SparkIcon, WithIcon } from "@/components/icons";
import { smartSearch, type SearchMoment, type SearchResult } from "@/app/search-actions";
import { ar, dayLabel } from "@/lib/format";
import { BASE } from "@/lib/base";

const glass = { background: "rgba(255,255,255,.08)", borderRadius: 16 } as const;
const EXAMPLES = ["نورة", "الرياض", "قهوة", "مع خالد"];

/**
 * البحثُ الذكيّ — نسخةُ `apps/mobile/components/search-sheet.tsx` (القاعدة ٣٣٥): عدسةٌ
 * بين «آثار+» والجرس تفتح نافذةً زجاجيّة. سطرٌ واحد يُفهم، والنتائجُ أصدقاءُ بأثرهم
 * المشترك، فأماكن، فمدن، فلحظات — من الخادم نفسه (`smartSearch`).
 */
export function SearchButton({ isPlus }: { isPlus: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="البحث الذكي"
        className="flex h-10 w-10 items-center justify-center rounded-full"
        style={{ background: "rgba(255,255,255,.08)", color: "var(--color-chrome-ink)" }}
      >
        <SearchIcon size={19} />
      </button>
      {open ? <Body isPlus={isPlus} close={() => setOpen(false)} /> : null}
    </>
  );
}

function Body({ isPlus, close }: { isPlus: boolean; close: () => void }) {
  const [query, setQuery] = useState("");
  const [asked, setAsked] = useState("");
  const [data, setData] = useState<SearchResult | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // يُسأل بعد أن تقف اليد ٣٥٠ مللي — لا مع كلّ حرف.
  useEffect(() => {
    const id = setTimeout(() => setAsked(query.trim()), 350);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    let live = true;
    start(async () => {
      const res = await smartSearch(asked);
      if (!live) return;
      if ("error" in res) setProblem(res.error);
      else {
        setProblem(null);
        setData(res);
      }
    });
    return () => {
      live = false;
    };
  }, [asked]);

  const empty =
    data && !data.suggest && asked.length >= 2 &&
    !data.friends.length && !data.places.length && !data.cities.length && !data.moments.length;

  const heading = (label: string) => (
    <p className="mt-1.5 text-[12px] font-bold" style={{ color: "rgba(255,255,255,.55)" }}>
      {label}
    </p>
  );
  const chip = (key: string, label: string, count: number, icon: React.ReactNode) => (
    <button
      key={key}
      type="button"
      onClick={() => setQuery(label)}
      className="flex h-9 items-center gap-1.5 rounded-full px-3"
      style={glass}
    >
      {icon}
      <span dir="auto" className="max-w-[160px] truncate text-[13px] font-semibold text-white">
        {label}
      </span>
      <span className="text-[11.5px]" style={{ color: "rgba(255,255,255,.5)" }}>
        {ar(count)}
      </span>
    </button>
  );

  return (
    <GlassSheet title="البحث الذكي" subtitle="لحظة، مكان، مدينة، أو صديق" onClose={close}>
      <div className="flex flex-col gap-2.5 p-4">
        <div className="flex h-12 items-center gap-2 px-3.5" style={glass}>
          <SearchIcon size={18} className="text-white/60" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") setAsked(query.trim());
            }}
            autoFocus
            placeholder="مثلاً: نورة جدة، أو ستاربكس"
            aria-label="البحث الذكي"
            autoCorrect="off"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-white/40"
          />
          {pending ? <span className="text-[12px] text-white/60">…</span> : null}
        </div>

        {asked.length < 2 ? (
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((one) => (
              <button key={one} type="button" onClick={() => setQuery(one)} className="h-8 rounded-full px-3 text-[12.5px]" style={{ ...glass, color: "rgba(255,255,255,.75)" }}>
                {one}
              </button>
            ))}
          </div>
        ) : null}

        {problem ? <p className="text-center text-[13px] text-white/70">{problem}</p> : null}

        {data?.friends.length ? (
          <>
            {heading("أصدقاء")}
            {data.friends.map((person) => (
              <Link
                key={person.id}
                href={isPlus ? `/u/${person.id}?tab=together` : `/u/${person.id}`}
                onClick={close}
                className="flex items-center gap-3 p-2.5"
                style={glass}
              >
                <Avatar name={person.name} mediaId={person.avatarMediaId} size={40} />
                <span className="min-w-0 flex-1">
                  <span dir="auto" className="block truncate text-[14.5px] font-bold text-white">
                    {person.name}
                  </span>
                  <span className="block text-[12px]" style={{ color: "rgba(255,255,255,.6)" }}>
                    {person.together === null
                      ? "آثاركم المشتركة مع آثار+"
                      : person.together > 0
                        ? `${ar(person.together)} لحظة جمعتكم`
                        : "ما فيه لحظة جمعتكم بعد"}
                  </span>
                </span>
                <span style={{ color: person.together === null ? "var(--color-gold)" : "var(--color-clay)" }}>
                  {person.together === null ? <SparkIcon size={16} /> : <WithIcon size={18} />}
                </span>
              </Link>
            ))}
          </>
        ) : null}

        {data?.places.length ? (
          <>
            {heading(data.suggest ? "أماكن رجعت لها" : "أماكن")}
            <div className="flex flex-wrap gap-2">
              {data.places.map((place) =>
                chip(`p-${place.name}`, place.name, place.count, <PinIcon size={14} className="text-[var(--color-clay)]" />),
              )}
            </div>
          </>
        ) : null}

        {data?.cities.length ? (
          <>
            {heading(data.suggest ? "مدنك" : "مدن")}
            <div className="flex flex-wrap gap-2">
              {data.cities.map((city) => chip(`c-${city.name}`, city.name, city.count, <PinIcon size={14} className="text-white/70" />))}
            </div>
          </>
        ) : null}

        {data?.moments.length ? (
          <>
            {heading(`لحظات · ${ar(data.moments.length)}`)}
            {data.moments.map((moment) => (
              <MomentRow key={moment.id} moment={moment} onOpen={close} />
            ))}
          </>
        ) : null}

        {empty ? (
          <p className="mt-4 text-center text-[13.5px]" style={{ color: "rgba(255,255,255,.6)" }}>
            ما لقينا شيء بـ«{asked}» — جرّب اسم مكان أو مدينة أو صديق
          </p>
        ) : null}
      </div>
    </GlassSheet>
  );
}

/** سطرُ اللحظة: صورتُها أو أيقونةُ نوعها، ثمّ ما يُقرأ منها، ثمّ صاحبُها ويومُها. */
function MomentRow({ moment, onOpen }: { moment: SearchMoment; onOpen: () => void }) {
  const line =
    moment.text ||
    (moment.musicTitle ? `${moment.musicTitle}${moment.musicArtist ? ` — ${moment.musicArtist}` : ""}` : null) ||
    (moment.placeName ? `في ${moment.placeName}` : null) ||
    (moment.placeCity ? `في ${moment.placeCity}` : "لحظة");
  const where = [moment.placeName, moment.placeCity]
    .filter(Boolean)
    .filter((one, index, all) => all.indexOf(one) === index)
    .join("، ");
  return (
    <Link href={`/m/${moment.id}`} onClick={onOpen} className="flex items-center gap-3 p-2.5" style={glass}>
      <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl" style={{ background: "rgba(255,255,255,.1)" }}>
        {moment.mediaId ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`${BASE}/api/media/${moment.mediaId}`} alt="" className="h-12 w-12 object-cover" />
        ) : moment.musicTitle ? (
          <MusicIcon size={20} className="text-[var(--color-clay)]" />
        ) : moment.placeName || moment.placeCity ? (
          <PinIcon size={20} className="text-[var(--color-clay)]" />
        ) : (
          <Avatar name={moment.author.name} mediaId={moment.author.avatarMediaId} size={36} />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span dir="auto" className="line-clamp-2 block text-[14px] leading-[21px] text-white">
          {line}
        </span>
        <span className="block truncate text-[11.5px]" style={{ color: "rgba(255,255,255,.55)" }}>
          {moment.author.name} · {dayLabel(new Date(moment.createdAt))}
          {where && moment.text ? ` · ${where}` : ""}
        </span>
      </span>
    </Link>
  );
}
