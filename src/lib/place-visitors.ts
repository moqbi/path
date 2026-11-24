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
const SAME_SPOT_M = 250;

function metres(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

type Spot = { placeCity: string | null; lat: number | null; lng: number | null };

function sameSpot(a: Spot, b: Spot) {
  if (a.lat != null && a.lng != null && b.lat != null && b.lng != null) {
    return metres({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng }) <= SAME_SPOT_M;
  }
  return !a.placeCity || !b.placeCity || a.placeCity === b.placeCity;
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

  const since = new Date(Date.now() - VISIT_DAYS * 24 * 60 * 60 * 1000);
  const nearby = (
    await prisma.moment.findMany({
      where: {
        placeName: { equals: moment.placeName, mode: "insensitive" },
        createdAt: { gte: since },
        authorId: { not: viewerId },
      },
      select: { id: true, authorId: true, placeCity: true, lat: true, lng: true },
      take: 2000,
    })
  ).filter((row) => sameSpot(moment, row));

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
  const since = new Date(Date.now() - OPEN_HOURS * 60 * 60 * 1000);
  const rows = (
    await prisma.moment.findMany({
      where: {
        placeName: { equals: moment.placeName, mode: "insensitive" },
        createdAt: { gte: since },
        authorId: { not: viewerId },
        author: { showInVisitors: true },
      },
      select: { authorId: true, createdAt: true, placeCity: true, lat: true, lng: true },
      orderBy: { createdAt: "desc" },
      take: 2000,
    })
  ).filter((row) => sameSpot(moment, row));

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
