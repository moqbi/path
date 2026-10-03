import "server-only";
import { prisma } from "@/lib/db";
import { visibleAuthors } from "@/lib/visibility";
import { dropMedia } from "@/lib/media";

/** عمر القصة: يوم كامل ثم تذهب. */
export const STORY_HOURS = 24;

/** أقصى مدّة لفيديو القصة بالثواني. */
export const STORY_SECONDS = 30;

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
      select: { id: true, mediaId: true, audioMediaId: true },
      take: 500,
    });
    if (dead.length === 0) return;
    await prisma.story.deleteMany({ where: { id: { in: dead.map((row) => row.id) } } });
    // ومعها ملفاتها من السحابة — صورتُها وصوتُها (القاعدة ٢٣٨): «لا يُحتفظ بها» تعني هناك أيضاً.
    await dropMedia(dead.flatMap((row) => [row.mediaId, ...(row.audioMediaId ? [row.audioMediaId] : [])]));
  } catch {}
}

export type StoryRing = {
  userId: string;
  name: string;
  avatarMediaId: string | null;
  frame: { spec: string; mediaId: string | null; frameHole: number | null } | null;
  /** فيها ما لم يُشاهَد بعد — الحلقة الملوّنة. */
  fresh: boolean;
  count: number;
  /** فيها قصّةٌ خاصّة ممّا يراه القارئ — قفلٌ على الحلقة (القاعدة ٢١٩). */
  private: boolean;
};

/** من يرى القصّة — نسخةُ `storyVisibleTo` في الخادم حرفاً بحرف (القاعدة ٢١٩). */
export const storyVisibleTo = (viewerId: string) => ({
  OR: [{ authorId: viewerId }, { private: false }, { audience: { some: { userId: viewerId } } }],
});

/**
 * حلقات القصص: أنت أولاً، ثم من لم تُشاهد قصصهم، ثم البقية.
 *
 * القصة تُقرأ من `expiresAt` لا من مهمة تنظيف: الاستعلام يستبعد المنتهية
 * فتختفي في لحظتها، والصفوف القديمة تُحذف حين نشاء لا حين يجب.
 */
export async function storyRings(userId: string): Promise<StoryRing[]> {
  const authors = await visibleAuthors(userId);

  const stories = await prisma.story.findMany({
    where: { authorId: { in: authors }, expiresAt: { gt: new Date() }, ...storyVisibleTo(userId) },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      authorId: true,
      private: true,
      author: {
        select: {
          id: true,
          name: true,
          avatarMediaId: true,
          frame: { select: { spec: true, mediaId: true, frameHole: true } },
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
      private: false,
    };
    ring.count += 1;
    if (story.private) ring.private = true;
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

  const rows = await prisma.story.findMany({
    where: { authorId, expiresAt: { gt: new Date() }, ...storyVisibleTo(viewerId) },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      private: true,
      mediaId: true,
      caption: true,
      filter: true,
      seconds: true,
      texts: true,
      stickers: true,
      audioMediaId: true,
      audioSeconds: true,
      createdAt: true,
      media: { select: { mime: true } },
      author: { select: { id: true, name: true, avatarMediaId: true } },
      views: { where: { userId: viewerId }, select: { reaction: true } },
      // مشاهداتُ غير صاحبها — كالخادم.
      _count: { select: { views: { where: { userId: { not: authorId } } } } },
    },
  });
  return rows.map(({ views, ...row }) => ({ ...row, myReaction: views[0]?.reaction ?? null }));
}

/** من شاهد قصص صاحبها — لكل قصّةٍ قائمتُها، الأحدثُ أوّلاً وبلاه هو. */
export async function viewersOf(ownerId: string, storyIds: string[]) {
  const rows = await prisma.storyView.findMany({
    where: { storyId: { in: storyIds }, userId: { not: ownerId }, story: { authorId: ownerId } },
    orderBy: { seenAt: "desc" },
    select: {
      storyId: true,
      seenAt: true,
      reaction: true,
      reactedAt: true,
      user: { select: { id: true, name: true, avatarMediaId: true } },
    },
  });
  // من تفاعل أوّلاً ثمّ من شاهد وسكت — كالخادم (القاعدة ٢٣٨).
  const at = (row: (typeof rows)[number]) => (row.reactedAt ?? row.seenAt).getTime();
  rows.sort((a, b) => (a.reaction ? 0 : 1) - (b.reaction ? 0 : 1) || at(b) - at(a));
  const out = new Map<
    string,
    { id: string; name: string; avatarMediaId: string | null; seenAt: string; reaction: string | null }[]
  >();
  for (const row of rows) {
    const list = out.get(row.storyId) ?? [];
    list.push({ ...row.user, seenAt: row.seenAt.toISOString(), reaction: row.reaction });
    out.set(row.storyId, list);
  }
  return out;
}
