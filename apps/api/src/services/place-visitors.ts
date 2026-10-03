import { prisma } from "@athar/db";
import { notFound } from "../lib/errors";
import { blockedWith, circleIds, visibleWhere } from "./visibility";

/**
 * «من كان هنا» — لصاحب لحظة المكان وحده (القاعدة ٢٣٠).
 *
 * **أصدقاؤه بأسمائهم، وغيرُهم عددٌ بلا أسماء.** الاسمُ يُقال لمن يرى لحظته
 * أصلاً (`visibleWhere` — القاعدة ٢٣)، فلا يتسرّب منه شيءٌ لم يُكتب له. ومن
 * خارج الدائرة لا يُقال إلّا كم هم، ولا يُقال ما لم يبلغوا خمسة: عددٌ صغيرٌ
 * يُستدلّ منه على شخصٍ بعينه — «زاره واحد» في مكانٍ يعرفه القارئ تسميةٌ لا
 * إحصاء. وهذا حدُّ القاعدة ٢: لا وجهَ من خارج الدائرة ولا اسم.
 */
export const VISIT_DAYS = 10;
const MIN_CROWD = 5;
/** نقطتان أقربُ من هذا مكانٌ واحد — حدودُ المبنى لا حدودُ الحيّ. */
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

/**
 * المكانُ واحدٌ بالاسم، ثمّ بالموضع حين يُعرف للطرفين — «ستاربكس» في حيّين
 * ليس مكاناً واحداً — وإلّا بالمدينة.
 */
function sameSpot(a: Spot, b: Spot) {
  if (a.lat != null && a.lng != null && b.lat != null && b.lng != null) {
    return metres({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng }) <= SAME_SPOT_M;
  }
  return !a.placeCity || !b.placeCity || a.placeCity === b.placeCity;
}

export async function placeVisitors(viewerId: string, momentId: string) {
  const moment = await prisma.moment.findUnique({
    where: { id: momentId },
    select: { authorId: true, placeName: true, placeCity: true, lat: true, lng: true },
  });
  // لغير صاحبها «غير موجودة» كقائمة المشاهدين (القاعدة ٢٠٢).
  if (!moment || moment.authorId !== viewerId || !moment.placeName) {
    throw notFound("اللحظة غير موجودة");
  }

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

  // من الدائرة: ما يراه القارئ من لحظاتهم وحده، الأحدثُ لكلّ شخص.
  const seen = await prisma.moment.findMany({
    where: {
      AND: [
        visible,
        { id: { in: nearby.map((row) => row.id) } },
        { authorId: { in: friends } },
      ],
    },
    select: {
      id: true,
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
  const named = [...byPerson.values()].map((row) => ({
    ...row.author,
    momentId: row.id,
    visitedAt: row.createdAt,
  }));

  // والباقون عددٌ: لا من سُمّي، ولا محجوبٌ في أيّ اتجاه.
  const skip = new Set([...byPerson.keys(), ...blocked]);
  const strangers = new Set(nearby.map((row) => row.authorId).filter((id) => !skip.has(id))).size;

  return {
    place: moment.placeName,
    days: VISIT_DAYS,
    friends: named,
    others: strangers >= MIN_CROWD ? strangers : null,
  };
}
