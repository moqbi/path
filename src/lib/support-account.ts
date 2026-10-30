import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db";

/**
 * حسابُ الدعم والأخبار (القاعدة ٢٢١): رقمُ عضويّته من لوحة الموقع
 * («support.member» في `SiteText`) لا من الكود (القاعدة ٣٢ب). وبلا صفٍّ
 * فالرقمُ ١ — نسخةُ `apps/api/src/services/support-account.ts`.
 */
export const supportAccount = cache(async () => {
  const row = await prisma.siteText.findUnique({ where: { key: "support.member" } }).catch(() => null);
  const digits = (row?.value ?? "1").replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).trim();
  const memberNo = /^\d{1,9}$/.test(digits) ? Number(digits) : 1;
  return prisma.user.findUnique({
    where: { memberNo },
    select: { id: true, memberNo: true, name: true, isOpen: true },
  });
});

/**
 * كلُّ حسابٍ جديد يتابع حسابَ الإدارة من أوّل يوم (القاعدة ٣٧٢) — **بقرار المالك**:
 * الخطُّ الزمنيّ لا يبدأ فارغاً، وأخبارُ التطبيق فيه قبل أن يأتي الأصدقاء.
 * متابعةٌ لا صداقة (القاعدة ٢٦٣): لا خانةَ من السقف ولا سطرَ «أصبح صديق».
 * ولا يُسقط حساباً قام: فشلُها يُبلع، ومن أراد يضيفه بيده من ملفّه.
 */
export async function followSupport(userId: string): Promise<void> {
  try {
    const support = await supportAccount();
    if (!support || support.id === userId || !support.isOpen) return;
    await prisma.friendship.create({
      data: {
        requesterId: userId,
        addresseeId: support.id,
        status: "ACCEPTED",
        follow: true,
        acceptedAt: new Date(),
      },
    });
  } catch {
    // قيدُ الفرادة (صفٌّ قائم) أو قاعدةٌ متأخّرة — الحسابُ قائمٌ على كلّ حال.
  }
}
