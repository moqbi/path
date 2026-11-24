import "server-only";
import { prisma } from "@/lib/db";
import { circleIds } from "@/lib/circle";
import { blockedWith, canReachMoment, visibleWhere } from "@/lib/visibility";

/**
 * «من كان هنا» — نسخةُ `services/place-visitors.ts` في الخادم حرفاً بحرف
 * (القاعدة ٢٣٠): أصدقاءُ صاحب اللحظة بأسمائهم ممّا يرى من لحظاتهم، وغيرُهم
 * عددٌ بلا أسماء لا يُقال تحت خمسة.
 */
export const VISIT_DAYS = 10;
/** الوضعُ المفتوح (القاعدة ٤٨٥) — كالخادم حرفاً بحرف. */
export const OPEN_HOURS = 24;
const OPEN_MAX = 60;

let flag: { open: boolean; at: number } | null = null;
/** مفتاحُ اللوحة («visitors.open» في `SiteText`)، نصف دقيقة في الذاكرة. */
export async function visitorsOpen(): Promise<boolean> {
  if (flag && Date.now() - flag.at < 30_000) return flag.open;
  const row = await prisma.siteText.findUnique({ where: { key: "visitors.open" } }).catch(() => null);
  flag = { open: row?.value === "1", at: Date.now() };
  return flag.open;
}
const MIN_CROWD = 5;
const SAME_SPOT_M = 500;

function metres(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

type Spot = { placeName: string | null; placeCity: string | null; lat: number | null; lng: number | null };

/**
 * الاسمُ مطويّاً (القاعدة ٤٨٦): المكانُ الواحد يُكتب بأكثر من صيغة — آبل وقوقل وOSM،
 * والهمزةُ والتاءُ المربوطة والتشكيلُ والفواصل — فيُطوى قبل أن يُقارَن.
 */
function fold(name: string | null): string {
  return (name ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

/** اسمان لمكانٍ واحد: متطابقان مطويَّين، أو أحدُهما داخل الآخر («ستاربكس» و«ستاربكس الملقا»). */
function sameName(a: string | null, b: string | null) {
  const x = fold(a);
  const y = fold(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.length >= 3 && long.includes(short);
}

/**
 * المكانُ واحدٌ بالاسم، ثمّ بالموضع حين يُعرف للطرفين — «ستاربكس» في حيّين
 * ليس مكاناً واحداً — وإلّا بالمدينة.
 */
function sameSpot(a: Spot, b: Spot) {
  if (!sameName(a.placeName, b.placeName)) return false;
  if (a.lat != null && a.lng != null && b.lat != null && b.lng != null) {
    return metres({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng }) <= SAME_SPOT_M;
  }
  return !a.placeCity || !b.placeCity || fold(a.placeCity) === fold(b.placeCity);
}

/**
 * المرشّحون من القاعدة: الاسمُ نفسُه **أو** ما حول الموضع بمربّعٍ يسعه (القاعدة ٤٨٦) —
 * المطابقةُ في SQL وحدها كانت تُسقط ما اختلفت كتابتُه، والطيُّ والمسافةُ بعدها في `sameSpot`.
 */
function around(moment: Spot & { placeName: string }) {
  const name = { placeName: { equals: moment.placeName, mode: "insensitive" as const } };
  if (moment.lat == null || moment.lng == null) return name;
  const dLat = SAME_SPOT_M / 111_000;
  const dLng = SAME_SPOT_M / (111_000 * Math.max(0.2, Math.cos((moment.lat * Math.PI) / 180)));
  return {
    OR: [
      name,
      {
        placeName: { not: null },
        lat: { gte: moment.lat - dLat, lte: moment.lat + dLat },
        lng: { gte: moment.lng - dLng, lte: moment.lng + dLng },
      },
    ],
  };
}

export type VisitorsView = {
  place: string;
  days: number;
  friends: {
    id: string;
    name: string;
    isPlus: boolean;
    avatarMediaId: string | null;
    frame: { spec: string; mediaId: string | null; frameHole: number | null } | null;
    charm: { spec: string; mediaId: string | null } | null;
    tag: { name: string; bg: string; fg: string } | null;
    visitedAt: string;
    friend?: boolean;
    requested?: boolean;
    asking?: boolean;
  }[];
  others: number | null;
  hours?: number;
  open?: boolean;
};

export async function placeVisitors(viewerId: string, momentId: string): Promise<VisitorsView | null> {
  const moment = await prisma.moment.findUnique({
    where: { id: momentId },
    select: { authorId: true, placeName: true, placeCity: true, lat: true, lng: true },
  });
  if (!moment || !moment.placeName) return null;
  // لمن يرى اللحظة وحده (القاعدة ٤٨٥)، ولغيره «غير موجودة».
  if (moment.authorId !== viewerId && !(await canReachMoment(viewerId, momentId))) return null;
  if (await visitorsOpen()) return openVisitors(viewerId, { ...moment, placeName: moment.placeName });

  const spot = { ...moment, placeName: moment.placeName };
  const since = new Date(Date.now() - VISIT_DAYS * 24 * 60 * 60 * 1000);
  const nearby = (
    await prisma.moment.findMany({
      where: {
        ...around(spot),
        createdAt: { gte: since },
        authorId: { not: viewerId },
      },
      select: { id: true, authorId: true, placeName: true, placeCity: true, lat: true, lng: true },
      take: 2000,
    })
  ).filter((row) => sameSpot(spot, row));

  if (nearby.length === 0) return { place: moment.placeName, days: VISIT_DAYS, friends: [], others: null };

  const [friends, blocked, visible] = await Promise.all([
    circleIds(viewerId),
    blockedWith(viewerId),
    visibleWhere(viewerId),
  ]);

  const seen = await prisma.moment.findMany({
    where: { AND: [visible, { id: { in: nearby.map((row) => row.id) } }, { authorId: { in: friends } }] },
    select: {
      createdAt: true,
      author: {
        select: {
          id: true,
          name: true,
          isPlus: true,
          avatarMediaId: true,
          frame: { select: { spec: true, mediaId: true, frameHole: true, fit: true } },
          charm: { select: { spec: true, mediaId: true, fit: true } },
          tag: { select: { name: true, bg: true, fg: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  const byPerson = new Map<string, (typeof seen)[number]>();
  for (const row of seen) if (!byPerson.has(row.author.id)) byPerson.set(row.author.id, row);

  const skip = new Set([...byPerson.keys(), ...blocked]);
  const strangers = new Set(nearby.map((row) => row.authorId).filter((id) => !skip.has(id))).size;

  return {
    place: moment.placeName,
    days: VISIT_DAYS,
    friends: [...byPerson.values()].map((row) => ({ ...row.author, visitedAt: row.createdAt.toISOString() })),
    others: strangers >= MIN_CROWD ? strangers : null,
  };
}

/** الوضعُ المفتوح — نسخةُ `openVisitors` في الخادم حرفاً بحرف (القاعدة ٤٨٥). */
async function openVisitors(viewerId: string, moment: Spot & { placeName: string }): Promise<VisitorsView> {
  const spot = moment;
  const since = new Date(Date.now() - OPEN_HOURS * 60 * 60 * 1000);
  const rows = (
    await prisma.moment.findMany({
      where: {
        ...around(spot),
        createdAt: { gte: since },
        authorId: { not: viewerId },
        author: { showInVisitors: true },
      },
      select: { authorId: true, createdAt: true, placeName: true, placeCity: true, lat: true, lng: true },
      orderBy: { createdAt: "desc" },
      take: 2000,
    })
  ).filter((row) => sameSpot(spot, row));

  const base = { place: moment.placeName, days: 1, hours: OPEN_HOURS, open: true, others: null };
  if (rows.length === 0) return { ...base, friends: [] };

  const [friends, blocked, pending] = await Promise.all([
    circleIds(viewerId),
    blockedWith(viewerId),
    prisma.friendship.findMany({
      where: { status: "PENDING", OR: [{ requesterId: viewerId }, { addresseeId: viewerId }] },
      select: { requesterId: true, addresseeId: true },
    }),
  ]);
  const circle = new Set(friends);
  const skip = new Set(blocked);
  const sent = new Set(pending.filter((row) => row.requesterId === viewerId).map((row) => row.addresseeId));
  const got = new Set(pending.filter((row) => row.addresseeId === viewerId).map((row) => row.requesterId));

  const latest = new Map<string, Date>();
  for (const row of rows) if (!skip.has(row.authorId) && !latest.has(row.authorId)) latest.set(row.authorId, row.createdAt);
  const people = await prisma.user.findMany({
    where: { id: { in: [...latest.keys()].slice(0, OPEN_MAX) } },
    select: {
      id: true,
      name: true,
      isPlus: true,
      avatarMediaId: true,
      frame: { select: { spec: true, mediaId: true, frameHole: true, fit: true } },
      charm: { select: { spec: true, mediaId: true, fit: true } },
      tag: { select: { name: true, bg: true, fg: true } },
    },
  });

  return {
    ...base,
    friends: people
      .map((person) => ({
        ...person,
        visitedAt: latest.get(person.id)!.toISOString(),
        friend: circle.has(person.id),
        requested: sent.has(person.id),
        asking: got.has(person.id),
      }))
      .sort((a, b) => Number(b.friend) - Number(a.friend) || b.visitedAt.localeCompare(a.visitedAt)),
  };
}
