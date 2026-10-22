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

/**
 * مجموعةُ ملصقاتٍ جديدة: جرسٌ وبطاقةُ إعلانٍ عند الفتح (القاعدة ٣٣٥) — **بقرار المالك**.
 *
 * تُعلَن حين تصير ظاهرةً **وفيها ملصق**: المجموعةُ تُنشأ في اللوحة ثمّ تُرفع ملصقاتُها،
 * فإعلانُها ساعةَ الإنشاء يقرع لشيءٍ فارغ. والختمُ قبل الإرسال كالأصناف، ومعه
 * `promoAt` فتظهر البطاقةُ لمن لم يرَ ما بعده.
 *
 * والملصقاتُ في نسخة التطوير وحدها (القاعدة ٢٩١)، فالجرسُ خلف `STICKER_BELL` كجرس
 * المناسبات (القاعدة ٢٩٢): `staff` افتراضاً — المالكُ وممنوحو اللوحة — و`all` للجميع
 * يومَ تُبنى، و`off` لا أحد. وجرسٌ عن ميزةٍ لا يراها صاحبُ الجهاز وعدٌ لا يُوفى.
 */
export async function announcePacks(): Promise<number> {
  const fresh = await prisma.stickerPack.findMany({
    where: { hidden: false, announcedAt: null, stickers: { some: {} } },
    select: { id: true, name: true, priceCoins: true },
    orderBy: { createdAt: "asc" },
    take: 20,
  });
  if (fresh.length === 0) return 0;

  const now = new Date();
  const claimed = await prisma.stickerPack.updateMany({
    where: { id: { in: fresh.map((pack) => pack.id) }, announcedAt: null },
    data: { announcedAt: now, promoAt: now },
  });
  if (claimed.count === 0) return 0;

  const mode = process.env.STICKER_BELL ?? "staff";
  if (mode === "off") return 0;
  const only = mode === "all" ? undefined : { OR: [{ role: "ADMIN" }, { adminScope: "ALL" }] };

  const first = fresh[fresh.length - 1];
  const body =
    fresh.length === 1
      ? first.priceCoins > 0
        ? `مجموعة «${first.name}» وصلت المتجر`
        : `مجموعة «${first.name}» — حصرياً لمشتركي آثار+`
      : `«${first.name}» و${fresh.length - 1 === 1 ? "مجموعةٌ أخرى" : `${fresh.length - 1} مجموعات أخرى`} وصلت المتجر`;

  return broadcast("STORE", "ملصقات جديدة", body, `/store?pack=${first.id}`, only);
}
