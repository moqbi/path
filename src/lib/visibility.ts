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

/** من تراه لحظاتُهم: دائرتك ناقص المحظورين، ومعك أنت. */
export async function visibleAuthors(userId: string): Promise<string[]> {
  const [ids, blocked] = await Promise.all([circleIds(userId), blockedWith(userId)]);
  const hidden = new Set(blocked);
  return [...ids.filter((id) => !hidden.has(id)), userId];
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

  const profileOf = media.avatarOf?.id ?? media.coverOf?.id;
  if (profileOf) {
    const blocked = await blockedWith(userId);
    return !blocked.includes(profileOf);
  }

  return false;
}
