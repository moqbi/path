import "server-only";
import { prisma } from "@/lib/db";
import { circleIds } from "@/lib/circle";
import { supportAccount } from "@/lib/support-account";

/**
 * بطاقةُ الترحيب أعلى اللحظات (القاعدة ٢٤٦) — نسخةُ `apps/api/src/services/welcome.ts` — **بقرار المالك**: الحسابُ الجديد
 * خطُّه فارغ، ومن لا يعرف ما يفعل يُغلق التطبيق. أربعُ خطواتٍ تُشطب وحدها حين
 * تُفعل — **تُقرأ من القاعدة لا تُحفظ**: من وضع صورته شُطبت خطوتُها ولو وضعها
 * من الويب — وتختفي البطاقةُ حين تُشطب كلُّها، أو بعد أسبوعين من التسجيل،
 * أو بـ«×» (على الجهاز).
 */
const DAYS = 14;
// يومُ نشر النسخة ٢٩ — **بقرار المالك** تظهر للجميع لا للجدد وحدهم: الأسبوعان يُعدّان من
// الأبعد بين التسجيل وهذا اليوم، فمن سجّل قبله يراها الآن وتنتهي عنده كما تنتهي عند غيره.
const SHOWN_FROM = new Date("2026-10-07T00:00:00+03:00");

export async function welcome(userId: string) {
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { createdAt: true, avatarMediaId: true, coverMediaId: true, memberNo: true },
  });
  const start = Math.max(me?.createdAt.getTime() ?? 0, SHOWN_FROM.getTime());
  if (!me || Date.now() - start > DAYS * 86_400_000) return { show: false as const };

  const [circle, support, posted] = await Promise.all([
    circleIds(userId),
    supportAccount(),
    prisma.moment.count({
      where: { authorId: userId, kind: { in: ["PHOTO", "PLACE", "THOUGHT", "MUSIC", "SLEEP", "WAKE"] } },
    }),
  ]);
  const own = support && support.id !== userId ? support : null;
  const friends = circle.filter((id) => id !== own?.id).length;

  // صورةٌ وغلافٌ وأوّلُ لحظةٍ وأوّلُ صديق (القاعدة ٣٧٢): حسابُ الإدارة يُتابَع من أوّل يوم.
  const steps = {
    avatar: Boolean(me.avatarMediaId),
    cover: Boolean(me.coverMediaId),
    moment: posted > 0,
    friend: friends > 0,
  };
  // وتختفي بإكمالها — **بقرار المالك**، ونقضاً لما كان من أنّ «٤ من ٤» ترحيبٌ يبقى.
  if (Object.values(steps).every(Boolean)) return { show: false as const };

  return {
    show: true as const,
    memberNo: me.memberNo,
    steps,
  };
}
