import "server-only";
import { prisma } from "@/lib/db";
import { circleIds } from "@/lib/circle";

const momentShape = {
  id: true,
  kind: true,
  text: true,
  placeName: true,
  placeCity: true,
  musicTitle: true,
  musicArtist: true,
  imageSpec: true,
  expiresAt: true,
  createdAt: true,
  author: {
    select: { id: true, name: true, frame: { select: { spec: true } } },
  },
  tags: {
    where: { approved: true },
    select: { user: { select: { id: true, name: true } } },
  },
  reactions: { select: { userId: true, kind: true, emoji: true } },
  joinings: { select: { userId: true, user: { select: { name: true } } } },
  _count: { select: { views: true, comments: true } },
} as const;

export type FeedMoment = Awaited<ReturnType<typeof timeline>>[number];

/**
 * الخط الزمني: لحظات الدائرة ولحظاتك، عدا الحضور المؤقت المنتهي.
 *
 * الحضور المنتهي يختفي من الخط الزمني ولا يُحذف — يبقى في أرشيف صاحبه،
 * لأن قيمة الأرشيف هي ما يجعل التطبيق مفيداً حتى لو صمت الجميع.
 */
export async function timeline(userId: string) {
  const ids = await circleIds(userId);
  const authors = [...ids, userId];
  const now = new Date();

  const moments = await prisma.moment.findMany({
    where: {
      authorId: { in: authors },
      OR: [{ kind: { not: "PRESENCE" } }, { expiresAt: { gt: now } }],
    },
    select: momentShape,
    orderBy: { createdAt: "desc" },
    take: 60,
  });

  // حجم الدائرة يُقرأ مرة ويُمرَّر، فإيصال القراءة يعرض «من كم» بلا استعلام لكل بطاقة.
  return moments;
}

export async function circleCount(userId: string): Promise<number> {
  return (await circleIds(userId)).length;
}

export async function momentById(id: string) {
  return prisma.moment.findUnique({
    where: { id },
    select: {
      ...momentShape,
      views: {
        select: { user: { select: { id: true, name: true } }, seenAt: true },
        orderBy: { seenAt: "desc" },
      },
      comments: {
        select: {
          id: true,
          body: true,
          createdAt: true,
          user: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

/** الحاضرون الآن في دائرتك — يغذّي شاشة الدائرة. */
export async function presentNow(userId: string) {
  const ids = await circleIds(userId);
  return prisma.moment.findMany({
    where: { kind: "PRESENCE", authorId: { in: ids }, expiresAt: { gt: new Date() } },
    select: {
      id: true,
      placeName: true,
      expiresAt: true,
      author: { select: { id: true, name: true, frame: { select: { spec: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
}

/** أرشيف المستخدم نفسه — كل شيء، بما فيه الحضور المنتهي. */
export async function archive(userId: string) {
  return prisma.moment.findMany({
    where: { authorId: userId },
    select: { id: true, kind: true, imageSpec: true, createdAt: true, placeName: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function pendingTags(userId: string) {
  return prisma.momentTag.findMany({
    where: { userId, approved: false },
    select: {
      id: true,
      moment: {
        select: {
          kind: true,
          placeName: true,
          author: { select: { name: true } },
        },
      },
    },
  });
}
