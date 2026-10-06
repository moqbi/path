import "server-only";
import { prisma } from "@/lib/db";
import { dayKey, riyadhDay } from "@/lib/riyadh-day";
import { circleLines, circleYear, echoOf, echoText, leadOf } from "@/lib/book-story";
import { circleIds } from "@/lib/circle";


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
  const free = (await since(userId)) !== null;
  // اليومُ والسنةُ بتوقيت الرياض (+٣ بلا توقيتٍ صيفيّ). وغيرُ المشترك يرى السنةَ التي في
  // آخر ستّة أشهرٍ منها لحظات — كحدّ الكتاب نفسه، فلا تظهر سنةٌ يُفتح كتابُها فارغاً.
  const now = new Date();
  const rows = await prisma.$queryRaw<{ year: number; n: bigint }[]>`
    SELECT EXTRACT(YEAR FROM "createdAt" + interval '3 hours')::int AS year, COUNT(*) AS n
    FROM "Moment"
    WHERE "authorId" = ${userId}
      AND "kind"::text IN ('PHOTO', 'PLACE', 'THOUGHT', 'MUSIC', 'SLEEP', 'WAKE', 'CITY')
      AND (NOT ${free} OR "createdAt" >= LEAST(
        date_trunc('year', "createdAt" + interval '3 hours') + interval '1 year' - interval '3 hours',
        ${now}::timestamp
      ) - make_interval(days => ${FREE_ARCHIVE_DAYS}))
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
  const free = (await since(userId)) !== null;
  const start = new Date(Date.UTC(year, 0, 1, -3));
  const end = new Date(Date.UTC(year + 1, 0, 1, -3));
  // غيرُ المشترك: آخرُ ستّة أشهرٍ **من السنة نفسها** لا من اليوم — كتابُ سنةٍ مضت يبقى
  // من يوليو إلى ديسمبر ولا يتقلّص كلّما مرّ الوقت. والسنةُ الجارية حتى اليوم.
  const tail = new Date(Math.min(end.getTime(), Date.now()) - FREE_ARCHIVE_DAYS * 86_400_000);
  const lower = free && tail > start ? tail : start;

  const [me, found, circleList, blocks] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, memberNo: true, avatarMediaId: true, gender: true },
    }),
    prisma.moment.findMany({
      where: { authorId: userId, kind: { in: [...KINDS] }, createdAt: { gte: lower, lt: end } },
      select: {
        ...select,
        audience: true,
        audienceGroup: { select: { name: true } },
        viewers: { select: { user: { select: { name: true } } } },
        tags: { select: { user: { select: { name: true } } } },
        reactions: {
          where: { userId: { not: userId } },
          select: { userId: true, kind: true, emoji: true, createdAt: true, user: { select: { name: true } } },
        },
        comments: {
          where: { userId: { not: userId } },
          select: { userId: true, body: true, user: { select: { name: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
      take: 1000,
    }),
    circleIds(userId),
    prisma.block.findMany({
      where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
      select: { blockerId: true, blockedId: true },
    }),
  ]);
  if (!me) throw new Error("الحساب غير موجود");
  const circle = new Set(circleList);
  const blocked = new Set(blocks.map((row) => (row.blockerId === userId ? row.blockedId : row.blockerId)));

  // اللحظةُ الخاصّة تقول لمن كانت، و«مع» كما كُتبت — نسخةُ الخادم حرفاً بحرف (القاعدة ٢٥٦).
  // والراوي (القاعدة ٢٥٩) — كالخادم حرفاً بحرف.
  const raw = new Map(
    found.map((moment) => [
      moment.id,
      {
        reactions: moment.reactions.map(({ user, ...reaction }) => ({ ...reaction, name: user.name })),
        comments: moment.comments.map(({ user, ...comment }) => ({ ...comment, name: user.name })),
      },
    ]),
  );
  const rows = found.map(({ audience, audienceGroup, viewers, tags, reactions: _r, comments: _c, ...moment }) => {
    const entry = raw.get(moment.id)!;
    const echo = echoOf(entry.reactions, entry.comments, circle, blocked);
    const withNames = tags.map((tag) => tag.user.name);
    return {
      ...moment,
      with: withNames,
      echo,
      story: leadOf({ ...moment, with: withNames }, me.gender),
      echoText: echo ? echoText(echo, me.gender) : null,
      private:
        audience === "CIRCLE"
          ? null
          : {
              audience,
              group: audienceGroup?.name ?? null,
              people: audience === "PICKED" ? viewers.map((viewer) => viewer.user.name) : [],
            },
    };
  });

  // صفحةٌ لكلّ يوم بتوقيت الرياض.
  const days: { day: string; moments: typeof rows }[] = [];
  for (const row of rows) {
    const key = dayKey(riyadhDay(row.createdAt));
    const last = days.at(-1);
    if (last && last.day === key) last.moments.push(row);
    else days.push({ day: key, moments: [row] });
  }

  const count = (kind: string) => rows.filter((row) => row.kind === kind).length;
  const tally = (values: (string | null)[]) => {
    const map = new Map<string, number>();
    for (const value of values) if (value) map.set(value, (map.get(value) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  };
  const places = tally(rows.filter((row) => row.kind === "PLACE").map((row) => row.placeName));
  const cities = tally(rows.map((row) => row.placeCity ?? (row.kind === "CITY" ? row.text : null)));
  const songs = tally(rows.filter((row) => row.kind === "MUSIC").map((row) => row.musicTitle));
  const circleStats = circleYear(
    rows.map((row) => ({
      id: row.id,
      day: dayKey(riyadhDay(row.createdAt)),
      line: headline(row),
      with: row.with,
      echo: row.echo,
    })),
    raw,
    circle,
    blocked,
  );

  return {
    year,
    name: me.name,
    memberNo: me.memberNo,
    avatarMediaId: me.avatarMediaId,
    partial: lower > start,
    stats: {
      moments: rows.length,
      photos: count("PHOTO"),
      places: count("PLACE"),
      songs: count("MUSIC"),
      thoughts: count("THOUGHT"),
      cities: cities.slice(0, 6).map(([name]) => name),
      topPlace: places[0] ? { name: places[0][0], visits: places[0][1] } : null,
      topSong: songs[0]?.[0] ?? null,
      circle: circleStats,
      circleLines: circleLines(circleStats, me.gender),
    },
    days,
    moments: rows,
  };
}

/** عنوانُ اللحظة في سطرٍ واحد — لـ«أكثرُ لحظةٍ حرّكت دائرتك». */
function headline(moment: {
  kind: string;
  text: string | null;
  placeName: string | null;
  placeCity: string | null;
  musicTitle: string | null;
}): string {
  const short = (value: string) => (value.length > 60 ? `${value.slice(0, 59)}…` : value);
  switch (moment.kind) {
    case "PLACE":
      return moment.placeName ?? "مكان";
    case "MUSIC":
      return moment.musicTitle ?? "أغنية";
    case "CITY":
      return `وصلت إلى ${moment.text ?? moment.placeCity ?? ""}`.trim();
    case "SLEEP":
      return "نمت";
    case "WAKE":
      return "صحيت";
    case "PHOTO":
      return moment.text ? short(moment.text) : "صورة";
    default:
      return moment.text ? short(moment.text) : "خاطرة";
  }
}
