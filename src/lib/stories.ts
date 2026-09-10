import "server-only";
import { prisma } from "@/lib/db";
import { visibleAuthors } from "@/lib/visibility";

/** عمر القصة: يوم كامل ثم تذهب. */
export const STORY_HOURS = 24;

export type StoryRing = {
  userId: string;
  name: string;
  avatarMediaId: string | null;
  frame: { spec: string } | null;
  /** فيها ما لم يُشاهَد بعد — الحلقة الملوّنة. */
  fresh: boolean;
  count: number;
};

/**
 * حلقات القصص: أنت أولاً، ثم من لم تُشاهد قصصهم، ثم البقية.
 *
 * القصة تُقرأ من `expiresAt` لا من مهمة تنظيف: الاستعلام يستبعد المنتهية
 * فتختفي في لحظتها، والصفوف القديمة تُحذف حين نشاء لا حين يجب.
 */
export async function storyRings(userId: string): Promise<StoryRing[]> {
  const authors = await visibleAuthors(userId);

  const stories = await prisma.story.findMany({
    where: { authorId: { in: authors }, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      authorId: true,
      author: {
        select: {
          id: true,
          name: true,
          avatarMediaId: true,
          frame: { select: { spec: true } },
        },
      },
      views: { where: { userId }, select: { id: true } },
    },
  });

  const rings = new Map<string, StoryRing>();
  for (const story of stories) {
    const ring = rings.get(story.authorId) ?? {
      userId: story.authorId,
      name: story.author.name,
      avatarMediaId: story.author.avatarMediaId,
      frame: story.author.frame,
      fresh: false,
      count: 0,
    };
    ring.count += 1;
    if (story.views.length === 0) ring.fresh = true;
    rings.set(story.authorId, ring);
  }

  return [...rings.values()].sort((a, b) => {
    if (a.userId === userId) return -1;
    if (b.userId === userId) return 1;
    if (a.fresh !== b.fresh) return a.fresh ? -1 : 1;
    return a.name.localeCompare(b.name, "ar");
  });
}

/** قصص شخصٍ بعينه، الأقدم أولاً — هكذا تُشاهد. */
export async function storiesOf(viewerId: string, authorId: string) {
  const authors = await visibleAuthors(viewerId);
  if (!authors.includes(authorId)) return [];

  return prisma.story.findMany({
    where: { authorId, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      mediaId: true,
      caption: true,
      createdAt: true,
      author: { select: { id: true, name: true, avatarMediaId: true } },
      _count: { select: { views: true } },
    },
  });
}
