import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { circleIds } from "@/lib/circle";

/**
 * الحظر يعمل في الاتجاهين: من حظرتَه ومن حظرك كلاهما يختفي عنك.
 * حظرٌ من طرف واحد يترك المحظور يقرأ ويعلّق، وهذا ليس حظراً.
 */
export const blockedWith = cache(async (userId: string): Promise<string[]> => {
  const rows = await prisma.block.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
  });
  return rows.map((row) => (row.blockerId === userId ? row.blockedId : row.blockerId));
});

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
 * شرط رؤية اللحظة: كاتبها في دائرتك، وجمهورها يشملك.
 * لحظاتك أنت تُرى كلها مهما كان جمهورها — أنت من اختاره.
 */
export async function visibleWhere(userId: string) {
  const authors = await visibleAuthors(userId);

  return {
    authorId: { in: authors },
    OR: [
      { authorId: userId },
      { audience: "CIRCLE" as const },
      {
        audience: "GROUP" as const,
        audienceGroup: { members: { some: { userId } } },
      },
      { audience: "PICKED" as const, viewers: { some: { userId } } },
      // الكلُّ ما عدا تصنيفاً: من ليس فيه. وتصنيفٌ حُذف لا يفتحها لأحد (القاعدة ٢٥٥).
      { audience: "EXCEPT" as const, audienceGroup: { members: { none: { userId } } } },
    ],
  };
}

/** هل يرى فلانٌ هذه اللحظة؟ نفس الشرط أعلاه لصفٍّ واحد. */
export async function canSeeMoment(userId: string, momentId: string): Promise<boolean> {
  const where = await visibleWhere(userId);
  const found = await prisma.moment.findFirst({ where: { id: momentId, ...where }, select: { id: true } });
  return Boolean(found);
}

/**
 * هل يستطيع فلانٌ التفاعل مع لحظة صاحبها؟
 * صاحب اللحظة قد يحصر التفاعل في تصنيف من دائرته — «من يمكنه التفاعل معك».
 */
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
 * منقولةٌ حرفاً من `apps/api/src/services/visibility.ts`: معرّف الملف
 * ليس صلاحية، ومن يحصل عليه كان يقرأ به أيّ صورةٍ في القاعدة — صورةَ
 * لحظةٍ خاصة أو رسالةً بين اثنين — بلا حساب أصلاً.
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
      avatarOf: { select: { id: true } },
      coverOf: { select: { id: true } },
      moment: { select: { id: true } },
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
  if (media.storeItem || media.storePromo || media.storeCover) return true;

  if (media.messageOf) {
    const { aId, bId } = media.messageOf.conversation;
    return aId === userId || bId === userId;
  }

  // صورةُ المجموعة ورسائلُها لأعضائها وحدهم (القاعدة ٢١٥) — نسخةُ الخادم حرفاً بحرف.
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

  const story = media.storyOf ?? media.storyAudio;
  if (story) {
    if (story.expiresAt <= new Date()) return false;
    // الخاصّةُ لمن خُصّت بهم وحدهم (القاعدة ٢١٩) — والصاحبُ رُدّ بالمالك فوق.
    if (story.private && story.audience.length === 0) return false;
    // ومتابِعُ الحساب المفتوح كصديقه هنا (القاعدة ٢٧٩).
    const circle = await visibleAuthors(userId);
    return circle.includes(story.authorId);
  }

  const profileOf = media.avatarOf?.id ?? media.coverOf?.id;
  if (profileOf) {
    const blocked = await blockedWith(userId);
    return !blocked.includes(profileOf);
  }

  return false;
}
