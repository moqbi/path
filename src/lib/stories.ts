import "server-only";
import { prisma } from "@/lib/db";
import { visibleAuthors } from "@/lib/visibility";

/** عمر القصة: يوم كامل ثم تذهب. */
export const STORY_HOURS = 24;

/** أقصى مدّة لفيديو القصة بالثواني. */
export const STORY_SECONDS = 20;

/** آخر كنسٍ في هذه العملية — مرّةً في الساعة تكفي. */
let sweptAt = 0;

/**
 * القصة المنتهية تُحذف هي وملفها.
 *
 * الاستعلام يستبعد المنتهية فتختفي من الشاشة في لحظتها، لكنّ «لا يُحتفظ
 * بها» تعني ألّا تبقى صفوفُها ولا بكسلاتها: `Story` لا تحذف `Media`
 * (العلاقة من جهة الملف)، فتُحذف الملفات بأيدينا بعدها.
 */
export async function sweepStories(): Promise<void> {
  if (Date.now() - sweptAt < 3_600_000) return;
  sweptAt = Date.now();
  try {
    const dead = await prisma.story.findMany({
      where: { expiresAt: { lt: new Date() } },
      select: { id: true, mediaId: true },
      take: 500,
    });
    if (dead.length === 0) return;
    await prisma.story.deleteMany({ where: { id: { in: dead.map((row) => row.id) } } });
    await prisma.media.deleteMany({ where: { id: { in: dead.map((row) => row.mediaId) } } });
  } catch {}
}

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
          charm: { select: { spec: true, mediaId: true } },
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
      filter: true,
      seconds: true,
      createdAt: true,
      media: { select: { mime: true } },
      author: { select: { id: true, name: true, avatarMediaId: true } },
      _count: { select: { views: true } },
    },
  });
}
