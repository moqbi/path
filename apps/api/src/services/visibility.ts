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
  const rows = await prisma.friendship.findMany({
    where: { status: "ACCEPTED", OR: [{ requesterId: userId }, { addresseeId: userId }] },
    select: { requesterId: true, addresseeId: true },
  });
  return rows.map((row) => (row.requesterId === userId ? row.addresseeId : row.requesterId));
}

/** من تراه لحظاتُهم: دائرتك ناقص المحظورين، ومعك أنت. */
export async function visibleAuthors(userId: string): Promise<string[]> {
  const [ids, blocked] = await Promise.all([circleIds(userId), blockedWith(userId)]);
  const hidden = new Set(blocked);
  return [...ids.filter((id) => !hidden.has(id)), userId];
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
      avatarOf: { select: { id: true } },
      coverOf: { select: { id: true } },
      moment: { select: { id: true } },
      storyOf: { select: { authorId: true, expiresAt: true } },
      messageOf: { select: { conversation: { select: { aId: true, bId: true } } } },
    },
  });
  if (!media) return false;
  if (media.ownerId === userId) return true;
  if (media.storeItem) return true;

  if (media.messageOf) {
    const { aId, bId } = media.messageOf.conversation;
    return aId === userId || bId === userId;
  }

  if (media.moment) return canSeeMoment(userId, media.moment.id);

  if (media.storyOf) {
    if (media.storyOf.expiresAt <= new Date()) return false;
    const circle = await circleIds(userId);
    return circle.includes(media.storyOf.authorId);
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
