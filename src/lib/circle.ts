import "server-only";
import { prisma } from "@/lib/db";
import { blockedWith } from "@/lib/visibility";

/**
 * سقف الدائرة. لا يُشترى ولا يزيد بالاشتراك — هذا قرار منتج، لا رقم إعدادات.
 * كل ما يُباع في «آثار+» يدور حول الذاكرة والتعبير، لا حول توسيع الدائرة.
 */
export const CIRCLE_CAP = 150;

/** معرّفات من في دائرة المستخدم (المقبولون فقط)، بلا المستخدم نفسه. */
export async function circleIds(userId: string): Promise<string[]> {
  const rows = await prisma.friendship.findMany({
    where: {
      status: "ACCEPTED",
      OR: [{ requesterId: userId }, { addresseeId: userId }],
    },
    select: { requesterId: true, addresseeId: true },
  });

  return rows.map((row) =>
    row.requesterId === userId ? row.addresseeId : row.requesterId,
  );
}

export async function circleSize(userId: string): Promise<number> {
  return prisma.friendship.count({
    where: {
      status: "ACCEPTED",
      OR: [{ requesterId: userId }, { addresseeId: userId }],
    },
  });
}

export class CircleFullError extends Error {
  constructor() {
    super(`اكتملت قائمة الأصدقاء — السقف ${CIRCLE_CAP} ولا يمكن تجاوزه`);
    this.name = "CircleFullError";
  }
}

/**
 * يتحقق أن الطرفين تحت السقف قبل قبول صداقة.
 *
 * الفحص على الطرفين لا على الطالب فقط: قبول الطلب يضيف صفاً واحداً يزيد
 * عدد كليهما، فتجاوز أيٍّ منهما للسقف يجب أن يمنع القبول.
 */
export async function assertRoomForBoth(a: string, b: string): Promise<void> {
  // الحسابُ المفتوح لا سقفَ لجانبه (القاعدة ٢٢١)، والطرفُ الآخر على سقفه.
  const open = await prisma.user.findMany({
    where: { id: { in: [a, b] }, isOpen: true },
    select: { id: true },
  });
  const uncapped = new Set(open.map((row) => row.id));
  const [sizeA, sizeB] = await Promise.all([
    uncapped.has(a) ? 0 : circleSize(a),
    uncapped.has(b) ? 0 : circleSize(b),
  ]);
  if (sizeA >= CIRCLE_CAP || sizeB >= CIRCLE_CAP) throw new CircleFullError();
}

/**
 * هل تُفتح محادثةٌ بينهما؟ الدائرةُ شرطٌ إلّا مع الحساب المفتوح
 * (القاعدة ٢٢١) — حسابُ الدعم يُراسَل بلا إضافة — والحظرُ فوقه.
 */
export async function canChat(userId: string, otherId: string): Promise<boolean> {
  if (userId === otherId) return false;
  if ((await circleIds(userId)).includes(otherId)) return true;
  const [other, blocked] = await Promise.all([
    prisma.user.findUnique({ where: { id: otherId }, select: { isOpen: true } }),
    blockedWith(userId),
  ]);
  return Boolean(other?.isOpen) && !blocked.includes(otherId);
}

/** عدد الأصدقاء المشتركين بين اثنين. */
export async function mutualCount(a: string, b: string): Promise<number> {
  const [circleA, circleB] = await Promise.all([circleIds(a), circleIds(b)]);
  const set = new Set(circleB);
  return circleA.filter((id) => set.has(id)).length;
}

export type Suggestion = {
  id: string;
  memberNo: number;
  name: string;
  city: string | null;
  isPlus: boolean;
  avatarMediaId: string | null;
  frame: { spec: string; mediaId: string | null; frameHole: number | null } | null;
  charm: { spec: string; mediaId: string | null } | null;
  tag: { name: string; bg: string; fg: string } | null;
  mutual: number;
};

/**
 * المقترحون: أصدقاء أصدقائك مرتّبين بعدد ما بينكم من أصدقاء مشتركين.
 *
 * هذا هو باب الإضافة الوحيد. لا بحث بالاسم ولا بالبريد: من لا يعرفه أحد
 * من دائرتك لا يظهر لك أصلاً، وهكذا تبقى الدائرة دائرةً لا دليل هاتف.
 */
export async function suggestions(userId: string, limit = 12): Promise<Suggestion[]> {
  // الحسابُ المفتوح ليس جسراً (القاعدة ٢٢١): من أضافوه لا يُقترح بعضُهم لبعض.
  const [all, open] = await Promise.all([
    circleIds(userId),
    prisma.user.findMany({ where: { isOpen: true }, select: { id: true } }),
  ]);
  const openIds = new Set(open.map((row) => row.id));
  if (openIds.has(userId)) return [];
  const mine = all.filter((id) => !openIds.has(id));
  if (mine.length === 0) return [];

  const [links, existing] = await Promise.all([
    prisma.friendship.findMany({
      where: {
        status: "ACCEPTED",
        OR: [{ requesterId: { in: mine } }, { addresseeId: { in: mine } }],
      },
      select: { requesterId: true, addresseeId: true },
    }),
    // كل علاقة قائمة — مقبولة أو معلّقة، في أي اتجاه — تُخرج صاحبها.
    prisma.friendship.findMany({
      where: { OR: [{ requesterId: userId }, { addresseeId: userId }] },
      select: { requesterId: true, addresseeId: true },
    }),
  ]);

  const blocked = new Set<string>([userId]);
  for (const row of existing) {
    blocked.add(row.requesterId);
    blocked.add(row.addresseeId);
  }

  const friends = new Set(mine);
  const shared = new Map<string, Set<string>>();
  for (const row of links) {
    for (const [side, other] of [
      [row.requesterId, row.addresseeId],
      [row.addresseeId, row.requesterId],
    ] as const) {
      if (!friends.has(side) || blocked.has(other)) continue;
      const set = shared.get(other) ?? new Set<string>();
      set.add(side);
      shared.set(other, set);
    }
  }

  if (shared.size === 0) return [];

  const people = await prisma.user.findMany({
    where: { id: { in: [...shared.keys()] } },
    select: {
      id: true,
      memberNo: true,
      name: true,
      city: true,
      isPlus: true,
      avatarMediaId: true,
      frame: { select: { spec: true, mediaId: true, frameHole: true } },
      charm: { select: { spec: true, mediaId: true } },
      tag: { select: { name: true, bg: true, fg: true } },
    },
  });

  return people
    .map((person) => ({ ...person, mutual: shared.get(person.id)?.size ?? 0 }))
    .sort((a, b) => b.mutual - a.mutual || a.name.localeCompare(b.name, "ar"))
    .slice(0, limit);
}
