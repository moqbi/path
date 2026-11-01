import { prisma } from "@athar/db";

/**
 * «من يراسلني على الخاص» (القاعدة ٣٨٥): الخاصُّ مطفأٌ لا يصله أحد، ومفتوحٌ للدائرة كلّها أو
 * لتصنيفٍ بعينه. يُفحص في فتح المحادثة وفي كلّ إرسال — المحادثةُ القائمة لا تبقى باباً بعد
 * الإقفال — والمشرفُ يبدأ مع أيّ حساب (القاعدة ٣١٧) فلا يُقفل في وجهه.
 *
 * والجوابُ رسالةٌ تُقرأ للمرسل لا «غير موجود»: من يُردّ يعرف أنّ صاحبه أقفل الخاصّ لا أنّ
 * شيئاً تعطّل. ونسختُه في الويب `src/lib/dm-privacy.ts` حرفاً بحرف.
 */
export async function dmClosedReason(senderId: string, recipientId: string): Promise<string | null> {
  const [to, sender] = await Promise.all([
    prisma.user.findUnique({ where: { id: recipientId }, select: { name: true, dmOpen: true, dmGroupId: true } }),
    prisma.user.findUnique({ where: { id: senderId }, select: { role: true, adminScope: true } }),
  ]);
  if (!to) return null;
  if (sender?.role === "ADMIN" || sender?.adminScope === "ALL") return null;
  if (!to.dmOpen) return `${to.name} مقفل الخاص — لا يستقبل الرسائل الخاصة`;
  if (!to.dmGroupId) return null;
  // تصنيفُ صاحب الخاصّ نفسه، ومن فيه وحده. وتصنيفٌ حُذف لا يُطابق أحداً.
  const member = await prisma.groupMember.count({
    where: { userId: senderId, groupId: to.dmGroupId, group: { ownerId: recipientId } },
  });
  return member ? null : `${to.name} مقفل الخاص — لا يستقبل الرسائل الخاصة`;
}
