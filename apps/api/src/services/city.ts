import { prisma } from "@athar/db";

/** لحظتا وصولٍ بينهما أقلّ من هذا تُعدّان ارتجافاً على حدود مدينة لا سفراً. */
const SETTLE_MS = 30 * 60_000;

/**
 * «وصل إلى الرياض» — مرّةً لكل وصولٍ حقيقيّ لا مع كل فتح.
 *
 * ثلاثُ علل كانت تكتبها مراراً:
 * - **المقارنةُ بـ`city`**: وهي ما يكتبه صاحبُ الحساب بيده أحياناً، فمن كتب
 *   «الرياض» والجهازُ يقرأ «Riyadh» أو «منطقة الرياض» كُتبت له لحظةٌ مع كل
 *   دخول، وعادت مدينتُه إلى ما قرأه الجهاز. فالمقارنةُ بـ`lastCity` — ما
 *   قرأه الجهاز آخرَ مرّة — و`city` لا يُمسّ إن كان صاحبُه كتبه
 *   (`cityLocked`).
 * - **أوّلُ قراءةٍ لحسابٍ جديد ليست وصولاً**: من سجّل للتوّ لم يصل إلى
 *   مدينته، فالقراءةُ الأولى تُحفظ بلا لحظة.
 * - **الحدود**: المحوّلُ يردّ المدينةَ مرّةً والمنطقةَ مرّةً على أطرافها،
 *   فلا تُكتب لحظةٌ إن كانت آخرُ لحظة وصولٍ للمدينة نفسها، أو كُتبت
 *   واحدةٌ قبل نصف ساعة.
 *
 * والتبديلُ شرطيٌّ في القاعدة (`updateMany`): طلبان في اللحظة نفسها لا
 * يكتبان لحظتين.
 */
export async function recordCity(userId: string, city: string | null): Promise<boolean> {
  if (!city) return false;

  return prisma.$transaction(async (tx) => {
    const before = await tx.user.findUnique({ where: { id: userId }, select: { lastCity: true } });
    if (!before) return false;

    const changed = await tx.user.updateMany({
      where: { id: userId, OR: [{ lastCity: null }, { lastCity: { not: city } }] },
      data: { lastCity: city },
    });
    if (changed.count === 0) return false;

    // المدينةُ في الملف تتبع الجهاز ما لم يكتبها صاحبُها بيده.
    await tx.user.updateMany({ where: { id: userId, cityLocked: false }, data: { city } });

    if (before.lastCity === null) return false;

    const last = await tx.moment.findFirst({
      where: { authorId: userId, kind: "CITY" },
      orderBy: { createdAt: "desc" },
      select: { text: true, createdAt: true },
    });
    if (last && (last.text === city || Date.now() - last.createdAt.getTime() < SETTLE_MS)) {
      return false;
    }

    await tx.moment.create({ data: { authorId: userId, kind: "CITY", text: city } });
    return true;
  });
}
