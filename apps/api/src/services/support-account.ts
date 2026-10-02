import { prisma } from "@athar/db";

/**
 * حسابُ الدعم والأخبار (القاعدة ٢٢١): رقمُ عضويّته من لوحة الموقع
 * («support.member» في `SiteText`) لا من الكود — رقمُ اليوم قد يصير غيرَه
 * (القاعدة ٣٢ب). وبلا صفٍّ فالرقمُ ١، والأرقامُ العربيّة تُحوَّل.
 */
export async function supportAccount() {
  const row = await prisma.siteText.findUnique({ where: { key: "support.member" } }).catch(() => null);
  const digits = (row?.value ?? "1").replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).trim();
  const memberNo = /^\d{1,9}$/.test(digits) ? Number(digits) : 1;
  return prisma.user.findUnique({
    where: { memberNo },
    select: { id: true, memberNo: true, name: true, isOpen: true },
  });
}
