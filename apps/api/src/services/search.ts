import { prisma, Prisma, type MomentKind } from "@athar/db";
import { momentsByIds, TOGETHER_KINDS } from "./feed";
import { circleIds, visibleAuthors, visibleWhere } from "./visibility";

/**
 * البحثُ الذكيّ في اللحظات (القاعدة ٣٣٥) — **بقرار المالك**: سطرٌ واحد يُفهم.
 *
 * «نورة جدة» صديقةٌ ومدينة، «ستاربكس» مكان، «مع خالد» أثرٌ مشترك. فالسطرُ يُفكّ
 * كلماتٍ: ما طابق اسمَ صديقٍ في دائرتك صار شرطَ «فيها فلان» (كاتبُها أو مُشارٌ إليه)،
 * وما بقي يُبحث به في النصّ والمكان والمدينة والأغنية — **كلُّ كلمةٍ شرط**.
 *
 * **ولا يرى إلا ما يراه** (القاعدة ٢٣): النصُّ يُطوى في SQL (أ/إ/آ، ة/ه، ى/ي) ويُقصر
 * على كتّابٍ يراهم، ثمّ تمرّ المعرّفاتُ بـ`visibleWhere` نفسها. والأسماءُ من دائرته
 * وحدها: لا يجد غريباً (القاعدة ٢). و«آثارنا» عددٌ لمشتركي آثار+ (القاعدة ١٥٩).
 */

const FILLER = new Set(["مع", "في", "عند", "من", "الى", "لحظه", "لحظات", "مكان", "مدينه", "اغنيه", "صوره"]);

function fold(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** النصُّ مطويّاً في SQL كما يُطوى السطرُ هنا. */
const FOLDED = Prisma.sql`translate(lower(
  coalesce(m.text, '') || ' ' || coalesce(m."placeName", '') || ' ' || coalesce(m."placeCity", '') || ' ' ||
  coalesce(m."musicTitle", '') || ' ' || coalesce(m."musicArtist", '')
), 'أإآةىـ', 'اااهي')`;

const like = (word: string) => `%${word.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

const PERSON = {
  id: true,
  name: true,
  avatarMediaId: true,
} as const;

export async function search(userId: string, raw: string, hide: MomentKind[] = []) {
  const q = fold(raw).slice(0, 80);
  if (q.length < 2) return suggestions(userId);

  const [circle, viewer] = await Promise.all([
    circleIds(userId),
    prisma.user.findUnique({ where: { id: userId }, select: { isPlus: true } }),
  ]);
  const people = circle.length
    ? await prisma.user.findMany({ where: { id: { in: circle } }, select: PERSON })
    : [];

  // الكلماتُ: ما طابق اسماً كاملاً أو أوّلَه صار صديقاً، وما بقي نصّ.
  let words = q.split(" ").filter((word) => !FILLER.has(word));
  const friends: typeof people = [];
  for (const person of people) {
    const full = fold(person.name);
    const first = full.split(" ")[0];
    if (full.length >= 2 && q.includes(full)) {
      friends.push(person);
      const drop = new Set(full.split(" "));
      words = words.filter((word) => !drop.has(word));
    } else if (first.length >= 2 && words.includes(first)) {
      friends.push(person);
      words = words.filter((word) => word !== first);
    }
    if (friends.length >= 3) break;
  }
  words = words.filter((word) => word.length >= 2).slice(0, 5);
  if (friends.length === 0 && words.length === 0) return { friends: [], places: [], cities: [], moments: [] };

  const authors = await visibleAuthors(userId);
  const textWhere = words.length
    ? Prisma.join(words.map((word) => Prisma.sql`${FOLDED} LIKE ${like(word)}`), " AND ")
    : Prisma.sql`TRUE`;
  // «فيها فلان»: كاتبُها، أو مُشارٌ إليه فيها.
  const friendIds = friends.map((person) => person.id);
  const friendWhere = friendIds.length
    ? Prisma.sql`(m."authorId" IN (${Prisma.join(friendIds)}) OR EXISTS (
        SELECT 1 FROM "MomentTag" t WHERE t."momentId" = m.id AND t."userId" IN (${Prisma.join(friendIds)})
      ))`
    : Prisma.sql`TRUE`;
  const candidates = await prisma.$queryRaw<{ id: string }[]>`
    SELECT m.id FROM "Moment" m
    WHERE m."authorId" IN (${Prisma.join(authors)}) AND ${textWhere} AND ${friendWhere}
    ORDER BY m."createdAt" DESC
    LIMIT 400
  `;

  const visible = await visibleWhere(userId);
  const rows = candidates.length
    ? await prisma.moment.findMany({
        where: {
          AND: [visible, { id: { in: candidates.map((row) => row.id) } }, hide.length ? { kind: { notIn: hide } } : {}],
        },
        select: { id: true, placeName: true, placeCity: true },
        orderBy: { createdAt: "desc" },
      })
    : [];

  // الأماكنُ والمدنُ ممّا يُرى وحده، بعددِ لحظاتها — ولا تُعدّ إلا إن طابقت الكلمات.
  const matches = (text: string | null) => Boolean(text) && words.length > 0 && words.every((word) => fold(text!).includes(word));
  const places = new Map<string, { name: string; city: string | null; count: number }>();
  const cities = new Map<string, { name: string; count: number }>();
  for (const row of rows) {
    if (row.placeName && matches(row.placeName)) {
      const key = fold(row.placeName);
      const seen = places.get(key) ?? { name: row.placeName, city: row.placeCity, count: 0 };
      seen.count += 1;
      places.set(key, seen);
    }
    if (row.placeCity && matches(row.placeCity)) {
      const key = fold(row.placeCity);
      const seen = cities.get(key) ?? { name: row.placeCity, count: 0 };
      seen.count += 1;
      cities.set(key, seen);
    }
  }

  // «آثارنا» مع كل صديقٍ طابق: عددٌ لمشتركي آثار+، وقفلٌ لغيرهم.
  const together = await Promise.all(
    friends.map(async (person) => {
      if (!viewer?.isPlus) return null;
      return prisma.moment.count({
        where: {
          AND: [
            visible,
            { kind: { in: TOGETHER_KINDS } },
            {
              OR: [
                { authorId: userId, tags: { some: { userId: person.id } } },
                { authorId: person.id, tags: { some: { userId } } },
              ],
            },
          ],
        },
      });
    }),
  );

  const moments = await momentsByIds(
    userId,
    rows.slice(0, 40).map((row) => row.id),
  );

  return {
    friends: friends.map((person, index) => ({ ...person, together: together[index] })),
    places: [...places.values()].sort((a, b) => b.count - a.count).slice(0, 6),
    cities: [...cities.values()].sort((a, b) => b.count - a.count).slice(0, 6),
    moments,
  };
}

/** قبل أن يُكتب شيء: أكثرُ أماكنه ومدنه — بابٌ يُضغط لا صفحةٌ فارغة. */
async function suggestions(userId: string) {
  const [places, cities] = await Promise.all([
    prisma.moment.groupBy({
      by: ["placeName"],
      where: { authorId: userId, placeName: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { placeName: "desc" } },
      take: 6,
    }),
    prisma.moment.groupBy({
      by: ["placeCity"],
      where: { authorId: userId, placeCity: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { placeCity: "desc" } },
      take: 6,
    }),
  ]);
  return {
    friends: [],
    places: places.map((row) => ({ name: row.placeName!, city: null, count: row._count._all })),
    cities: cities.map((row) => ({ name: row.placeCity!, count: row._count._all })),
    moments: [],
    suggest: true,
  };
}
