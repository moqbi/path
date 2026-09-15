import "server-only";
import { prisma } from "@/lib/db";
import { momentShape } from "@/lib/feed";
import { visibleWhere } from "@/lib/visibility";

/** اللحظات التي يظهر فيها الاثنان: إشارةٌ من أحدهما، أو تفاعلٌ أو تعليقٌ من الآخر. */
function involves(authorId: string, otherId: string) {
  return {
    AND: [
      { authorId },
      {
        OR: [
          { tags: { some: { userId: otherId } } },
          { reactions: { some: { userId: otherId } } },
          { comments: { some: { userId: otherId } } },
        ],
      },
    ],
  };
}

/**
 * «آثارنا»: الخط الزمني المشترك بين اثنين.
 *
 * ليس كل ما نشراه، بل ما يجمعهما فعلاً — لحظةٌ أشار فيها أحدهما إلى
 * الآخر، أو ترك عليها أثراً بتفاعلٍ أو تعليق. هذا ما يستحق أن يُعدّ.
 */
export async function togetherMoments(viewerId: string, friendId: string) {
  const visible = await visibleWhere(viewerId);

  return prisma.moment.findMany({
    where: {
      AND: [visible, { OR: [involves(viewerId, friendId), involves(friendId, viewerId)] }],
    },
    select: momentShape,
    orderBy: { createdAt: "desc" },
    take: 80,
  });
}

/** متى بدأ الأثر: تاريخ الصداقة. */
export async function friendshipSince(a: string, b: string): Promise<Date | null> {
  const row = await prisma.friendship.findFirst({
    where: {
      status: "ACCEPTED",
      OR: [
        { requesterId: a, addresseeId: b },
        { requesterId: b, addresseeId: a },
      ],
    },
    select: { createdAt: true },
  });
  return row?.createdAt ?? null;
}
