import "server-only";
import { prisma } from "@/lib/db";
import { circleIds } from "@/lib/circle";
import { visibleWhere } from "@/lib/visibility";

/** شكل اللحظة في الخط الزمني — تستعمله صفحات الملف الشخصي أيضاً
 * فلا يختلف عرض اللحظة باختلاف الصفحة التي جاءت منها. */
export const momentShape = {
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
  media: { select: { width: true, height: true } },
  lat: true,
  lng: true,
  createdAt: true,
  author: {
    select: {
      id: true,
      name: true,
      isPlus: true,
      avatarMediaId: true,
      frame: { select: { spec: true } },
      tag: { select: { name: true, bg: true, fg: true } },
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
  return prisma.moment.findMany({
    where: await visibleWhere(userId),
    select: momentShape,
    orderBy: { createdAt: "desc" },
    take: 60,
  });
}

/** اللحظات الخاصة: ما لم يُنشر للدائرة كلها — لي أو لمن اختارني. */
export async function privateTimeline(userId: string) {
  const where = await visibleWhere(userId);
  return prisma.moment.findMany({
    where: { ...where, audience: { not: "CIRCLE" } },
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

/** لحظاتي كاملةً كما تُعرض في الخط الزمني — لتبويب «أنا». */
export async function myMoments(userId: string) {
  return prisma.moment.findMany({
    where: { authorId: userId },
    select: momentShape,
    orderBy: { createdAt: "desc" },
    take: 40,
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
