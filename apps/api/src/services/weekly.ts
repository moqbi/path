import { prisma } from "@athar/db";
import { ar, counted } from "../lib/riyadh-day";
import { blockedWith, circleIds, visibleWhere } from "./visibility";

/**
 * «أسبوعك في دائرتك» يوم الجمعة (القاعدة ٢٤٥) — **بقرار المالك**.
 *
 * **يُشتقّ ولا يُخزَّن** كالذكريات (القاعدة ٢٥): لحظةٌ حُذفت لا تُعدّ، وصديقٌ
 * أُزيل لا يُذكر. **ولا يرى إلا ما يراه** (`visibleWhere` — القاعدة ٢٣): لحظةٌ
 * خاصّةٌ لم تُوجَّه إليه لا تدخل عدّاً ولا اسماً، والمحجوبُ خارجه، ولا أحدَ من
 * خارج دائرته (القاعدة ٢). والأيّامُ السبعةُ الماضية من لحظة السؤال.
 *
 * ويُعرض الجمعةَ والسبتَ — من فاته صباحُ الجمعة لا يفوته الأسبوع — والجرسُ
 * الجمعةَ وحدها في جرس الصباح (`morning.ts`).
 */
const WEEK = 7 * 86_400_000;
const PERSON = { id: true, name: true, avatarMediaId: true } as const;

/** يومُ الأسبوع بتوقيت الرياض: ٥ الجمعة، ٦ السبت. */
export function riyadhWeekday(now = new Date()): number {
  return new Date(now.getTime() + 3 * 3_600_000).getUTCDay();
}

export function weeklyOpen(now = new Date()): boolean {
  const day = riyadhWeekday(now);
  return day === 5 || day === 6;
}

type Person = { id: string; name: string; avatarMediaId: string | null };

export type Weekly = {
  from: string;
  circle: {
    moments: number;
    photos: number;
    places: number;
    songs: number;
    thoughts: number;
    stories: number;
    posters: number;
  };
  travelers: { person: Person; city: string }[];
  joined: Person[];
  newFriends: Person[];
  topMoment: { id: string; person: Person; kind: string; text: string | null; reactions: number; comments: number } | null;
  topPlace: { name: string; visits: number } | null;
  mine: { moments: number; reactions: number; comments: number; views: number };
};

export async function weeklyFor(userId: string, now = new Date()): Promise<Weekly | null> {
  const from = new Date(now.getTime() - WEEK);
  const [ids, blocked, where, self] = await Promise.all([
    circleIds(userId),
    blockedWith(userId),
    visibleWhere(userId),
    prisma.user.findUnique({ where: { id: userId }, select: { isOpen: true } }),
  ]);
  // الحسابُ المفتوح يقبل كلَّ من أضافه (القاعدة ٢٢١)، فـ«أصدقاؤه الجدد» و«من انضمّ من
  // دائرته» كلُّ من نزّل التطبيقَ هذا الأسبوع — غرباءُ لا دائرة. فالقسمان لا يُعرضان له.
  const open = Boolean(self?.isOpen);
  const hidden = new Set(blocked);
  const circle = ids.filter((id) => !hidden.has(id));

  const [theirs, stories, mine, friendships, joined] = await Promise.all([
    circle.length
      ? prisma.moment.findMany({
          where: { AND: [where, { authorId: { in: circle } }, { createdAt: { gte: from } }] },
          select: {
            id: true,
            authorId: true,
            kind: true,
            text: true,
            placeName: true,
            createdAt: true,
            _count: { select: { reactions: true, comments: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 3000,
        })
      : [],
    circle.length ? prisma.story.count({ where: { authorId: { in: circle }, createdAt: { gte: from } } }) : 0,
    prisma.moment.findMany({
      where: { authorId: userId, createdAt: { gte: from } },
      select: { _count: { select: { reactions: true, comments: true, views: true } } },
    }),
    prisma.friendship.findMany({
      where: {
        status: "ACCEPTED",
        OR: [{ requesterId: userId }, { addresseeId: userId }],
        // والقديمُ بلا `acceptedAt` يُقرأ بتاريخ طلبه (القاعدة ٢٣٥).
        AND: [{ OR: [{ acceptedAt: { gte: from } }, { acceptedAt: null, createdAt: { gte: from } }] }],
      },
      select: { requesterId: true, addresseeId: true },
    }),
    circle.length
      ? prisma.user.findMany({ where: { id: { in: circle }, createdAt: { gte: from } }, select: PERSON, take: 12 })
      : [],
  ]);

  const count = (kind: string) => theirs.filter((row) => row.kind === kind).length;

  // من سافر: آخرُ مدينةٍ وصل إليها كلُّ صديق في الأسبوع.
  const lastCity = new Map<string, string>();
  for (const row of theirs) {
    if (row.kind === "CITY" && row.text && !lastCity.has(row.authorId)) lastCity.set(row.authorId, row.text);
  }

  // أكثرُ مكانٍ زاره أصدقاؤه.
  const places = new Map<string, number>();
  for (const row of theirs) {
    if (row.kind === "PLACE" && row.placeName) places.set(row.placeName, (places.get(row.placeName) ?? 0) + 1);
  }
  const place = [...places.entries()].sort((a, b) => b[1] - a[1])[0];

  // أكثرُ لحظةٍ حرّكت الدائرة — ما له متن، لا أسطرُ النظام.
  const top = theirs
    .filter((row) => ["PHOTO", "PLACE", "THOUGHT", "MUSIC"].includes(row.kind))
    .map((row) => ({ row, score: row._count.reactions + row._count.comments * 2 }))
    .sort((a, b) => b.score - a.score)[0];

  const friendIds = friendships
    .map((row) => (row.requesterId === userId ? row.addresseeId : row.requesterId))
    .filter((id) => !hidden.has(id));
  const wanted = [...new Set([...lastCity.keys(), ...friendIds, ...(top && top.score > 0 ? [top.row.authorId] : [])])];
  const people = wanted.length
    ? await prisma.user.findMany({ where: { id: { in: wanted } }, select: PERSON })
    : [];
  const byId = new Map(people.map((person) => [person.id, person]));

  const posted = new Set(theirs.map((row) => row.authorId));
  const result: Weekly = {
    from: from.toISOString(),
    circle: {
      moments: theirs.length,
      photos: count("PHOTO"),
      places: count("PLACE"),
      songs: count("MUSIC"),
      thoughts: count("THOUGHT"),
      stories,
      posters: posted.size,
    },
    travelers: [...lastCity.entries()]
      .map(([id, city]) => ({ person: byId.get(id)!, city }))
      .filter((row) => row.person)
      .slice(0, 8),
    joined: open ? [] : joined,
    newFriends: open ? [] : friendIds.map((id) => byId.get(id)).filter((person): person is Person => Boolean(person)).slice(0, 8),
    topMoment:
      top && top.score > 0 && byId.get(top.row.authorId)
        ? {
            id: top.row.id,
            person: byId.get(top.row.authorId)!,
            kind: top.row.kind,
            text: top.row.text,
            reactions: top.row._count.reactions,
            comments: top.row._count.comments,
          }
        : null,
    topPlace: place ? { name: place[0], visits: place[1] } : null,
    mine: {
      moments: mine.length,
      reactions: mine.reduce((sum, row) => sum + row._count.reactions, 0),
      comments: mine.reduce((sum, row) => sum + row._count.comments, 0),
      views: mine.reduce((sum, row) => sum + row._count.views, 0),
    },
  };

  const quiet =
    result.circle.moments === 0 &&
    result.circle.stories === 0 &&
    result.mine.moments === 0 &&
    result.newFriends.length === 0 &&
    result.joined.length === 0;
  return quiet ? null : result;
}

/** سطرُ الجرس: «هالأسبوع في دائرتك: ١٢ لحظة، و٣ سافروا». */
export function weeklySentence(week: Weekly): string {
  const parts: string[] = [];
  if (week.circle.moments) parts.push(counted(week.circle.moments, "لحظة", "لحظتان", "لحظات", "لحظة"));
  if (week.travelers.length) parts.push(`${ar(week.travelers.length)} ${week.travelers.length === 1 ? "سافر" : "سافروا"}`);
  if (week.topPlace) parts.push(`أكثر مكان: ${week.topPlace.name}`);
  if (week.newFriends.length) parts.push(counted(week.newFriends.length, "صديق جديد", "صديقان جديدان", "أصدقاء جدد", "صديقاً جديداً"));
  if (!parts.length && week.mine.moments) parts.push(counted(week.mine.moments, "لحظة نشرتها", "لحظتان نشرتهما", "لحظات نشرتها", "لحظة نشرتها"));
  return parts.length ? `هالأسبوع في دائرتك: ${parts.join("، و")}` : "هالأسبوع في دائرتك";
}
