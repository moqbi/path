import { prisma } from "@athar/db";

/**
 * من يرى ماذا.
 *
 * هذه القواعد هي قلب آثار، وهي منسوخةٌ حرفاً عن `src/lib/visibility.ts`
 * في الويب الحالي عمداً: تشغيلان لقاعدةٍ واحدة في وقتٍ واحد، فاختلاف
 * قاعدة رؤيةٍ بينهما يعني أن لحظةً خاصة تظهر في أحدهما ولا تظهر في الآخر.
 * تُحذف النسخة القديمة يوم يُطفأ `src/`، لا قبله.
 */

/** الحظر في الاتجاهين: من حظرتَه ومن حظرك كلاهما يختفي عنك. */
export async function blockedWith(userId: string): Promise<string[]> {
  const rows = await prisma.block.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
  });
  return rows.map((row) => (row.blockerId === userId ? row.blockedId : row.blockerId));
}

/** معرّفات الدائرة (المقبولون)، بلا صاحبها. */
export async function circleIds(userId: string): Promise<string[]> {
  // المتابِعُ ليس من دائرة من يتابعه (القاعدة ٢٦٣): صفُّ المتابعة يُقرأ من جهة
  // صاحبه وحده — يرى به الحسابَ المفتوح، ولا يراه الحسابُ المفتوح به.
  const rows = await prisma.friendship.findMany({
    where: {
      status: "ACCEPTED",
      OR: [{ requesterId: userId }, { addresseeId: userId, follow: false }],
    },
    select: { requesterId: true, addresseeId: true },
  });
  return rows.map((row) => (row.requesterId === userId ? row.addresseeId : row.requesterId));
}

/**
 * من يتابع الحسابَ المفتوح يُقرأ عنده (القاعدتان ٢٧٨ و٢٧٩) — بقرار المالك:
 * المتابعةُ لا تأخذ خانةً ولا تجعله صديقاً (القاعدة ٢٦٣)، لكنّ ما يكتبه
 * المتابِعُ لدائرته — لحظاتٍ وقصصاً ونوت — يصل إلى الإدارة التي أضافها.
 */
async function followerIds(userId: string): Promise<string[]> {
  const rows = await prisma.friendship.findMany({
    where: { status: "ACCEPTED", follow: true, addresseeId: userId },
    select: { requesterId: true },
  });
  return rows.map((row) => row.requesterId);
}

/** من تراه لحظاتُهم وقصصُهم ونوتُهم: دائرتك ومتابِعوك ناقص المحظورين، ومعك أنت. */
export async function visibleAuthors(userId: string): Promise<string[]> {
  const [ids, followers, blocked] = await Promise.all([
    circleIds(userId),
    followerIds(userId),
    blockedWith(userId),
  ]);
  const hidden = new Set(blocked);
  return [...new Set([...ids, ...followers])].filter((id) => !hidden.has(id)).concat(userId);
}

/**
 * شرط رؤية اللحظة: كاتبها ممّن ترى، وجمهورها يشملك.
 *
 * ويُدمج في **كل** استعلام لحظات — لا في الأول وحده. استعلامٌ ينسى هذا
 * الشرط يسرّب لحظةً خاصة بلا رسالة خطأ تُنبّه.
 */
export async function visibleWhere(userId: string) {
  const authors = await visibleAuthors(userId);

  return {
    authorId: { in: authors },
    OR: [
      { authorId: userId },
      { audience: "CIRCLE" as const },
      { audience: "GROUP" as const, audienceGroup: { members: { some: { userId } } } },
      { audience: "PICKED" as const, viewers: { some: { userId } } },
      // الكلُّ ما عدا تصنيفاً: من ليس فيه. وتصنيفٌ حُذف لا يفتحها لأحد (القاعدة ٢٥٥).
      { audience: "EXCEPT" as const, audienceGroup: { members: { none: { userId } } } },
    ],
  };
}

export async function canSeeMoment(userId: string, momentId: string): Promise<boolean> {
  const found = await prisma.moment.findFirst({
    where: { id: momentId, ...(await visibleWhere(userId)) },
    select: { id: true },
  });
  return Boolean(found);
}

/** التفاعل قد يُحصر في تصنيفٍ من الدائرة — «من يمكنه التفاعل معك». */
export async function canInteract(userId: string, authorId: string): Promise<boolean> {
  if (userId === authorId) return true;

  const author = await prisma.user.findUnique({
    where: { id: authorId },
    select: { interactGroupId: true },
  });
  if (!author?.interactGroupId) return true;

  const member = await prisma.groupMember.findFirst({
    where: { groupId: author.interactGroupId, userId },
    select: { id: true },
  });
  return Boolean(member);
}

/**
 * من يرى هذا الملف.
 *
 * معرّف الملف ليس سرّاً: من يحصل عليه — من لقطة شاشة، أو من سجلّ وسيط،
 * أو بتخمينٍ في فضاءٍ ليس عشوائياً تماماً — كان يقرأ به أيّ صورةٍ في
 * القاعدة ما دام مسجّلاً دخوله، ولو كانت صورةَ لحظةٍ خاصة أو رسالةً بين
 * اثنين. فالصلاحية تُفحص هنا كما تُفحص في كل استعلام لحظات (القاعدة ٢٣)،
 * لا يُكتفى بأن الرابط طويل.
 *
 * والفحص من جهة ما عُلِّق عليه الملف: صاحبه يراه دائماً، وصنف المتجر
 * للجميع، والصورة والغلاف لمن لا يحجبه حظر، واللحظة بقواعد جمهورها،
 * والقصة لدائرة صاحبها ما لم تنتهِ، والرسالة لطرفَي محادثتها.
 */
export async function canSeeMedia(userId: string, mediaId: string): Promise<boolean> {
  const media = await prisma.media.findUnique({
    where: { id: mediaId },
    select: {
      ownerId: true,
      storeItem: { select: { id: true } },
      // صورةُ بطاقة الإعلان للجميع كصورة الصنف (القاعدة ٢٧٢).
      storePromo: { select: { id: true } },
      // وغلافُ الثيم كذلك: يُرسم خلف غلاف لابسه لكلّ من يرى ملفّه (القاعدة ٢٨٨).
      storeCover: { select: { id: true } },
      storeHallWall: { select: { id: true } },
      storeHallFloor: { select: { id: true } },
      storeHallFrame: { select: { id: true } },
      sticker: { select: { id: true } },
      avatarOf: { select: { id: true } },
      coverOf: { select: { id: true } },
      moment: { select: { id: true } },
      // والصورُ بعد الأولى بقواعد لحظتها (القاعدة ٣٤٣).
      momentPhoto: { select: { momentId: true } },
      storyOf: {
        select: {
          authorId: true,
          expiresAt: true,
          private: true,
          audience: { where: { userId }, select: { userId: true } },
        },
      },
      // صوتُ القصّة بقواعد قصّته نفسها (القاعدة ٢٣٨).
      storyAudio: {
        select: {
          authorId: true,
          expiresAt: true,
          private: true,
          audience: { where: { userId }, select: { userId: true } },
        },
      },
      messageOf: { select: { conversation: { select: { aId: true, bId: true } } } },
      groupMessageOf: { select: { groupId: true, createdAt: true } },
      groupPhotoOf: { select: { id: true } },
    },
  });
  if (!media) return false;
  if (media.ownerId === userId) return true;
  // والملصقُ للجميع كصورة الصنف (القاعدة ٢٩١).
  if (media.storeItem || media.storePromo || media.storeCover || media.storeHallWall || media.storeHallFloor || media.storeHallFrame || media.sticker) return true;

  if (media.messageOf) {
    const { aId, bId } = media.messageOf.conversation;
    return aId === userId || bId === userId;
  }

  // صورةُ المجموعة لأعضائها وحدهم (القاعدة ٢١٥).
  const groupId = media.groupMessageOf?.groupId ?? media.groupPhotoOf?.id;
  if (groupId) {
    const seat = await prisma.chatGroupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
      select: { joinedAt: true },
    });
    if (!seat) return false;
    // صورةُ رسالةٍ قبل انضمامه ليست له كالرسالة نفسها (القاعدة ٢٤٢).
    return !media.groupMessageOf || media.groupMessageOf.createdAt >= seat.joinedAt;
  }

  if (media.moment) return canSeeMoment(userId, media.moment.id);
  if (media.momentPhoto) return canSeeMoment(userId, media.momentPhoto.momentId);

  const story = media.storyOf ?? media.storyAudio;
  if (story) {
    if (story.expiresAt <= new Date()) return false;
    // الخاصّةُ لمن خُصّت بهم وحدهم (القاعدة ٢١٩) — والصاحبُ رُدّ بالمالك فوق.
    if (story.private && story.audience.length === 0) return false;
    // ومتابِعُ الحساب المفتوح كصديقه هنا (القاعدة ٢٧٩).
    const circle = await visibleAuthors(userId);
    return circle.includes(story.authorId);
  }

  // صورة العرض والغلاف يراهما كل من يرى بطاقة صاحبهما — والحظر يحجبهما.
  const profileOf = media.avatarOf?.id ?? media.coverOf?.id;
  if (profileOf) {
    const blocked = await blockedWith(userId);
    return !blocked.includes(profileOf);
  }

  // ملفٌّ لم يُعلَّق بعد على شيء: لصاحبه وحده.
  return false;
}
