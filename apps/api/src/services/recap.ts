import { prisma, Prisma, type MomentKind } from "@athar/db";
import { badRequest, notFound } from "../lib/errors";
import { ar, counted, dayRange, riyadhDay } from "../lib/riyadh-day";
import { blockedWith, circleIds } from "./visibility";
import { momentsByIds } from "./feed";
import { attachViewers, readAudience } from "./moments";

/**
 * «آثرك السنويّ» — **بقرار المالك** (القاعدة ٢٣٥).
 *
 * ملخّصُ سنةٍ يُفتح من ٢٥ ديسمبر حتى آخر يناير بتوقيت الرياض، ويُقرع جرسُه
 * مرّةً في صباح ٢٥ ديسمبر. يُحسب عند الطلب ولا يُخزَّن: لحظةٌ حُذفت تخرج منه،
 * والأرقامُ لا تتجمّد على ما كانت ساعةَ حُسبت.
 *
 * وما فيه من أسماء الناس دائرةُ صاحبه وحدها — صديقٌ أُزيل أو حُجب لا يُذكر
 * «أكثرَ من تفاعل معك» — ولا يُرى الملخّصُ إلا لصاحبه حتى يشاركه.
 */

/** أيّ سنةٍ يُفتح ملخّصُها الآن — أو لا شيء خارج نافذته. */
export function openYear(now = new Date()): number | null {
  const day = riyadhDay(now);
  if (day.m === 12 && day.d >= 25) return day.y;
  if (day.m === 1) return day.y - 1;
  return null;
}

/** سنةٌ تُقرأ: ما انقضى كلُّه، والجاريةُ في نافذتها وحدها. */
function readable(year: number, now = new Date()) {
  const current = riyadhDay(now).y;
  return year < current || year === openYear(now);
}

/** ما يُعدّ «لحظة» في الملخّص: ما كتبه صاحبُه بيده. */
const AUTHORED: MomentKind[] = ["PHOTO", "PLACE", "THOUGHT", "MUSIC"];

type Person = { id: string; name: string; avatarMediaId: string | null };

export type Recap = {
  year: number;
  moments: number;
  byKind: { photos: number; places: number; thoughts: number; songs: number };
  activeDays: number;
  cities: string[];
  topPlace: { name: string; count: number } | null;
  topSong: { title: string; artist: string | null; thumb: string | null; url: string | null; count: number } | null;
  /** من تفاعلتَ معه أكثر. */
  youLoved: (Person & { count: number }) | null;
  /** من تفاعل معك أكثر. */
  lovedYou: (Person & { count: number }) | null;
  reactionsGot: number;
  commentsGot: number;
  newFriends: number;
  topMoment: Awaited<ReturnType<typeof momentsByIds>>[number] | null;
};

export async function recapFor(userId: string, year: number): Promise<Recap | null> {
  if (!readable(year)) throw notFound("ملخّص هذه السنة لم يُفتح بعد");

  const range = {
    gte: dayRange({ y: year, m: 1, d: 1 }).gte,
    lt: dayRange({ y: year + 1, m: 1, d: 1 }).gte,
  };
  const mine = { authorId: userId, createdAt: range, memoryOf: null, recapYear: null };

  const kinds = await prisma.moment.groupBy({
    by: ["kind"],
    where: { ...mine, kind: { in: AUTHORED } },
    _count: { _all: true },
  });
  const count = (kind: MomentKind) => kinds.find((row) => row.kind === kind)?._count._all ?? 0;
  const total = kinds.reduce((sum, row) => sum + row._count._all, 0);
  if (total === 0) return null;

  // أصدقاءُ اليوم بلا محجوب — الأسماءُ في الملخّص منهم وحدهم.
  const [ids, blocked] = await Promise.all([circleIds(userId), blockedWith(userId)]);
  const hidden = new Set(blocked);
  const friends = ids.filter((id) => !hidden.has(id));

  const [days, cities, places, songs, gave, got, reactionsGot, commentsGot, newFriends, top] = await Promise.all([
    prisma.$queryRaw<{ n: bigint }[]>`
      SELECT count(DISTINCT to_char("createdAt" + interval '3 hours', 'YYYY-MM-DD'))::bigint AS n
        FROM "Moment" WHERE "authorId" = ${userId} AND "createdAt" >= ${range.gte} AND "createdAt" < ${range.lt}
         AND "memoryOf" IS NULL AND "recapYear" IS NULL
         AND kind IN (${Prisma.join(AUTHORED.map((kind) => Prisma.sql`${kind}::"MomentKind"`))})`,
    // «وصل إلى جدة» يحفظ المدينة في `text` (`city.ts`) لا في `placeCity`.
    prisma.moment.findMany({
      where: { ...mine, kind: "CITY", text: { not: null } },
      select: { text: true },
      distinct: ["text"],
      orderBy: { createdAt: "asc" },
    }),
    prisma.moment.groupBy({
      by: ["placeName"],
      where: { ...mine, kind: { in: ["PLACE", "PHOTO"] }, placeName: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { placeName: "desc" } },
      take: 1,
    }),
    prisma.moment.groupBy({
      by: ["musicTitle", "musicArtist"],
      where: { ...mine, kind: "MUSIC", musicTitle: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { musicTitle: "desc" } },
      take: 1,
    }),
    // من تفاعلتُ معه: تفاعلاتي وتعليقاتي على لحظات أصدقائي في السنة.
    prisma.$queryRaw<{ id: string; n: bigint }[]>`
      SELECT m."authorId" AS id, count(*)::bigint AS n FROM (
        SELECT "momentId", "createdAt" FROM "Reaction" WHERE "userId" = ${userId}
        UNION ALL SELECT "momentId", "createdAt" FROM "Comment" WHERE "userId" = ${userId}
      ) x JOIN "Moment" m ON m.id = x."momentId"
      WHERE x."createdAt" >= ${range.gte} AND x."createdAt" < ${range.lt} AND m."authorId" <> ${userId}
      GROUP BY m."authorId" ORDER BY n DESC LIMIT 20`,
    // ومن تفاعل معي.
    prisma.$queryRaw<{ id: string; n: bigint }[]>`
      SELECT x."userId" AS id, count(*)::bigint AS n FROM (
        SELECT "momentId", "userId", "createdAt" FROM "Reaction"
        UNION ALL SELECT "momentId", "userId", "createdAt" FROM "Comment"
      ) x JOIN "Moment" m ON m.id = x."momentId"
      WHERE m."authorId" = ${userId} AND x."userId" <> ${userId}
        AND x."createdAt" >= ${range.gte} AND x."createdAt" < ${range.lt}
      GROUP BY x."userId" ORDER BY n DESC LIMIT 20`,
    prisma.reaction.count({ where: { createdAt: range, moment: { authorId: userId }, userId: { not: userId } } }),
    prisma.comment.count({ where: { createdAt: range, moment: { authorId: userId }, userId: { not: userId } } }),
    prisma.friendship.count({
      where: {
        status: "ACCEPTED",
        OR: [{ requesterId: userId }, { addresseeId: userId }],
        AND: [{ OR: [{ acceptedAt: range }, { acceptedAt: null, createdAt: range }] }],
      },
    }),
    // أكثرُ لحظاتي تفاعلاً.
    prisma.moment.findFirst({
      where: { ...mine, kind: { in: AUTHORED }, reactions: { some: {} } },
      orderBy: [{ reactions: { _count: "desc" } }, { createdAt: "desc" }],
      select: { id: true },
    }),
  ]);

  const allowed = new Set(friends);
  const pick = async (rows: { id: string; n: bigint }[]) => {
    const row = rows.find((one) => allowed.has(one.id));
    if (!row) return null;
    const person = await prisma.user.findUnique({
      where: { id: row.id },
      select: { id: true, name: true, avatarMediaId: true },
    });
    return person ? { ...person, count: Number(row.n) } : null;
  };

  const song = songs[0];
  const songRow = song
    ? await prisma.moment.findFirst({
        where: { ...mine, kind: "MUSIC", musicTitle: song.musicTitle, musicArtist: song.musicArtist },
        select: { musicThumb: true, musicUrl: true },
        orderBy: { createdAt: "desc" },
      })
    : null;

  const [youLoved, lovedYou, topMoment] = await Promise.all([
    pick(gave),
    pick(got),
    top ? momentsByIds(userId, [top.id]).then((rows) => rows[0] ?? null) : Promise.resolve(null),
  ]);

  return {
    year,
    moments: total,
    byKind: { photos: count("PHOTO"), places: count("PLACE"), thoughts: count("THOUGHT"), songs: count("MUSIC") },
    activeDays: Number(days[0]?.n ?? 0),
    cities: cities.map((row) => row.text!).filter(Boolean),
    topPlace: places[0]?.placeName ? { name: places[0].placeName, count: places[0]._count._all } : null,
    topSong: song?.musicTitle
      ? {
          title: song.musicTitle,
          artist: song.musicArtist,
          thumb: songRow?.musicThumb ?? null,
          url: songRow?.musicUrl ?? null,
          count: song._count._all,
        }
      : null,
    youLoved,
    lovedYou,
    reactionsGot,
    commentsGot,
    newFriends,
    topMoment,
  };
}

/** ما يُعرض في «أنا» و«اللحظات»: أفي النافذة ملخّصٌ لهذا الحساب؟ */
export async function recapStatus(userId: string) {
  const year = openYear();
  if (!year) return { year: null };
  const range = {
    gte: dayRange({ y: year, m: 1, d: 1 }).gte,
    lt: dayRange({ y: year + 1, m: 1, d: 1 }).gte,
  };
  const has = await prisma.moment.findFirst({
    where: { authorId: userId, createdAt: range, kind: { in: AUTHORED }, memoryOf: null, recapYear: null },
    select: { id: true },
  });
  return { year: has ? year : null };
}

/** سطورُ الملخّص نصّاً — لما يُشارك ولجوّالٍ قديمٍ يقرؤه «خاطرة». */
export function recapText(recap: Recap) {
  const lines = [
    `آثري في ${ar(recap.year)}`,
    `${counted(recap.moments, "لحظة واحدة", "لحظتين", "لحظات", "لحظة")} في ${counted(recap.activeDays, "يوم واحد", "يومين", "أيام", "يوماً")}`,
  ];
  if (recap.cities.length) {
    lines.push(`${counted(recap.cities.length, "مدينة واحدة", "مدينتين", "مدن", "مدينة")}: ${recap.cities.slice(0, 4).join("، ")}`);
  }
  if (recap.topPlace) lines.push(`أكثر مكان: ${recap.topPlace.name}`);
  if (recap.topSong) lines.push(`أكثر أغنية: ${recap.topSong.title}`);
  if (recap.newFriends) {
    lines.push(counted(recap.newFriends, "صديق جديد", "صديقين جديدين", "أصدقاء جدد", "صديقاً جديداً"));
  }
  return lines.join("\n");
}

/**
 * «شارك آثرك»: خاطرةٌ بأرقامه — `recapYear` يرسمها الجوّالُ بطاقةَ ملخّص، والقديمُ
 * يقرؤها نصّاً. ولا أسماءَ فيها: من تفاعل معك أكثر خبرٌ عنه هو، لا يُنشر بلا إذنه.
 */
export async function shareRecap(
  userId: string,
  year: number,
  input: { audience: "CIRCLE" | "GROUP" | "PICKED"; audienceGroupId?: string; viewers?: string[] },
) {
  const recap = await recapFor(userId, year);
  if (!recap) throw badRequest("لا لحظات في هذه السنة");

  const seen = await readAudience(userId, { kind: "THOUGHT", ...input } as never);
  const created = await prisma.moment.create({
    data: {
      authorId: userId,
      kind: "THOUGHT",
      text: recapText(recap),
      recapYear: year,
      audience: seen.audience,
      audienceGroupId: seen.audienceGroupId,
    },
    select: { id: true },
  });
  await attachViewers(created.id, seen.viewers);
  return { id: created.id };
}
