import { prisma } from "@athar/db";
import { notFound } from "../lib/errors";
import { blockedWith, visibleWhere } from "./visibility";

/**
 * شكل اللحظة كما يقرؤها الموبايل.
 *
 * مسطّحٌ لا متداخل: الشاشة تقرأ `author.name` لا
 * `author.profile.display.name`، وكل حقلٍ لا تعرضه شاشةٌ لا يُرسل — فبايتاتُ
 * الشبكة على جوّالٍ في مصعد ليست مجانية.
 */
const shape = {
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
  createdAt: true,
  author: {
    select: {
      id: true,
      name: true,
      isPlus: true,
      avatarMediaId: true,
      frame: { select: { spec: true, mediaId: true } },
      charm: { select: { spec: true, mediaId: true } },
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
  comments: {
    select: {
      id: true,
      body: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          name: true,
          isPlus: true,
          avatarMediaId: true,
          tag: { select: { name: true, bg: true, fg: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
    take: 3,
  },
  _count: { select: { views: true, comments: true } },
} as const;

/**
 * يُسطّح ما ورد متداخلاً من Prisma.
 *
 * `tags` تأتي `{user:{…}}` و`reactions` تحمل `user` داخلها، والشاشة تقرأ
 * شخصاً لا غلافاً حوله. التسطيح هنا مرّةً أوفر من تكراره في كل شاشة.
 */
function flatten<T extends Row>(row: T, viewerId: string) {
  const { tags, reactions, ...rest } = row;
  return {
    ...rest,
    tags: tags.map((t) => t.user),
    // `mine` تُحسب هنا: الشاشة لا تعرف من القارئ إلا بسؤالٍ آخر، وزرُّ
    // التفاعل يحتاجها في كل لحظةٍ يرسمها.
    reactions: reactions.map(({ user, ...r }) => ({
      ...r,
      ...user,
      mine: r.userId === viewerId,
    })),
  };
}

type Row = {
  tags: { user: { id: string; name: string } }[];
  reactions: { userId: string; kind: string; emoji: string | null; user: { name: string; avatarMediaId: string | null } }[];
};

/** صفحةٌ بمؤشّر: نقرأ واحدةً زائدة لنعرف أثمّة تالٍ، ولا نعدّ الكلّ. */
function page<T extends Row & { id: string }>(rows: T[], limit: number, viewerId: string) {
  const more = rows.length > limit;
  const moments = (more ? rows.slice(0, limit) : rows).map((row) => flatten(row, viewerId));
  return { moments, nextCursor: more ? moments.at(-1)?.id : undefined };
}

/** المؤشّر يُقصي نفسه: نبدأ بما بعده لا به. */
const cursorOf = (cursor?: string) => ({
  cursor: cursor ? { id: cursor } : undefined,
  skip: cursor ? 1 : 0,
});

export type FeedMoment = Awaited<ReturnType<typeof timeline>>["moments"][number];

/**
 * الخط الزمني بصفحاتٍ بمؤشّر لا برقم صفحة.
 *
 * الترقيم بالرقم يكرّر لحظةً ويُسقط أخرى كلما نُشرت واحدةٌ أثناء التصفّح.
 * والمؤشّر هو معرّف آخر لحظةٍ قُرئت: ما بعده يأتي، ولو نُشر ألفٌ فوقه.
 */
export async function timeline(userId: string, options: { cursor?: string; limit: number }) {
  const where = await visibleWhere(userId);

  const rows = await prisma.moment.findMany({
    where,
    select: shape,
    orderBy: { createdAt: "desc" },
    take: options.limit + 1,
    ...cursorOf(options.cursor),
  });

  return page(rows, options.limit, userId);
}

/** اللحظات الخاصة: ما لم يُنشر للدائرة كلها. */
export async function privateTimeline(userId: string, options: { cursor?: string; limit: number }) {
  const where = await visibleWhere(userId);

  const rows = await prisma.moment.findMany({
    where: { ...where, audience: { not: "CIRCLE" } },
    select: shape,
    orderBy: { createdAt: "desc" },
    take: options.limit + 1,
    ...cursorOf(options.cursor),
  });

  return page(rows, options.limit, userId);
}

/**
 * «آثارنا»: الخط الزمني المشترك بين اثنين.
 *
 * ليس كل ما نشراه، بل ما يجمعهما فعلاً — لحظةٌ أشار فيها أحدهما إلى
 * الآخر، أو ترك عليها أثراً بتفاعلٍ أو تعليق. وشرط الرؤية يبقى فوق ذلك
 * كلّه: `visibleWhere` هي الباب الوحيد لقراءة اللحظات.
 *
 * ومن ليس في دائرتك لا أثرَ معه: الخادم يمنع، لا الواجهة.
 */
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

export async function togetherTimeline(userId: string, friendId: string) {
  const { circleIds } = await import("./visibility");
  const ids = await circleIds(userId);
  if (!ids.includes(friendId)) throw notFound("لا يوجد هذا الحساب");

  const [visible, friendship] = await Promise.all([
    visibleWhere(userId),
    prisma.friendship.findFirst({
      where: {
        status: "ACCEPTED",
        OR: [
          { requesterId: userId, addresseeId: friendId },
          { requesterId: friendId, addresseeId: userId },
        ],
      },
      select: { createdAt: true },
    }),
  ]);

  const rows = await prisma.moment.findMany({
    where: {
      AND: [visible, { OR: [involves(userId, friendId), involves(friendId, userId)] }],
    },
    select: shape,
    orderBy: { createdAt: "desc" },
    take: 80,
  });

  return {
    ...page(rows, rows.length, userId),
    /** متى بدأ الأثر: تاريخ الصداقة. */
    since: friendship?.createdAt ?? null,
  };
}

/**
 * لحظةٌ بعينها.
 *
 * الشرط نفسه يُدمج هنا: «غير موجودة» لمن لا يراها — لا «غير مصرّح».
 * التفريق بينهما يقول للفضولي إنّ الشيء موجود.
 */
export async function momentById(userId: string, momentId: string) {
  const where = await visibleWhere(userId);

  const moment = await prisma.moment.findFirst({
    where: { id: momentId, ...where },
    select: {
      ...shape,
      comments: {
        select: shape.comments.select,
        orderBy: { createdAt: "asc" },
        take: 100,
      },
    },
  });
  if (!moment) throw notFound("اللحظة غير موجودة");
  return flatten(moment, userId);
}

/** لحظات شخصٍ بعينه — بنفس شرط الرؤية. */
export async function momentsOf(
  userId: string,
  authorId: string,
  options: { cursor?: string; limit: number },
) {
  /*
    والحساب المفتوح بابٌ ثانٍ ظاهرٌ كباب الإشراف: من يزوره يقرأ ما
    وُجّه إلى **الدائرة كلها** وحده — لا ما خُصّ به تصنيفٌ ولا أشخاصٌ
    بأعيانهم — فلا يُوسَّع `visibleWhere()` بثقبٍ يحمله كلُّ استعلام.
  */
  const author = await prisma.user.findUnique({
    where: { id: authorId },
    select: { isOpen: true },
  });

  // والحظر فوق الانفتاح: من حظره صاحبُ الحساب — أو حظره هو — لا يقرأه.
  const open =
    author?.isOpen === true && !(await blockedWith(userId)).includes(authorId);

  const where = open ? { audience: "CIRCLE" as const } : await visibleWhere(userId);

  const rows = await prisma.moment.findMany({
    where: { ...where, authorId },
    select: shape,
    orderBy: { createdAt: "desc" },
    take: options.limit + 1,
    ...cursorOf(options.cursor),
  });

  return page(rows, options.limit, userId);
}

/**
 * لحظات شخصٍ كما يقرؤها **المشرف** — بلا شرط الرؤية.
 *
 * وهذا بابٌ ثانٍ قصداً لا توسعةٌ لـ`visibleWhere()`: القاعدة ٢٣ تقول إنّ
 * `visibleWhere()` البابُ الوحيد لقراءة اللحظات، وإضافةُ استثناءٍ داخلها
 * تجعل كلّ استعلامٍ في التطبيق يحمل ثقباً يُفتح بحقلٍ في صفّ القارئ.
 * فالثقب هنا وحده، ظاهرٌ باسمه، ولا يُنادى إلا من خلف `requireModerator`.
 *
 * ولا تفاعلَ فيه ولا تعليقَ يُكتب: المشرف يقرأ ليحكم، لا ليشارك.
 */
export async function moderatedMomentsOf(
  viewerId: string,
  authorId: string,
  options: { cursor?: string; limit: number },
) {
  const rows = await prisma.moment.findMany({
    where: { authorId },
    select: shape,
    orderBy: { createdAt: "desc" },
    take: options.limit + 1,
    ...cursorOf(options.cursor),
  });

  return page(rows, options.limit, viewerId);
}
