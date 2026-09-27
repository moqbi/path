import { prisma } from "@athar/db";
import { broadcast } from "./push";

/**
 * «جديدٌ في المتجر» تنبيهاً على الجهاز.
 *
 * كان الخبرُ يُشتقّ في تبويب الإشعارات وحده (القاعدة ٢٥) ولا يخرج جرسٌ
 * به: الصنفُ يُضاف من اللوحة — وهي مشروعٌ آخر لا يحمل خدمة التنبيهات —
 * فلا أحد يعلم أنّ شيئاً وصل حتى يفتح التبويب بنفسه، ومفتاحُ «جديد
 * المتجر» في الإعدادات يحرس جرساً لا يقرعه أحد.
 *
 * فهنا كنسٌ يلتقط كلَّ صنفٍ ظاهرٍ لم يُعلَن بعد، ويختمه **قبل** الإرسال
 * بشرط «لم يُختم» (`updateMany`): خادمان أو كنسان معاً لا يُعلنان الصنف
 * مرّتين. وما التُقط في الكنسة نفسها تنبيهٌ واحد لا عدّةُ تنبيهات —
 * عشرُ أصنافٍ تُرفع معاً عشرُ رنّاتٍ متتالية على كل جهاز.
 *
 * والخبيئةُ التي كانت تقرأ من «آخر ثلاثة أيام» باقيةٌ كما هي: التبويبُ
 * سجلّ، وهذا جرس.
 */
export async function announceStore(): Promise<number> {
  const fresh = await prisma.storeItem.findMany({
    where: { hidden: false, announcedAt: null },
    select: { id: true, name: true, limited: true },
    orderBy: { createdAt: "asc" },
    take: 20,
  });
  if (fresh.length === 0) return 0;

  const claimed = await prisma.storeItem.updateMany({
    where: { id: { in: fresh.map((item) => item.id) }, announcedAt: null },
    data: { announcedAt: new Date() },
  });
  if (claimed.count === 0) return 0;

  const [first] = fresh;
  const body =
    fresh.length === 1
      ? first.limited
        ? `${first.name} — لفترة محدودة`
        : `${first.name} وصل المتجر`
      : `${first.name} و${fresh.length - 1 === 1 ? "صنفٌ آخر" : `${fresh.length - 1} أصناف أخرى`} وصلت المتجر`;

  return broadcast("STORE", "جديد في المتجر", body, "/store");
}
