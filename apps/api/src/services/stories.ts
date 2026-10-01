import { prisma } from "@athar/db";
import { STORY_HOURS, STORY_SECONDS, type StoryText } from "@athar/shared";
import { guard } from "../lib/moderation";
import { badRequest, notFound } from "../lib/errors";
import { visibleAuthors } from "./visibility";
import { dropMedia } from "./media";

/**
 * القصص.
 *
 * تُقرأ من `expiresAt` لا من مهمة تنظيف: الاستعلام يستبعد المنتهية
 * فتختفي في لحظتها، والصفوف تُحذف مع الكنس. و«لا يُحتفظ بها» تعني ألّا
 * تبقى صفوفُها ولا بكسلاتها — `Story` لا تحذف `Media` بحكم اتجاه
 * العلاقة، فتُحذف الملفات بأيدينا بعدها.
 */

export type StoryRing = {
  userId: string;
  name: string;
  avatarMediaId: string | null;
  frame: { spec: string } | null;
  /** فيها ما لم يُشاهَد بعد — الحلقة الملوّنة. */
  fresh: boolean;
  count: number;
};

/** حلقات القصص: أنت أولاً، ثم من لم تُشاهد قصصهم، ثم البقية. */
export async function rings(userId: string): Promise<StoryRing[]> {
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
          frame: { select: { spec: true, mediaId: true, frameHole: true } },
        },
      },
      views: { where: { userId }, select: { id: true } },
    },
  });

  const out = new Map<string, StoryRing>();
  for (const story of stories) {
    const ring = out.get(story.authorId) ?? {
      userId: story.authorId,
      name: story.author.name,
      avatarMediaId: story.author.avatarMediaId,
      frame: story.author.frame,
      fresh: false,
      count: 0,
    };
    ring.count += 1;
    if (story.views.length === 0) ring.fresh = true;
    out.set(story.authorId, ring);
  }

  return [...out.values()].sort((a, b) => {
    if (a.userId === userId) return -1;
    if (b.userId === userId) return 1;
    if (a.fresh !== b.fresh) return a.fresh ? -1 : 1;
    return a.name.localeCompare(b.name, "ar");
  });
}

/** قصص شخصٍ بعينه، الأقدم أولاً — هكذا تُشاهد. */
export async function storiesOf(viewerId: string, authorId: string) {
  const authors = await visibleAuthors(viewerId);
  if (!authors.includes(authorId)) throw notFound("لا قصص هنا");

  return prisma.story.findMany({
    where: { authorId, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      mediaId: true,
      caption: true,
      filter: true,
      seconds: true,
      texts: true,
      createdAt: true,
      media: { select: { mime: true } },
      author: { select: { id: true, name: true, avatarMediaId: true } },
      // مشاهداتُ غير صاحبها: صاحبُ القصة يفتحها فيُكتب له إيصالٌ كغيره.
      _count: { select: { views: { where: { userId: { not: authorId } } } } },
    },
  });
}

/**
 * من شاهد قصّتي — لصاحبها وحده.
 *
 * الأحدثُ أوّلاً، وبلا صاحبها. والقصّةُ لغير صاحبها «غير موجودة» لا
 * «ممنوعة» (القاعدة ٢٣ب): من يسأل عن مشاهدي قصّة غيره لا يُقال له إنّها قائمة.
 */
export async function viewers(userId: string, storyId: string) {
  const story = await prisma.story.findFirst({
    where: { id: storyId, authorId: userId },
    select: { id: true },
  });
  if (!story) throw notFound("القصة غير موجودة");

  const rows = await prisma.storyView.findMany({
    where: { storyId, userId: { not: userId } },
    orderBy: { seenAt: "desc" },
    take: 200,
    select: {
      seenAt: true,
      user: {
        select: {
          id: true,
          name: true,
          avatarMediaId: true,
          frame: { select: { spec: true, mediaId: true, frameHole: true } },
          charm: { select: { spec: true, mediaId: true } },
        },
      },
    },
  });
  return rows.map((row) => ({ ...row.user, seenAt: row.seenAt }));
}

/** نشر قصة: تُعرض لأصدقائك يوماً ثم تذهب. */
export async function post(
  userId: string,
  input: { mediaId: string; filter?: string; seconds?: number; texts?: StoryText[] },
) {
  // ما يُكتب على القصة يمرّ بالقائمة نفسها التي تمرّ بها اللحظةُ والتعليق.
  for (const item of input.texts ?? []) await guard(item.t);

  const media = await prisma.media.findFirst({
    where: { id: input.mediaId, ownerId: userId, ready: true },
    select: { id: true, mime: true },
  });
  if (!media) throw notFound("الملف غير موجود");

  // الفيديو له حدُّه بالثواني، والصورة لا مدّة لها.
  const video = media.mime.startsWith("video/");
  const seconds = video ? Math.round(input.seconds ?? 0) : null;
  if (video && (!Number.isFinite(seconds) || (seconds ?? 0) < 1)) {
    throw badRequest("تعذّرت قراءة مدّة الفيديو");
  }
  if (video && (seconds ?? 0) > STORY_SECONDS) throw badRequest(`الحدّ ${STORY_SECONDS} ثانية`);

  const story = await prisma.story.create({
    data: {
      authorId: userId,
      mediaId: media.id,
      filter: input.filter?.slice(0, 20) || null,
      seconds,
      texts: input.texts?.length ? input.texts : undefined,
      expiresAt: new Date(Date.now() + STORY_HOURS * 60 * 60 * 1000),
    },
    select: { id: true },
  });
  return story;
}

/** إيصال مشاهدة — منه تُطفأ حلقتها. */
export async function see(userId: string, storyId: string) {
  /*
    الإيصالُ لمن يرى القصّة فعلاً، ولا يُكتب لصاحبها: كان أيُّ حسابٍ يعرف
    معرّفها يدخل قائمةَ مشاهديها، وكان صاحبُها يُعدّ من مشاهديه.
  */
  const story = await prisma.story.findFirst({
    where: { id: storyId, expiresAt: { gt: new Date() } },
    select: { authorId: true },
  });
  if (!story || story.authorId === userId) return { ok: true };
  const authors = await visibleAuthors(userId);
  if (!authors.includes(story.authorId)) return { ok: true };

  await prisma.storyView.upsert({
    where: { storyId_userId: { storyId, userId } },
    create: { storyId, userId },
    update: {},
  });
  return { ok: true };
}

/** الحذف بيد صاحبها — ومعه ملفُّها. */
export async function remove(userId: string, storyId: string) {
  const story = await prisma.story.findFirst({
    where: { id: storyId, authorId: userId },
    select: { id: true, mediaId: true },
  });
  if (!story) throw notFound("القصة غير موجودة");

  await prisma.story.delete({ where: { id: story.id } });
  await dropMedia([story.mediaId]);
  return { ok: true };
}

/** كنسُ المنتهية — صفوفُها وملفاتها معاً. */
export async function sweep(): Promise<number> {
  const dead = await prisma.story.findMany({
    where: { expiresAt: { lt: new Date() } },
    select: { id: true, mediaId: true },
    take: 500,
  });
  if (dead.length === 0) return 0;

  await prisma.story.deleteMany({ where: { id: { in: dead.map((row) => row.id) } } });
  await dropMedia(dead.map((row) => row.mediaId));
  return dead.length;
}
