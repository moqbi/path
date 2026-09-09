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
