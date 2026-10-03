import { prisma } from "@athar/db";
import { STORY_HOURS, STORY_SECONDS, type StorySticker, type StoryText } from "@athar/shared";
import { getObject, putObject } from "@athar/storage";
import { guard } from "../lib/moderation";
import { badRequest, notFound } from "../lib/errors";
import { NoFfmpeg, trimAudio } from "../lib/process";
import { circleIds, visibleAuthors } from "./visibility";
import { dropMedia } from "./media";
import { push } from "./push";

/**
 * القصص.
 *
 * تُقرأ من `expiresAt` لا من مهمة تنظيف: الاستعلام يستبعد المنتهية
 * فتختفي في لحظتها، والصفوف تُحذف مع الكنس. و«لا يُحتفظ بها» تعني ألّا
 * تبقى صفوفُها ولا بكسلاتها — `Story` لا تحذف `Media` بحكم اتجاه
 * العلاقة، فتُحذف الملفات بأيدينا بعدها.
 */

/**
 * من يرى القصّة (القاعدة ٢١٩): صاحبُها، أو قصّةٌ لدائرته كلّها، أو خاصّةٌ خُصّ بها
 * القارئ. شرطٌ في كل استعلامٍ يقرأ القصص — حلقاتٍ وعرضاً وإيصالاً وملفّاً — لا
 * تصفيةٌ بعده، فلا تُسرَّب قصّةٌ خاصّة من بابٍ نُسي.
 */
export const storyVisibleTo = (viewerId: string) => ({
  OR: [{ authorId: viewerId }, { private: false }, { audience: { some: { userId: viewerId } } }],
});

export type StoryRing = {
  userId: string;
  name: string;
  avatarMediaId: string | null;
  frame: { spec: string } | null;
  /** فيها ما لم يُشاهَد بعد — الحلقة الملوّنة. */
  fresh: boolean;
  count: number;
  /** فيها قصّةٌ خاصّة ممّا يراه القارئ — قفلٌ على الحلقة. */
  private: boolean;
};

/** حلقات القصص: أنت أولاً، ثم من لم تُشاهد قصصهم، ثم البقية. */
export async function rings(userId: string): Promise<StoryRing[]> {
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
      private: false,
    };
    ring.count += 1;
    if (story.private) ring.private = true;
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
      // تفاعلُ القارئ نفسه — يُضاء وجهُه في الشريط إن عاد إليها.
      views: { where: { userId: viewerId }, select: { reaction: true } },
      // مشاهداتُ غير صاحبها: صاحبُ القصة يفتحها فيُكتب له إيصالٌ كغيره.
      _count: { select: { views: { where: { userId: { not: authorId } } } } },
    },
  });
  // وعددُ من تفاعل لصاحبها وحده: «شاهدها ٥ · تفاعل ٢».
  const reacted =
    viewerId === authorId && rows.length
      ? await prisma.storyView.groupBy({
          by: ["storyId"],
          where: { storyId: { in: rows.map((row) => row.id) }, reaction: { not: null }, userId: { not: authorId } },
          _count: { _all: true },
        })
      : [];
  const reactions = new Map(reacted.map((row) => [row.storyId, row._count._all]));
  return rows.map(({ views, ...row }) => ({
    ...row,
    myReaction: views[0]?.reaction ?? null,
    reactions: reactions.get(row.id) ?? 0,
  }));
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
      reaction: true,
      reactedAt: true,
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
  /*
    من تفاعل أوّلاً بأحدث تفاعل، ثمّ من شاهد ولم يتفاعل بأحدث مشاهدة — **بقرار
    المالك**: الوجهُ فوق صورته يقول ما قاله، وغيابُه يقول «شاهد وسكت».
  */
  const at = (row: (typeof rows)[number]) => (row.reactedAt ?? row.seenAt).getTime();
  return [...rows]
    .sort((a, b) => (a.reaction ? 0 : 1) - (b.reaction ? 0 : 1) || at(b) - at(a))
    .map((row) => ({ ...row.user, seenAt: row.seenAt, reaction: row.reaction }));
}

/** نشر قصة: تُعرض لأصدقائك يوماً ثم تذهب. */
export async function post(
  userId: string,
  input: {
    mediaId: string;
    filter?: string;
    seconds?: number;
    texts?: StoryText[];
    audience?: string[];
    stickers?: StorySticker[];
    audio?: { mediaId: string; start: number; end: number };
  },
) {
  /*
    الخاصّةُ لمن في دائرة صاحبها وحدهم: معرّفٌ من خارجها يُترك بصمت، فلا تصير
    القصّةُ باباً إلى غريب. وقائمةٌ لم يبقَ فيها أحدٌ تُردّ: قصّةٌ خاصّة بلا جمهور
    لا يراها غيرُ صاحبها، وهذا ليس ما أراد.
  */
  let audience: string[] = [];
  if (input.audience?.length) {
    const circle = new Set(await circleIds(userId));
    audience = [...new Set(input.audience)].filter((id) => circle.has(id));
    if (audience.length === 0) throw badRequest("اختر من أصدقائك من يشوفها");
  }

  // ما يُكتب على القصة يمرّ بالقائمة نفسها التي تمرّ بها اللحظةُ والتعليق.
  for (const item of input.texts ?? []) await guard(item.t);

  /*
    إحداثيّاتُ ملصق الموقع لا تُحفظ و«إظهار موقعي» مطفأ (القاعدة ٢١١): يبقى
    الاسمُ والمدينة، والضغطةُ تبحث بهما في الخرائط.
  */
  const owner = await prisma.user.findUnique({ where: { id: userId }, select: { shareLocation: true } });
  const locate = owner?.shareLocation ?? false;

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

  // ملصقُ الموسيقى ينطق بصوتٍ موجود، فبلا صوتٍ لا يُكتب. والصوتُ على الصورة وحدها.
  if (video && input.audio) throw badRequest("الصوت للقصص المصوّرة — المقطع له صوته");
  const audio = input.audio ? await cutSound(userId, input.audio) : null;
  const stickers = (input.stickers ?? [])
    .filter((item) => item.kind !== "music" || audio)
    .map((item) => (item.kind === "place" && !locate ? { ...item, lat: undefined, lng: undefined } : item));
  for (const item of stickers) {
    if (item.kind === "place") await guard(item.name);
    if (item.kind === "music" && item.label) await guard(item.label);
  }

  const story = await prisma.story.create({
    data: {
      authorId: userId,
      mediaId: media.id,
      filter: input.filter?.slice(0, 20) || null,
      seconds,
      texts: input.texts?.length ? input.texts : undefined,
      stickers: stickers.length ? stickers : undefined,
      audioMediaId: audio?.id,
      audioSeconds: audio?.seconds,
      private: audience.length > 0,
      audience: audience.length ? { create: audience.map((id) => ({ userId: id })) } : undefined,
      expiresAt: new Date(Date.now() + STORY_HOURS * 60 * 60 * 1000),
    },
    select: { id: true },
  });
  return story;
}

/**
 * يقصّ صوتَ القصّة ويُبقي المقطعَ وحده (القاعدة ٢٣٨).
 *
 * الملفُّ رُفع بغرض `SOUND` فسُحب صوتُه كاملاً عند اعتماده؛ وهنا يُكتب فوقه ما
 * بين البداية والنهاية فلا يبقى في الدلو غيرُه. وملفٌّ مربوطٌ بقصّةٍ أخرى لا
 * يُعاد: قصُّه ثانيةً يقصّ ما قُصّ.
 */
async function cutSound(userId: string, input: { mediaId: string; start: number; end: number }) {
  const media = await prisma.media.findFirst({
    where: { id: input.mediaId, ownerId: userId, ready: true, purpose: "SOUND", storyAudio: null },
    select: { id: true, key: true },
  });
  if (!media?.key) throw badRequest("اختر الصوت من جديد");

  const length = Math.min(STORY_SECONDS, input.end - input.start);
  const response = await getObject(media.key);
  if (!response.ok) throw badRequest("اختر الصوت من جديد");
  const bytes = new Uint8Array(await response.arrayBuffer());
  try {
    const cut = await trimAudio(bytes, input.start, length);
    await putObject(media.key, cut.bytes, "audio/mp4");
    return { id: media.id, seconds: cut.seconds };
  } catch (problem) {
    if (problem instanceof NoFfmpeg) {
      console.error("[stories] ffmpeg مفقود على هذا الخادم — صوتُ القصّة لا يُقصّ");
      throw badRequest("إضافة الصوت غير متاحة الآن");
    }
    throw badRequest("تعذّر قصّ الصوت");
  }
}

/**
 * تفاعلُ المشاهد بأحد الوجوه الخمسة — **بقرار المالك**. والتفاعلُ مشاهدةٌ
 * أيضاً، فيُكتب في صفّ الإيصال نفسه بشروطه نفسها: لمن يرى القصّة، ولا لصاحبها.
 * و`null` يرفعه. والجرسُ لتفاعلٍ جديدٍ أو مختلف لا لتكراره.
 */
export async function react(userId: string, storyId: string, kind: "SMILE" | "LAUGH" | "GASP" | "SAD" | "LOVE" | null) {
  const story = await prisma.story.findFirst({
    where: { id: storyId, expiresAt: { gt: new Date() }, ...storyVisibleTo(userId) },
    select: { authorId: true },
  });
  if (!story || story.authorId === userId) throw notFound("القصة غير موجودة");
  const authors = await visibleAuthors(userId);
  if (!authors.includes(story.authorId)) throw notFound("القصة غير موجودة");

  const before = await prisma.storyView.findUnique({
    where: { storyId_userId: { storyId, userId } },
    select: { reaction: true },
  });
  const data = { reaction: kind, reactedAt: kind ? new Date() : null };
  await prisma.storyView.upsert({
    where: { storyId_userId: { storyId, userId } },
    create: { storyId, userId, ...data },
    update: data,
  });

  if (kind && before?.reaction !== kind) {
    const who = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    void push({
      userId: story.authorId,
      kind: "REACTION",
      title: "تفاعل جديد على قصتك",
      body: `${who?.name ?? "صديق"} تفاعل مع قصتك`,
      path: `/stories/${story.authorId}`,
    });
  }
  return { reaction: kind };
}

/** إيصال مشاهدة — منه تُطفأ حلقتها. */
export async function see(userId: string, storyId: string) {
  /*
    الإيصالُ لمن يرى القصّة فعلاً، ولا يُكتب لصاحبها: كان أيُّ حسابٍ يعرف
    معرّفها يدخل قائمةَ مشاهديها، وكان صاحبُها يُعدّ من مشاهديه.
  */
  const story = await prisma.story.findFirst({
    where: { id: storyId, expiresAt: { gt: new Date() }, ...storyVisibleTo(userId) },
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
    select: { id: true, mediaId: true, audioMediaId: true },
  });
  if (!story) throw notFound("القصة غير موجودة");

  await prisma.story.delete({ where: { id: story.id } });
  // وصوتُها معها (القاعدة ١٠٤): علاقتُه `SetNull` فلا يذهب بحذفها وحده.
  await dropMedia([story.mediaId, ...(story.audioMediaId ? [story.audioMediaId] : [])]);
  return { ok: true };
}

/** كنسُ المنتهية — صفوفُها وملفاتها معاً. */
export async function sweep(): Promise<number> {
  const dead = await prisma.story.findMany({
    where: { expiresAt: { lt: new Date() } },
    select: { id: true, mediaId: true, audioMediaId: true },
    take: 500,
  });

  /*
    وأصواتٌ رُفعت ولم تُنشر معها قصّة — اختار صاحبُها مقطعاً ثمّ عدل: لا تبقى في
    الدلو بلا شيءٍ يدلّ عليها (القاعدة ١٠٤). ستُّ ساعاتٍ تكفي ناشراً متردّداً.
  */
  const orphans = await prisma.media.findMany({
    where: { purpose: "SOUND", storyAudio: null, createdAt: { lt: new Date(Date.now() - 6 * 3600_000) } },
    select: { id: true },
    take: 200,
  });
  if (orphans.length) await dropMedia(orphans.map((row) => row.id));
  if (dead.length === 0) return 0;

  await prisma.story.deleteMany({ where: { id: { in: dead.map((row) => row.id) } } });
  await dropMedia(
    dead.flatMap((row) => [row.mediaId, ...(row.audioMediaId ? [row.audioMediaId] : [])]),
  );
  return dead.length;
}
