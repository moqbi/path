import "server-only";
import { prisma } from "@/lib/db";


/**
 * «أرشيفي» و«سنتك في كتاب» (القاعدة ٢٤٤) — نسخةُ `apps/api/src/services/archive.ts`
 * حرفاً بحرف، وتغييرُ إحداهما تغييرٌ للأخرى. — لصاحبها وحده: لا معرّفَ حسابٍ في
 * أيّ مسار، فلا يُسأل عن أرشيف غيره أصلاً.
 *
 * **الأرشيفُ ما كتبه صاحبُه بيده** ومعه أسفارُه — لا أسطرُ النظام («انضم»،
 * «أصبح صديق فلان»، «غيّر صورته»، المنحُ والهدايا): تلك أخبارٌ عنه لا لحظاتُه.
 * و**آثار+ «أرشيفٌ بلا نهاية»** (وعدُ قائمة المزايا): غيرُ المشترك يرى آخر
 * ستّة أشهر، والأقدمُ باقٍ في القاعدة يعود بالاشتراك — لا يُحذف شيء.
 */
const KINDS = ["PHOTO", "PLACE", "THOUGHT", "MUSIC", "SLEEP", "WAKE", "CITY"] as const;
export const FREE_ARCHIVE_DAYS = 183;

const select = {
  id: true,
  kind: true,
  text: true,
  placeName: true,
  placeCity: true,
  musicTitle: true,
  musicArtist: true,
  musicThumb: true,
  mediaId: true,
  photoX: true,
  photoY: true,
  createdAt: true,
} as const;

async function since(userId: string): Promise<Date | null> {
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { isPlus: true } });
  if (!me) throw new Error("الحساب غير موجود");
  return me.isPlus ? null : new Date(Date.now() - FREE_ARCHIVE_DAYS * 86_400_000);
}

/** صفحةٌ من الأرشيف، الأحدثُ أوّلاً، بمؤشّرٍ كالخطّ الزمنيّ. */
export async function archive(userId: string, options: { cursor?: string; limit: number }) {
  const from = await since(userId);
  const rows = await prisma.moment.findMany({
    where: {
      authorId: userId,
      kind: { in: [...KINDS] },
      ...(from ? { createdAt: { gte: from } } : {}),
    },
    select,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: options.limit + 1,
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
  });
  const more = rows.length > options.limit;
  const items = more ? rows.slice(0, options.limit) : rows;

  // كم يخبّئ الحدُّ — ليُقال «و١٢ لحظة أقدم مع آثار+» لا أن تختفي بصمت.
  const hidden = from
    ? await prisma.moment.count({
        where: { authorId: userId, kind: { in: [...KINDS] }, createdAt: { lt: from } },
      })
    : 0;

  return {
    moments: items,
    nextCursor: more ? items.at(-1)?.id : undefined,
    limited: Boolean(from),
    hidden,
  };
}

/** السنواتُ التي فيها لحظات — شرائحُ «سنتك في كتاب». */
export async function years(userId: string) {
  const from = await since(userId);
  const rows = await prisma.$queryRaw<{ year: number; n: bigint }[]>`
    SELECT EXTRACT(YEAR FROM "createdAt" AT TIME ZONE 'Asia/Riyadh')::int AS year, COUNT(*) AS n
    FROM "Moment"
    WHERE "authorId" = ${userId}
      AND "kind"::text IN ('PHOTO', 'PLACE', 'THOUGHT', 'MUSIC', 'SLEEP', 'WAKE', 'CITY')
      AND (${from}::timestamp IS NULL OR "createdAt" >= ${from}::timestamp)
    GROUP BY 1 ORDER BY 1 DESC
  `;
  return { years: rows.map((row) => ({ year: row.year, moments: Number(row.n) })) };
}

/**
 * «سنتك في كتاب»: لحظاتُ السنة من أوّلها مرتّبةً كصفحات، ومعها ما يُكتب في
 * مقدّمته — كم لحظة، وكم صورة، والمدن، وأكثرُ مكانٍ عاد إليه، وأغانيه.
 * والسنةُ سنةُ الرياض (القاعدة ٢٣٥).
 */
export async function book(userId: string, year: number) {
  if (!Number.isInteger(year) || year < 2024 || year > 2100) throw new Error("سنة غير صالحة");
  const from = await since(userId);
  const start = new Date(Date.UTC(year, 0, 1, -3));
  const end = new Date(Date.UTC(year + 1, 0, 1, -3));
  const lower = from && from > start ? from : start;

  const [me, rows] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, memberNo: true, avatarMediaId: true },
    }),
    prisma.moment.findMany({
      where: { authorId: userId, kind: { in: [...KINDS] }, createdAt: { gte: lower, lt: end } },
      select,
      orderBy: { createdAt: "asc" },
      take: 1000,
    }),
  ]);
  if (!me) throw new Error("الحساب غير موجود");

  const count = (kind: string) => rows.filter((row) => row.kind === kind).length;
  const tally = (values: (string | null)[]) => {
    const map = new Map<string, number>();
    for (const value of values) if (value) map.set(value, (map.get(value) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  };
  const places = tally(rows.filter((row) => row.kind === "PLACE").map((row) => row.placeName));
  const cities = tally(rows.map((row) => row.placeCity ?? (row.kind === "CITY" ? row.text : null)));
  const songs = tally(rows.filter((row) => row.kind === "MUSIC").map((row) => row.musicTitle));

  return {
    year,
    name: me.name,
    memberNo: me.memberNo,
    avatarMediaId: me.avatarMediaId,
    partial: Boolean(from && from > start),
    stats: {
      moments: rows.length,
      photos: count("PHOTO"),
      places: count("PLACE"),
      songs: count("MUSIC"),
      thoughts: count("THOUGHT"),
      cities: cities.slice(0, 6).map(([name]) => name),
      topPlace: places[0] ? { name: places[0][0], visits: places[0][1] } : null,
      topSong: songs[0]?.[0] ?? null,
    },
    moments: rows,
  };
}
