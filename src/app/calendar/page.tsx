import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { apiAs } from "@/lib/api-bridge";
import { Avatar, ScreenHeader } from "@/components/ui";
import { TabBar } from "@/components/tab-bar";
import { BackIcon, ClockIcon } from "@/components/icons";
import { ar } from "@/lib/format";

type Person = { id: string; name: string; avatarMediaId: string | null };
type CalendarDay = {
  date: string;
  national: { name: string; greeting: string | null; religious?: boolean }[];
  friends: { friend: Person; months: number }[];
  memories: { count: number; months: number } | null;
};
type CalendarMonth = { month: string; today: string; country: string | null; days: CalendarDay[] };

const MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const WEEK = ["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];
/** ألوانٌ ثابتة لا تتبع الثيم — كالجوّال (القاعدة ٢٩٢). */
const DOT = { national: "#1F8A55", religious: "#C28A1A", friend: "#E0568A", memory: "#3D7BD9" };

const keyOf = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;
const shift = (y: number, m: number, by: number) => {
  const index = y * 12 + (m - 1) + by;
  return { y: Math.floor(index / 12), m: (index % 12) + 1 };
};

function period(months: number): string {
  if (months === 1) return "شهر";
  if (months < 12) return `${ar(months)} أشهر`;
  const years = Math.round(months / 12);
  if (years === 1) return "سنة";
  if (years === 2) return "سنتين";
  return `${ar(years)} ${years <= 10 ? "سنوات" : "سنة"}`;
}

/**
 * التقويم — نسخةُ `apps/mobile/app/calendar.tsx` (القاعدة ٢٩٢): شهرٌ بنقاطٍ على أيّامه،
 * وما في اليوم المختار تحته. **من الخادم نفسه** (`apiAs` ← `/v1/calendar`) لا نسخةً
 * هنا: الهجريُّ والذكرياتُ والصداقةُ تُحسب في مكانٍ واحد فلا يختلف يومٌ بين الوجهين.
 * والتنقّلُ روابطُ (`?m=` و`?d=`) بلا جافاسكربت.
 */
export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ m?: string; d?: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");

  const { m, d } = await searchParams;
  const now = new Date();
  const asked = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(m ?? "");
  let view = asked ? { y: Number(asked[1]), m: Number(asked[2]) } : { y: now.getFullYear(), m: now.getMonth() + 1 };
  if (view.y < 2020 || view.y > 2100) view = { y: now.getFullYear(), m: now.getMonth() + 1 };

  const data = await apiAs<CalendarMonth>(user.id, `/v1/calendar?month=${keyOf(view.y, view.m)}`).catch(() => null);
  const byDate = new Map((data?.days ?? []).map((day) => [day.date, day]));
  const today = data?.today ?? "";

  const first = new Date(Date.UTC(view.y, view.m - 1, 1)).getUTCDay();
  const length = new Date(Date.UTC(view.y, view.m, 0)).getUTCDate();
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);

  const selected = d && d.startsWith(keyOf(view.y, view.m)) ? d : null;
  const day = selected ? byDate.get(selected) : undefined;
  const prev = shift(view.y, view.m, -1);
  const next = shift(view.y, view.m, 1);
  const monthHref = (to: { y: number; m: number }) => (to.y < 2020 || to.y > 2100 ? null : `/calendar?m=${keyOf(to.y, to.m)}`);

  const nav = (href: string | null, label: string, flip: boolean) =>
    href ? (
      <Link href={href} aria-label={label} className="flex h-9 w-9 items-center justify-center rounded-full text-ink-2">
        <span style={{ transform: flip ? "scaleX(-1)" : undefined }}>
          <BackIcon size={18} />
        </span>
      </Link>
    ) : (
      <span className="h-9 w-9" />
    );

  return (
    <div className="screen">
      <ScreenHeader title="التقويم" back="/me" />

      <main className="scroll-area flex flex-col gap-4 px-4 pb-10 pt-4">
        <section className="rounded-[20px] border border-line bg-card p-3.5">
          {/* السابقُ في اليمين والتالي في اليسار. */}
          <div className="mb-3 flex items-center">
            {nav(monthHref(prev), "الشهر السابق", true)}
            <h1 className="grow text-center text-[17px] font-extrabold text-ink">
              {MONTHS[view.m - 1]} {ar(view.y)}
            </h1>
            {nav(monthHref(next), "الشهر التالي", false)}
          </div>

          <div className="grid grid-cols-7">
            {WEEK.map((name) => (
              <span key={name} className="text-center text-[10.5px] font-semibold text-faint">
                {name}
              </span>
            ))}
          </div>

          <div className="mt-1.5 grid grid-cols-7">
            {cells.map((n, index) => {
              if (!n) return <span key={`e${index}`} className="h-[50px]" />;
              const date = `${keyOf(view.y, view.m)}-${String(n).padStart(2, "0")}`;
              const entry = byDate.get(date);
              const isToday = date === today;
              const isPicked = date === selected;
              return (
                <Link
                  key={date}
                  href={`/calendar?m=${keyOf(view.y, view.m)}&d=${date}`}
                  scroll={false}
                  aria-label={`${ar(n)} ${MONTHS[view.m - 1]}`}
                  className="flex h-[50px] flex-col items-center justify-center"
                >
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-full text-[14px]"
                    style={{
                      background: isPicked ? "var(--color-clay)" : "transparent",
                      color: isPicked ? "var(--color-on-brand)" : "var(--color-ink)",
                      fontWeight: isToday || isPicked ? 800 : 500,
                      border: isToday && !isPicked ? "1.5px solid var(--color-clay)" : "none",
                    }}
                  >
                    {ar(n)}
                  </span>
                  <span className="mt-0.5 flex h-[5px] gap-[3px]">
                    {entry?.national.some((item) => !item.religious) ? <Dot color={DOT.national} /> : null}
                    {entry?.national.some((item) => item.religious) ? <Dot color={DOT.religious} /> : null}
                    {entry?.friends.length ? <Dot color={DOT.friend} /> : null}
                    {entry?.memories ? <Dot color={DOT.memory} /> : null}
                  </span>
                </Link>
              );
            })}
          </div>

          {data ? null : <p className="mt-2 text-center text-[12px] text-muted">تعذّر جلب المناسبات الآن.</p>}

          <div className="mt-2.5 flex flex-wrap justify-center gap-x-3.5 gap-y-1">
            <Legend color={DOT.national} label="وطنية" />
            <Legend color={DOT.religious} label="إسلامية" />
            <Legend color={DOT.friend} label="صداقة" />
            <Legend color={DOT.memory} label="ذكرى" />
          </div>
        </section>

        {selected ? (
          <section className="flex flex-col gap-2">
            <h2 className="text-[14px] font-extrabold text-ground-ink">
              {ar(Number(selected.slice(8)))} {MONTHS[view.m - 1]}
              {selected === today ? " · اليوم" : ""}
            </h2>
            {day ? (
              <div className="overflow-hidden rounded-2xl border border-line bg-card">
                {day.national.map((item) => (
                  <Row key={item.name} color={item.religious ? DOT.religious : DOT.national}>
                    <b className="text-[14px] text-ink">{item.name}</b>
                    {item.greeting ? <span className="text-[12px] leading-5 text-muted">{item.greeting}</span> : null}
                  </Row>
                ))}
                {day.friends.map(({ friend, months }) => (
                  <Link key={friend.id} href={`/u/${friend.id}`} className="block">
                    <Row color={DOT.friend} lead={<Avatar name={friend.name} mediaId={friend.avatarMediaId} size={34} />}>
                      <b dir="auto" className="text-[13.5px] text-ink">{friend.name}</b>
                      <span className="text-[12px] text-muted">
                        {selected === today ? "اليوم " : ""}تكمل صداقتكما {period(months)}
                      </span>
                    </Row>
                  </Link>
                ))}
                {day.memories ? (
                  <Row color={DOT.memory} lead={<span className="text-ink-2"><ClockIcon size={20} /></span>}>
                    <b className="text-[13.5px] text-ink">
                      {day.memories.count === 1 ? "ذكرى واحدة" : day.memories.count === 2 ? "ذكريان" : `${ar(day.memories.count)} ذكريات`}
                    </b>
                    <span className="text-[12px] text-muted">
                      لحظاتٌ كتبتها قبل {period(day.memories.months)}
                      {selected === today ? " — تجدها في أعلى اللحظات" : ""}
                    </span>
                  </Row>
                ) : null}
              </div>
            ) : (
              <p className="text-[12.5px] text-ground-muted">لا شيء في هذا اليوم.</p>
            )}
          </section>
        ) : null}
      </main>

      <TabBar active="/me" />
    </div>
  );
}

const Dot = ({ color }: { color: string }) => <span className="block h-[5px] w-[5px] rounded-full" style={{ background: color }} />;

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-muted">
      <Dot color={color} />
      {label}
    </span>
  );
}

function Row({ color, lead, children }: { color: string; lead?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-b border-line px-3.5 py-3 last:border-b-0">
      <span className="w-1 self-stretch rounded-sm" style={{ background: color }} />
      {lead}
      <div className="flex min-w-0 grow flex-col gap-0.5">{children}</div>
    </div>
  );
}
