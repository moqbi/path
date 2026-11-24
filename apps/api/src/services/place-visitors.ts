import { prisma } from "@athar/db";
import { notFound } from "../lib/errors";
import { blockedWith, canReachMoment, circleIds, visibleWhere } from "./visibility";

/**
 * «من كان هنا» — لكلّ من يرى لحظة المكان (القاعدة ٢٣٠، ووسّعتها ٤٨٥ من صاحبها إلى قارئها).
 *
 * **أصدقاؤه بأسمائهم، وغيرُهم عددٌ بلا أسماء.** الاسمُ يُقال لمن يرى لحظته
 * أصلاً (`visibleWhere` — القاعدة ٢٣)، فلا يتسرّب منه شيءٌ لم يُكتب له. ومن
 * خارج الدائرة لا يُقال إلّا كم هم، ولا يُقال ما لم يبلغوا خمسة: عددٌ صغيرٌ
 * يُستدلّ منه على شخصٍ بعينه — «زاره واحد» في مكانٍ يعرفه القارئ تسميةٌ لا
 * إحصاء. وهذا حدُّ القاعدة ٢: لا وجهَ من خارج الدائرة ولا اسم.
 */
export const VISIT_DAYS = 10;
/** الوضعُ المفتوح (القاعدة ٤٨٥): من زار المكان في يومٍ، صديقاً كان أو غريباً. */
export const OPEN_HOURS = 24;
const OPEN_MAX = 60;
const MIN_CROWD = 5;
/** نقطتان أقربُ من هذا مكانٌ واحد — حدودُ المبنى لا حدودُ الحيّ. */
const SAME_SPOT_M = 250;

/**
 * مفتاحُ اللوحة («visitors.open» في `SiteText` — القاعدة ٤٨٥): تُقرأ نصف دقيقة في
 * الذاكرة — اللوحةُ مشروعٌ آخر لا يمسح خبيئتنا، ونصفُ دقيقةٍ تأخيرٌ مقبولٌ لمفتاح.
 */
let flag: { open: boolean; at: number } | null = null;
export async function visitorsOpen(): Promise<boolean> {
  if (flag && Date.now() - flag.at < 30_000) return flag.open;
  const row = await prisma.siteText.findUnique({ where: { key: "visitors.open" } }).catch(() => null);
  flag = { open: row?.value === "1", at: Date.now() };
  return flag.open;
}

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
  // لمن يرى اللحظة وحده، ولغيره «غير موجودة» (القاعدة ٢٣ب).
  if (
    !moment ||
    !moment.placeName ||
    (moment.authorId !== viewerId && !(await canReachMoment(viewerId, momentId)))
  ) {
    throw notFound("اللحظة غير موجودة");
  }
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

const PERSON = {
  id: true,
  name: true,
  isPlus: true,
  avatarMediaId: true,
  frame: { select: { spec: true, mediaId: true, frameHole: true, fit: true } },
  charm: { select: { spec: true, mediaId: true, fit: true } },
  tag: { select: { name: true, bg: true, fg: true } },
} as const;

/**
 * الوضعُ المفتوح (القاعدة ٤٨٥) — **بقرار المالك**، تخفيفٌ للقاعدة ٢ خلف مفتاحٍ في اللوحة:
 * كلُّ من نشر لحظةً في المكان نفسه خلال يومٍ بوجهه واسمه، صديقاً أو غريباً، والغريبُ بزرّ
 * إضافة. **لا لحظةَ تُكشف** — الوجهُ والاسمُ وحدهما، وبطاقتُه بقاعدة ٢٠. ويُستثنى من أطفأ
 * «أظهرني في من زار الموقع»، والمحجوبُ في الاتجاهين، والقارئُ نفسه.
 * والشكلُ شكلُ الوضع القديم (`friends`) فيقرؤه الجوّالُ القائم أسماءً.
 */
async function openVisitors(viewerId: string, moment: Spot & { placeName: string }) {
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
  const ids = [...latest.keys()].slice(0, OPEN_MAX);
  const people = await prisma.user.findMany({ where: { id: { in: ids } }, select: PERSON });

  const list = people
    .map((person) => ({
      ...person,
      visitedAt: latest.get(person.id)!,
      friend: circle.has(person.id),
      requested: sent.has(person.id),
      asking: got.has(person.id),
    }))
    // الأصدقاءُ أوّلاً، ثمّ الأحدثُ زيارةً.
    .sort((a, b) => Number(b.friend) - Number(a.friend) || b.visitedAt.getTime() - a.visitedAt.getTime());
  return { ...base, friends: list };
}
