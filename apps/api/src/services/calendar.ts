import { prisma, type NationalDay } from "@athar/db";
import { ALL_COUNTRIES, COUNTRIES, countryOf } from "@athar/shared";
import { dayKey, monthsBefore, riyadhDay, type Day } from "../lib/riyadh-day";
import { celebrated, MEMORABLE, memoryPeriods } from "./memories";

/**
 * التقويمُ في «أنا» (القاعدة ٢٩٢): شهرٌ ميلاديّ، وفي أيّامه ثلاثة — الذكرياتُ
 * (ما كتبه صاحبُه قبل شهرٍ أو ستّةٍ أو سنواتٍ في ذلك اليوم)، ومناسباتُ الصداقة،
 * والمناسباتُ الوطنيّة لدولته. **يُشتقّ ولا يُخزَّن** كالذكريات (القاعدة ٢٣٥)،
 * وخاصٌّ بصاحبه.
 */

// ───────────────────────────── الهجريّ ─────────────────────────────

const HIJRI = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", {
  timeZone: "UTC",
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

/** يومٌ ميلاديّ بتاريخه الهجريّ بتقويم أمّ القرى — تقويمُ المملكة الرسميّ. */
export function hijriOf(day: Day): { month: number; day: number } {
  const parts = HIJRI.formatToParts(new Date(Date.UTC(day.y, day.m - 1, day.d, 12)));
  const pick = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { month: pick("month"), day: pick("day") };
}

/**
 * مدى التقويم: السنةُ تأتي من الطلب، وكلُّ سنةٍ تُبنى لها خريطةٌ تبقى في الذاكرة —
 * فبلا حدٍّ يملأ الذاكرةَ من يطلب السنوات واحدةً واحدة.
 */
export const CALENDAR_YEARS = { from: 2020, to: 2100 } as const;

/** خريطةُ سنةٍ ميلاديّة: «شهر-يوم» هجريّ ← أيّامُه الميلاديّة فيها (قد يقع مرّتين). */
const yearMaps = new Map<number, Map<string, Day[]>>();
function hijriYear(year: number) {
  if (year < CALENDAR_YEARS.from || year > CALENDAR_YEARS.to) return new Map<string, Day[]>();
  const cached = yearMaps.get(year);
  if (cached) return cached;
  const map = new Map<string, Day[]>();
  for (let t = Date.UTC(year, 0, 1); new Date(t).getUTCFullYear() === year; t += 86_400_000) {
    const date = new Date(t);
    const day = { y: year, m: date.getUTCMonth() + 1, d: date.getUTCDate() };
    const h = hijriOf(day);
    const key = `${h.month}-${h.day}`;
    map.set(key, [...(map.get(key) ?? []), day]);
  }
  yearMaps.set(year, map);
  return map;
}

/** أيّامُ المناسبة الميلاديّة في سنةٍ بعينها. */
export function datesOf(occasion: Pick<NationalDay, "calendar" | "month" | "day">, year: number): Day[] {
  if (occasion.calendar === "HIJRI") return hijriYear(year).get(`${occasion.month}-${occasion.day}`) ?? [];
  const probe = new Date(Date.UTC(year, occasion.month - 1, occasion.day));
  // ٢٩ فبراير في سنةٍ بسيطة لا يُقرَّب إلى غيره.
  return probe.getUTCMonth() === occasion.month - 1 ? [{ y: year, m: occasion.month, d: occasion.day }] : [];
}

/** مناسباتُ دولة صاحب الحساب والعامّة — من آخر مدينةٍ قرأها جهازُه. */
export async function nationalDaysFor(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { lastCity: true, lastCountry: true } });
  const country = countryOf(user?.lastCity, user?.lastCountry);
  const rows = await prisma.nationalDay.findMany({
    where: { hidden: false, country: { in: country ? [country, ALL_COUNTRIES] : [ALL_COUNTRIES] } },
  });
  return { country, rows };
}

/** مناسبةٌ وطنيّة اليوم؟ — لجرس الصباح. */
export async function nationalToday(userId: string, today = riyadhDay()) {
  const { rows } = await nationalDaysFor(userId);
  const key = dayKey(today);
  return rows.filter((row) => datesOf(row, today.y).some((day) => dayKey(day) === key));
}

// ───────────────────────────── الشهر ─────────────────────────────

type Person = { id: string; name: string; avatarMediaId: string | null };
type Entry = {
  date: string;
  national: { name: string; greeting: string | null }[];
  friends: { friend: Person; months: number }[];
  /** عددُ الذكريات في اليوم وأقدمُ فترةٍ فيها. */
  memories: { count: number; months: number } | null;
};

const daysIn = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

/**
 * شهرٌ كامل: يومٌ يُذكر لما فيه، وما لا شيء فيه لا يُرسل. والفتراتُ فتراتُ
 * الذكريات نفسها: شهرٌ وستّةٌ ثمّ كلُّ سنة، وما لا مثيل له يسقط.
 */
/**
 * المناسباتُ الوطنيّة في سنةٍ من يومٍ بعينه — اليومُ أو ما اختاره صاحبُ التقويم:
 * أقربُ مناسبةٍ قد تبعد أشهراً، فالشهرُ المعروضُ لا يكفي.
 */
function upcomingOf(rows: NationalDay[], from: Day) {
  const fromKey = dayKey(from);
  const horizon = dayKey(monthsBefore(from, -12) ?? { y: from.y + 1, m: from.m, d: 1 });
  return rows
    .flatMap((row) =>
      [from.y, from.y + 1].flatMap((y) => datesOf(row, y)).map((day) => ({ date: dayKey(day), name: row.name, greeting: row.greeting })),
    )
    .filter((entry) => entry.date >= fromKey && entry.date < horizon)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 8);
}

/** «المناسبات القادمة» من يومٍ يختاره صاحبُ التقويم (القاعدة ٢٩٢). */
export async function upcoming(userId: string, from: Day) {
  const { country, rows } = await nationalDaysFor(userId);
  return {
    country,
    countryName: country ? (COUNTRIES.find((row) => row.code === country)?.name ?? null) : null,
    upcoming: upcomingOf(rows, from),
  };
}

export async function month(userId: string, year: number, monthNo: number) {
  const days: Day[] = Array.from({ length: daysIn(year, monthNo) }, (_, index) => ({ y: year, m: monthNo, d: index + 1 }));
  const entries = new Map<string, Entry>(
    days.map((day) => [dayKey(day), { date: dayKey(day), national: [], friends: [], memories: null }]),
  );
  const periods = memoryPeriods();

  // ١. الوطنيّة: تواريخُها في هذه السنة، وما وقع منها في الشهر.
  const { country, rows } = await nationalDaysFor(userId);
  for (const row of rows) {
    for (const day of datesOf(row, year)) {
      if (day.m === monthNo) entries.get(dayKey(day))?.national.push({ name: row.name, greeting: row.greeting });
    }
  }

  // ٢. الصداقة: يومُ القبول بعد شهرٍ أو ستّةٍ أو سنوات.
  const people = await celebrated(userId);
  if (people.size) {
    const ids = [...people.keys()];
    const friendships = await prisma.friendship.findMany({
      where: {
        status: "ACCEPTED",
        follow: false,
        OR: [
          { requesterId: userId, addresseeId: { in: ids } },
          { addresseeId: userId, requesterId: { in: ids } },
        ],
      },
      select: { requesterId: true, addresseeId: true, acceptedAt: true, createdAt: true },
    });
    for (const friendship of friendships) {
      const friend = people.get(friendship.requesterId === userId ? friendship.addresseeId : friendship.requesterId);
      if (!friend) continue;
      const since = dayKey(riyadhDay(friendship.acceptedAt ?? friendship.createdAt));
      for (const day of days) {
        const months = periods.find((k) => {
          const back = monthsBefore(day, k);
          return back !== null && dayKey(back) === since;
        });
        if (months) entries.get(dayKey(day))?.friends.push({ friend, months });
      }
    }
  }

  // ٣. الذكريات: ما كتبه في الأيّام المقابلة — سؤالٌ واحدٌ بأيّامٍ كثيرة.
  const back = new Map<string, number>();
  for (const day of days) {
    for (const k of periods) {
      const then = monthsBefore(day, k);
      if (then) back.set(dayKey(then), k);
    }
  }
  const keys = [...back.keys()].sort();
  if (keys.length) {
    const moments = await prisma.moment.findMany({
      where: {
        authorId: userId,
        kind: { in: MEMORABLE },
        memoryOf: null,
        recapYear: null,
        createdAt: { gte: new Date(`${keys[0]}T00:00:00+03:00`), lt: new Date(`${keys.at(-1)}T23:59:59.999+03:00`) },
      },
      select: { createdAt: true },
    });
    for (const moment of moments) {
      const then = riyadhDay(moment.createdAt);
      const k = back.get(dayKey(then));
      if (!k) continue;
      // اليومُ المقابل: ما بعد الفترة من يوم اللحظة — يقع في الشهر بالبناء.
      const target = monthsBefore(then, -k);
      if (!target || target.m !== monthNo || target.y !== year) continue;
      const entry = entries.get(dayKey(target));
      if (!entry) continue;
      entry.memories = {
        count: (entry.memories?.count ?? 0) + 1,
        months: Math.max(entry.memories?.months ?? 0, k),
      };
    }
  }

  const today = riyadhDay();
  const todayKey = dayKey(today);
  const upcoming = upcomingOf(rows, today);

  return {
    month: `${year}-${String(monthNo).padStart(2, "0")}`,
    today: todayKey,
    country,
    countryName: country ? (COUNTRIES.find((row) => row.code === country)?.name ?? null) : null,
    upcoming,
    days: [...entries.values()].filter((entry) => entry.national.length || entry.friends.length || entry.memories),
  };
}
