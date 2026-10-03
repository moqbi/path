import "server-only";
import { prisma } from "@/lib/db";
import { circleIds } from "@/lib/circle";
import { blockedWith, visibleWhere } from "@/lib/visibility";

/**
 * «من كان هنا» — نسخةُ `services/place-visitors.ts` في الخادم حرفاً بحرف
 * (القاعدة ٢٣٠): أصدقاءُ صاحب اللحظة بأسمائهم ممّا يرى من لحظاتهم، وغيرُهم
 * عددٌ بلا أسماء لا يُقال تحت خمسة.
 */
export const VISIT_DAYS = 10;
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
  }[];
  others: number | null;
};

export async function placeVisitors(viewerId: string, momentId: string): Promise<VisitorsView | null> {
  const moment = await prisma.moment.findUnique({
    where: { id: momentId },
    select: { authorId: true, placeName: true, placeCity: true, lat: true, lng: true },
  });
  if (!moment || moment.authorId !== viewerId || !moment.placeName) return null;

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
          frame: { select: { spec: true, mediaId: true, frameHole: true } },
          charm: { select: { spec: true, mediaId: true } },
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
