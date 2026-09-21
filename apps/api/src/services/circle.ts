import { prisma } from "@athar/db";
import { CIRCLE_CAP } from "@athar/shared";
import { badRequest, forbidden, notFound } from "../lib/errors";
import { blockedWith, circleIds } from "./visibility";
import { isModerator } from "../middleware/auth";

/** ما يُعرض عن شخصٍ في قائمة أو بطاقة. */
const PERSON = {
  id: true,
  memberNo: true,
  /// حسابٌ مفتوح: تُقرأ بطاقتُه ولحظاتُه العامّة بلا صداقة (القاعدة ٣٢ب).
  isOpen: true,
  name: true,
  handle: true,
  city: true,
  isPlus: true,
  lastSeenAt: true,
  avatarMediaId: true,
  // الصنف الملبوس يُقرأ كاملاً: من ضغط صورةً وأعجبه إطارُها يرى اسمه
  // وسعره من مكانه، فلا يبحث عنه في المتجر.
  frame: { select: { id: true, name: true, kind: true, spec: true, mediaId: true, frameHole: true, priceCoins: true, plusOnly: true } },
  charm: { select: { id: true, name: true, kind: true, spec: true, mediaId: true, priceCoins: true, plusOnly: true } },
  tag: { select: { name: true, bg: true, fg: true } },
} as const;

/** الدائرة: أصدقاؤك، والطلبات الواردة، وما بقي من السقف. */
export async function circle(userId: string) {
  const ids = await circleIds(userId);

  const [members, requests, groups, placed] = await Promise.all([
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
    /*
      تصنيفُ كل صديق مع الدائرة نفسها.

      الشاشة تعرض لكل صفٍّ تصنيفه الحالي، فسؤالٌ لكلّ صديقٍ على حدة
      يعني مئةً وخمسين طلباً لشاشةٍ واحدة.
    */
    prisma.groupMember.findMany({
      where: { group: { ownerId: userId } },
      select: { userId: true, groupId: true },
    }),
  ]);

  const groupOf = new Map(placed.map((row) => [row.userId, row.groupId]));

  return {
    members: members.map((member) => ({ ...member, groupId: groupOf.get(member.id) ?? null })),
    requests,
    groups: groups.map((g) => ({ id: g.id, name: g.name, count: g._count.members })),
    cap: CIRCLE_CAP,
    left: Math.max(0, CIRCLE_CAP - ids.length),
  };
}

/**
 * المقترحون: من يجمعك بهم صديقٌ مشترك — لا بحث بالاسم ولا بالبريد.
 *
 * وهذا قرار منتَج لا تبسيط: لا اكتشاف عام في آثار، فمن لا يعرفك لا يجدك.
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
 * والغريب تماماً «غير موجود»، فلا يُتصفَّح الناس في آثار.
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
    /*
      ما يملكه من أصناف — لشاشة الإهداء وحدها.

      «لا يُهدى ما يملكه أصلاً»، فلا بدّ أن تعرف الشاشة ما عنده قبل أن
      تعرضه. ومعرّفات الأصناف لا أكثر: لا سعرَ ولا تاريخَ شراء.
    */
    const owns = await prisma.purchase.findMany({
      where: { userId: id },
      select: { itemId: true },
    });
    return {
      person,
      friend: true as const,
      mutual: 0,
      pending: null,
      owned: owns.map((row) => row.itemId),
    };
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

  /*
    والمشرف يفتح أيّ بطاقة.

    البلاغ يصل من داخل الدائرة على من هو خارج دائرة المشرف، فلو بقي
    الشرط على حاله لردّت اللوحةُ «لا يوجد هذا الحساب» عمّن يُبلَّغ عنه.
    وهذا **بطاقةٌ لا لحظات**: اللحظات لها بابُها في `/v1/moderation`،
    وهي تُقرأ من خلف `requireModerator` لا من هنا.
  */
  // والحساب المفتوح تُقرأ بطاقتُه بلا صديقٍ مشترك — كلحظاته العامّة.
  if (mutual === 0 && !pending && !person.isOpen) {
    if (!(await isModerator(viewerId))) throw notFound("لا يوجد هذا الحساب");
    return { person, friend: false as const, mutual, pending, owned: [] as string[] };
  }

  return { person, friend: false as const, mutual, pending, owned: [] as string[] };
}

// ───────────────────────────── الكتابة ─────────────────────────────

/** عدد من في دائرة شخص. */
async function circleSize(userId: string): Promise<number> {
  return (await circleIds(userId)).length;
}

/**
 * السقف يُفحص للطرفين لا للطالب وحده.
 *
 * فحصُ جانبٍ واحد يجعل الدائرة تتجاوز مئةً وخمسين من الجهة الأخرى: من
 * امتلأت دائرته لا يُقبل فيها أحد ولو كان هو المدعوّ.
 */
async function assertRoomForBoth(a: string, b: string) {
  const [sizeA, sizeB] = await Promise.all([circleSize(a), circleSize(b)]);
  if (sizeA >= CIRCLE_CAP || sizeB >= CIRCLE_CAP) {
    throw badRequest(`الدائرة مكتملة — ${CIRCLE_CAP} صديقاً هو السقف`);
  }
}

/** عدد الأصدقاء المشتركين بين اثنين. */
async function mutualCount(a: string, b: string): Promise<number> {
  const [circleA, circleB] = await Promise.all([circleIds(a), circleIds(b)]);
  const set = new Set(circleB);
  return circleA.filter((id) => set.has(id)).length;
}

/**
 * طلب صداقة — من المقترحين وحدهم.
 *
 * لا بحث بالبريد ولا اكتشاف عام: من لا يجمعك به صديقٌ مشترك لا يظهر لك
 * ولا يصلك منه طلب. والفحص هنا لا في الشاشة.
 */
export async function requestFriend(userId: string, targetId: string) {
  if (targetId === userId) throw badRequest("لا يمكنك إضافة نفسك");

  const blocked = await blockedWith(userId);
  if (blocked.includes(targetId)) throw notFound("لا يوجد هذا الحساب");

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, isOpen: true },
  });
  if (!target) throw notFound("لا يوجد هذا الحساب");

  /*
    الإضافة من أصدقاء الأصدقاء وحدهم (القاعدة ٢٠) — **إلا الحسابَ
    المفتوح**: حسابُ أخبار التطبيق يقبل من أيّ أحد، وإلا احتاج كلُّ
    مستخدمٍ جديد وسيطاً ليصل إلى أخبار التطبيق الذي نزّله للتوّ.
  */
  if (!target.isOpen && (await mutualCount(userId, targetId)) === 0) {
    throw forbidden("ما بينكما صديق مشترك");
  }
  await assertRoomForBoth(userId, targetId);

  // طلبٌ قادمٌ من الطرف الآخر يُقبل بالطلب المقابل: لا يُنشأ طلبان.
  const incoming = await prisma.friendship.findUnique({
    where: { requesterId_addresseeId: { requesterId: targetId, addresseeId: userId } },
    select: { id: true, status: true },
  });
  if (incoming) {
    if (incoming.status === "PENDING") return acceptFriend(userId, incoming.id);
    return { status: "ACCEPTED" as const };
  }

  await prisma.friendship.upsert({
    where: { requesterId_addresseeId: { requesterId: userId, addresseeId: targetId } },
    create: { requesterId: userId, addresseeId: targetId },
    update: {},
  });
  return { status: "PENDING" as const };
}

/**
 * قبول طلب.
 *
 * ويُكتب سطرٌ في خطّ كلٍّ منهما: «صار صديقاً لفلان» حدثٌ في حياة
 * الدائرة، ويراه كلٌّ في صفحته لا في صفحة الآخر.
 */
export async function acceptFriend(userId: string, friendshipId: string) {
  const friendship = await prisma.friendship.findUnique({
    where: { id: friendshipId },
    select: { id: true, requesterId: true, addresseeId: true, status: true },
  });
  if (!friendship || friendship.addresseeId !== userId) throw notFound("لا يوجد هذا الطلب");
  if (friendship.status === "ACCEPTED") return { status: "ACCEPTED" as const };

  await assertRoomForBoth(friendship.requesterId, friendship.addresseeId);

  const [me, other] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
    prisma.user.findUnique({ where: { id: friendship.requesterId }, select: { name: true } }),
  ]);

  await prisma.$transaction([
    prisma.friendship.update({ where: { id: friendshipId }, data: { status: "ACCEPTED" } }),
    prisma.moment.create({
      data: { authorId: userId, kind: "FRIEND_ADDED", text: other?.name ?? null },
    }),
    prisma.moment.create({
      data: { authorId: friendship.requesterId, kind: "FRIEND_ADDED", text: me?.name ?? null },
    }),
  ]);

  return { status: "ACCEPTED" as const };
}

/** تُرفض الطلبات بالحذف: لا حالة «مرفوض» تُبقي أثراً لمن رفض من. */
export async function ignoreFriend(userId: string, friendshipId: string) {
  const friendship = await prisma.friendship.findUnique({
    where: { id: friendshipId },
    select: { addresseeId: true, status: true },
  });
  if (!friendship || friendship.addresseeId !== userId) throw notFound("لا يوجد هذا الطلب");
  if (friendship.status === "ACCEPTED") throw badRequest("الصداقة مقبولة");

  await prisma.friendship.delete({ where: { id: friendshipId } });
  return { ok: true };
}

/**
 * إخراج صديق من الدائرة.
 * حذفٌ للصفّ لا حالة «سابق»: الدائرة سجلّ من فيها الآن، لا أرشيف من مرّ.
 */
export async function removeFriend(userId: string, friendId: string) {
  await prisma.friendship.deleteMany({
    where: {
      OR: [
        { requesterId: userId, addresseeId: friendId },
        { requesterId: friendId, addresseeId: userId },
      ],
    },
  });
  return { ok: true };
}

/**
 * التصنيف يملكه صاحبه وحده: تصنيفك لشخصٍ «عائلة» لا يراه هو ولا غيره،
 * وهو الفرق بين تنظيمٍ لنفسك وتسميةٍ تُلصق بالناس.
 */
export async function createGroup(userId: string, name: string) {
  const clean = name.trim().slice(0, 20);
  if (!clean) throw badRequest("اكتب اسم التصنيف");

  const last = await prisma.friendGroup.findFirst({
    where: { ownerId: userId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const group = await prisma.friendGroup.upsert({
    where: { ownerId_name: { ownerId: userId, name: clean } },
    create: { ownerId: userId, name: clean, sortOrder: (last?.sortOrder ?? 0) + 1 },
    update: {},
    select: { id: true, name: true },
  });
  return group;
}

export async function deleteGroup(userId: string, groupId: string) {
  await prisma.friendGroup.deleteMany({ where: { id: groupId, ownerId: userId } });
  return { ok: true };
}

/** نقل صديق إلى تصنيف، أو إخراجه منها كلها بقيمة فارغة. */
export async function setFriendGroup(userId: string, friendId: string, groupId: string | null) {
  const circle = await circleIds(userId);
  if (!circle.includes(friendId)) throw forbidden("ليس من أصدقائك");

  const mine = await prisma.friendGroup.findMany({
    where: { ownerId: userId },
    select: { id: true },
  });
  const ids = mine.map((group) => group.id);

  await prisma.groupMember.deleteMany({ where: { userId: friendId, groupId: { in: ids } } });
  if (groupId && ids.includes(groupId)) {
    await prisma.groupMember.create({ data: { groupId, userId: friendId } });
  }
  return { ok: true };
}

/** الحظر: لا يرى أحدهما الآخر ولا يتفاعل معه، والصداقة تُفكّ إن وُجدت. */
export async function blockUser(userId: string, targetId: string) {
  if (targetId === userId) throw badRequest("لا يمكنك حظر نفسك");

  await prisma.$transaction([
    prisma.block.upsert({
      where: { blockerId_blockedId: { blockerId: userId, blockedId: targetId } },
      create: { blockerId: userId, blockedId: targetId },
      update: {},
    }),
    prisma.friendship.deleteMany({
      where: {
        OR: [
          { requesterId: userId, addresseeId: targetId },
          { requesterId: targetId, addresseeId: userId },
        ],
      },
    }),
  ]);
  return { ok: true };
}

export async function unblockUser(userId: string, targetId: string) {
  await prisma.block.deleteMany({ where: { blockerId: userId, blockedId: targetId } });
  return { ok: true };
}

/** المحظورون — لقائمة «المحظورون» في الخصوصية. */
export async function blockedList(userId: string) {
  const rows = await prisma.block.findMany({
    where: { blockerId: userId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, blocked: { select: PERSON } },
  });
  return rows.map((row) => ({ ...row.blocked, blockedAt: row.createdAt }));
}
