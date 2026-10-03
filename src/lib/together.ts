import "server-only";
import { prisma } from "@/lib/db";
import type { MomentKind } from "@/generated/prisma/client";
import { momentShape } from "@/lib/feed";
import { visibleWhere } from "@/lib/visibility";

/** ما جمعهما بالإشارة وحدها — لا التفاعلُ ولا التعليق (بقرار المالك). */
function involves(authorId: string, otherId: string) {
  return { AND: [{ authorId }, { tags: { some: { userId: otherId } } }] };
}

/**
 * ما يُعدّ أثراً مشتركاً (القاعدة ١٥٩): صورةٌ ومكانٌ وأغنيةٌ وخاطرة — لا
 * الهدايا ولا الصداقة ولا النومُ والصحو. نسخةُ `apps/api` حرفاً بحرف.
 */
export const TOGETHER_KINDS: MomentKind[] = ["PHOTO", "PLACE", "MUSIC", "THOUGHT"];

/**
 * «آثارنا»: الخط الزمني المشترك بين اثنين.
 *
 * ليس كل ما نشراه، بل ما يجمعهما فعلاً — لحظةٌ أشار فيها أحدهما إلى
 * الآخر، من الأنواع التي تُعدّ (`TOGETHER_KINDS`).
 */
export async function togetherMoments(viewerId: string, friendId: string) {
  const visible = await visibleWhere(viewerId);

  return prisma.moment.findMany({
    where: {
      AND: [visible, { OR: [involves(viewerId, friendId), involves(friendId, viewerId)] }, { kind: { in: TOGETHER_KINDS } }],
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
