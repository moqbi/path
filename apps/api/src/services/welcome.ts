import { prisma } from "@athar/db";
import { circleIds } from "./visibility";
import { supportAccount } from "./support-account";

/**
 * بطاقةُ الترحيب أعلى اللحظات (القاعدة ٢٤٦) — **بقرار المالك**: الحسابُ الجديد
 * خطُّه فارغ، ومن لا يعرف ما يفعل يُغلق التطبيق. أربعُ خطواتٍ تُشطب وحدها حين
 * تُفعل — **تُقرأ من القاعدة لا تُحفظ**: من وضع صورته شُطبت خطوتُها ولو وضعها
 * من الويب — وتختفي البطاقةُ حين تُشطب كلُّها، أو بعد أسبوعين من التسجيل،
 * أو بـ«×» (على الجهاز).
 */
const DAYS = 14;

export async function welcome(userId: string) {
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { createdAt: true, avatarMediaId: true, memberNo: true },
  });
  if (!me || Date.now() - me.createdAt.getTime() > DAYS * 86_400_000) return { show: false as const };

  const [circle, support, posted] = await Promise.all([
    circleIds(userId),
    supportAccount(),
    prisma.moment.count({
      where: { authorId: userId, kind: { in: ["PHOTO", "PLACE", "THOUGHT", "MUSIC", "SLEEP", "WAKE"] } },
    }),
  ]);
  const own = support && support.id !== userId ? support : null;
  const friends = circle.filter((id) => id !== own?.id).length;

  const steps = {
    avatar: Boolean(me.avatarMediaId),
    friend: friends > 0,
    moment: posted > 0,
    // حسابُ الإدارة (القاعدة ٢٢١): أخبارُ التطبيق تملأ الخطّ قبل أن يأتي الأصدقاء.
    support: own ? circle.includes(own.id) : true,
  };
  if (Object.values(steps).every(Boolean)) return { show: false as const };

  return {
    show: true as const,
    memberNo: me.memberNo,
    supportId: own?.id ?? null,
    supportName: own?.name ?? null,
    steps,
  };
}
