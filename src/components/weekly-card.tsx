"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui";
import { BookIcon, CameraIcon, CloseIcon, MusicIcon, PinIcon, PlaneIcon, SunIcon, WithIcon } from "@/components/icons";
import { ar } from "@/lib/format";
import type { Weekly } from "@/lib/weekly";

type Person = Weekly["joined"][number];

const KEY = "athr.weekly.closed";

/**
 * «أسبوعك في دائرتك» الجمعةَ والسبت (القاعدة ٢٤٥) — نسخةُ
 * `apps/mobile/components/weekly-card.tsx`: ما جرى في دائرته وما جرى له، وكلُّ
 * وجهٍ فيه بابٌ إلى صاحبه. و«×» يطويه لهذا الأسبوع في المتصفّح.
 */
export function WeeklyCard({ week }: { week: Weekly }) {
  // الأسبوعُ يُعرف بأوّل يومه: ما طُوي الجمعة يبقى مطويّاً السبت ويعود الجمعة القادمة.
  const id = week.from.slice(0, 10);
  const [closed, setClosed] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    try {
      setClosed(window.localStorage.getItem(KEY));
    } catch {
      setClosed(null);
    }
  }, []);
  if (closed === undefined || closed === id) return null;

  const close = () => {
    setClosed(id);
    try {
      window.localStorage.setItem(KEY, id);
    } catch {
      // المخزنُ مغلق: يُطوى لهذه الصفحة وحدها.
    }
  };

  const tiles = [
    { icon: <BookIcon size={15} />, value: week.circle.moments, label: "لحظة" },
    { icon: <CameraIcon size={15} />, value: week.circle.photos, label: "صورة" },
    { icon: <PinIcon size={15} />, value: week.circle.places, label: "مكان" },
    { icon: <MusicIcon size={15} />, value: week.circle.songs, label: "أغنية" },
    { icon: <SunIcon size={15} />, value: week.circle.stories, label: "قصة" },
    { icon: <WithIcon size={15} />, value: week.circle.posters, label: "نشروا" },
  ].filter((tile) => tile.value > 0);

  return (
    <section className="mb-3 overflow-hidden rounded-[18px] border border-line bg-card">
      <div className="flex items-center gap-2 px-3.5 py-3" style={{ background: "var(--color-night)" }}>
        <div className="min-w-0 grow">
          <p className="text-[15.5px] font-extrabold" style={{ color: "#f7f5ef" }}>
            أسبوعك في دائرتك
          </p>
          <p className="mt-px text-[11.5px]" style={{ color: "rgba(247,245,239,.65)" }}>
            ملخّص الجمعة — آخر سبعة أيام
          </p>
        </div>
        <button type="button" aria-label="إخفاء لهذا الأسبوع" onClick={close} className="p-1" style={{ color: "rgba(247,245,239,.7)" }}>
          <CloseIcon size={14} />
        </button>
      </div>

      <div className="flex flex-col gap-3.5 p-3.5">
        {tiles.length ? (
          <div className="grid grid-cols-3 gap-2">
            {tiles.map((tile) => (
              <div key={tile.label} className="flex flex-col items-center gap-0.5 rounded-[14px] bg-paper py-2.5">
                <span style={{ color: "var(--color-clay-ink)" }}>{tile.icon}</span>
                <b className="text-[17px] font-extrabold text-ink">{ar(tile.value)}</b>
                <span className="text-[11px] text-muted">{tile.label}</span>
              </div>
            ))}
          </div>
        ) : null}

        {week.travelers.length ? (
          <Section icon={<PlaneIcon size={15} />} title={`${ar(week.travelers.length)} ${week.travelers.length === 1 ? "سافر" : "سافروا"}`}>
            <People rows={week.travelers.map((row) => ({ person: row.person, note: row.city }))} />
          </Section>
        ) : null}

        {week.topMoment ? (
          <Section icon={<SunIcon size={15} />} title="أكثر لحظة حرّكت الدائرة">
            <Link href={`/m/${week.topMoment.id}`} className="flex items-center gap-2.5 rounded-[14px] bg-paper p-2.5">
              <Avatar name={week.topMoment.person.name} mediaId={week.topMoment.person.avatarMediaId} size={36} />
              <span className="min-w-0 grow">
                <span dir="auto" className="block text-[13.5px] font-bold text-ink">
                  {week.topMoment.person.name}
                </span>
                <span className="block truncate text-[12px] text-muted">{week.topMoment.text || kindLabel(week.topMoment.kind)}</span>
              </span>
              <span className="shrink-0 text-[12px] font-bold" style={{ color: "var(--color-clay-ink)" }}>
                {ar(week.topMoment.reactions)} تفاعل{week.topMoment.comments ? `، ${ar(week.topMoment.comments)} تعليق` : ""}
              </span>
            </Link>
          </Section>
        ) : null}

        {week.topPlace ? (
          <Section icon={<PinIcon size={15} />} title="أكثر مكان رجعوا له">
            <p className="text-[14px] font-bold text-ink">
              {week.topPlace.name}
              {week.topPlace.visits > 1 ? (
                <span className="text-[12px] font-normal text-muted">{`  — ${ar(week.topPlace.visits)} مرّات`}</span>
              ) : null}
            </p>
          </Section>
        ) : null}

        {week.newFriends.length ? (
          <Section icon={<WithIcon size={15} />} title="أصدقاء جدد في دائرتك">
            <People rows={week.newFriends.map((person) => ({ person }))} />
          </Section>
        ) : null}

        {week.joined.length ? (
          <Section icon={<SunIcon size={15} />} title="انضمّوا إلى آثار هالأسبوع">
            <People rows={week.joined.map((person) => ({ person }))} />
          </Section>
        ) : null}

        <div className="border-t border-line pt-3">
          <p className="mb-1 text-[12.5px] font-bold text-ink-2">وأنت هالأسبوع</p>
          <p className="text-[12.5px] leading-5 text-muted">
            {week.mine.moments
              ? `نشرت ${ar(week.mine.moments)} لحظة، وجاتك ${ar(week.mine.reactions)} تفاعل و${ar(week.mine.comments)} تعليق، وشافها ${ar(week.mine.views)}.`
              : "ما نشرت شي هالأسبوع — دائرتك تنتظر لحظتك."}
          </p>
        </div>
      </div>
    </section>
  );
}

function kindLabel(kind: string) {
  return kind === "PHOTO" ? "صورة" : kind === "PLACE" ? "مكان" : kind === "MUSIC" ? "أغنية" : "لحظة";
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-[12.5px] font-bold text-ink-2">
        {icon}
        {title}
      </p>
      {children}
    </div>
  );
}

function People({ rows }: { rows: { person: Person; note?: string }[] }) {
  return (
    <div className="no-bar flex gap-3 overflow-x-auto">
      {rows.map(({ person, note }) => (
        <Link key={person.id} href={`/u/${person.id}`} className="flex w-16 shrink-0 flex-col items-center">
          <Avatar name={person.name} mediaId={person.avatarMediaId} size={46} />
          <span dir="auto" className="mt-1 w-full truncate text-center text-[11.5px] font-semibold text-ink">
            {person.name}
          </span>
          {note ? <span className="w-full truncate text-center text-[10.5px] text-muted">{note}</span> : null}
        </Link>
      ))}
    </div>
  );
}
