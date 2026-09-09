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
  musicUrl: true,
  musicThumb: true,
  imageSpec: true,
  mediaId: true,
  lat: true,
  lng: true,
  createdAt: true,
  author: {
    select: {
      id: true,
      name: true,
      avatarMediaId: true,
      frame: { select: { spec: true } },
    },
  },
  tags: { select: { user: { select: { id: true, name: true } } } },
  reactions: {
    select: {
      userId: true,
      kind: true,
      emoji: true,
      user: { select: { name: true, avatarMediaId: true } },
    },
  },
  // التعليقات تُعرض داخل الخط الزمني مباشرة، فلا حاجة لفتح اللحظة لقراءتها.
  comments: {
    select: {
      id: true,
      body: true,
      createdAt: true,
      user: { select: { id: true, name: true, avatarMediaId: true } },
    },
    orderBy: { createdAt: "asc" },
    take: 3,
  },
  _count: { select: { views: true, comments: true } },
} as const;

export type FeedMoment = Awaited<ReturnType<typeof timeline>>[number];

/** الخط الزمني: لحظات الدائرة ولحظاتك، الأحدث أولاً. */
export async function timeline(userId: string) {
  const ids = await circleIds(userId);

  return prisma.moment.findMany({
    where: { authorId: { in: [...ids, userId] } },
    select: momentShape,
    orderBy: { createdAt: "desc" },
    take: 60,
  });
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
    },
  });
}

/** أرشيف المستخدم نفسه — كل شيء، بما فيه الحضور المنتهي. */
export async function archive(userId: string) {
  return prisma.moment.findMany({
    where: { authorId: userId },
    select: {
      id: true,
      kind: true,
      imageSpec: true,
      mediaId: true,
      createdAt: true,
      placeName: true,
    },
    orderBy: { createdAt: "desc" },
  });
}
