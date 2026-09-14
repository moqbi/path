import { prisma } from "@athar/db";
import { CIRCLE_CAP } from "@athar/shared";
import { notFound } from "../lib/errors";
import { blockedWith, circleIds } from "./visibility";

/** ما يُعرض عن شخصٍ في قائمة أو بطاقة. */
const PERSON = {
  id: true,
  memberNo: true,
  name: true,
  handle: true,
  city: true,
  isPlus: true,
  lastSeenAt: true,
  avatarMediaId: true,
  frame: { select: { spec: true, mediaId: true } },
  charm: { select: { spec: true, mediaId: true } },
  tag: { select: { name: true, bg: true, fg: true } },
} as const;

/** الدائرة: أصدقاؤك، والطلبات الواردة، وما بقي من السقف. */
export async function circle(userId: string) {
  const ids = await circleIds(userId);

  const [members, requests, groups] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: ids } }, select: PERSON, orderBy: { name: "asc" } }),
    prisma.friendship.findMany({
      where: { addresseeId: userId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      select: { id: true, createdAt: true, requester: { select: PERSON } },
    }),
    prisma.friendGroup.findMany({
      where: { ownerId: userId },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, _count: { select: { members: true } } },
    }),
  ]);

  return {
    members,
    requests,
    groups: groups.map((g) => ({ id: g.id, name: g.name, count: g._count.members })),
    cap: CIRCLE_CAP,
    left: Math.max(0, CIRCLE_CAP - ids.length),
  };
}

/**
 * المقترحون: من يجمعك بهم صديقٌ مشترك — لا بحث بالاسم ولا بالبريد.
 *
 * وهذا قرار منتَج لا تبسيط: لا اكتشاف عام في أثر، فمن لا يعرفك لا يجدك.
 */
export async function suggestions(userId: string) {
  const [ids, blocked] = await Promise.all([circleIds(userId), blockedWith(userId)]);
  if (ids.length === 0) return [];

  const theirs = await prisma.friendship.findMany({
    where: {
      status: "ACCEPTED",
      OR: [{ requesterId: { in: ids } }, { addresseeId: { in: ids } }],
    },
    select: { requesterId: true, addresseeId: true },
  });

  const mine = new Set([...ids, userId, ...blocked]);
  const counts = new Map<string, number>();
  for (const row of theirs) {
    for (const id of [row.requesterId, row.addresseeId]) {
      if (mine.has(id)) continue;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }

  // الطلبات المعلّقة في الاتجاهين لا تُقترح ثانيةً.
  const pending = await prisma.friendship.findMany({
    where: {
      status: "PENDING",
      OR: [{ requesterId: userId }, { addresseeId: userId }],
    },
    select: { requesterId: true, addresseeId: true },
  });
  for (const row of pending) {
    counts.delete(row.requesterId);
    counts.delete(row.addresseeId);
  }

  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
  if (top.length === 0) return [];

  const people = await prisma.user.findMany({
    where: { id: { in: top.map(([id]) => id) } },
    select: PERSON,
  });

  const mutual = new Map(top);
  return people
    .map((person) => ({ ...person, mutual: mutual.get(person.id) ?? 0 }))
    .sort((a, b) => b.mutual - a.mutual);
}

/**
 * ملفّ شخص.
 *
 * خارج الدائرة لا يُعرض إلا من يجمعك به صديقٌ مشترك أو طلبٌ معلّق —
 * والغريب تماماً «غير موجود»، فلا يُتصفَّح الناس في أثر.
 */
export async function userProfile(viewerId: string, id: string) {
  const person = await prisma.user.findUnique({
    where: { id },
    select: {
      ...PERSON,
      bio: true,
      createdAt: true,
      coverMediaId: true,
      coverY: true,
      background: { select: { spec: true, mediaId: true, palette: true } },
    },
  });
  if (!person) throw notFound("لا يوجد هذا الحساب");

  const [ids, blocked] = await Promise.all([circleIds(viewerId), blockedWith(viewerId)]);
  if (blocked.includes(id)) throw notFound("لا يوجد هذا الحساب");

  const friend = ids.includes(id) || id === viewerId;
  if (friend) {
    return { person, friend: true as const, mutual: 0, pending: null };
  }

  const [theirs, pending] = await Promise.all([
    circleIds(id),
    prisma.friendship.findFirst({
      where: {
        status: "PENDING",
        OR: [
          { requesterId: viewerId, addresseeId: id },
          { requesterId: id, addresseeId: viewerId },
        ],
      },
      select: { id: true, requesterId: true },
    }),
  ]);

  const set = new Set(theirs);
  const mutual = ids.filter((one) => set.has(one)).length;
  if (mutual === 0 && !pending) throw notFound("لا يوجد هذا الحساب");

  return { person, friend: false as const, mutual, pending };
}
