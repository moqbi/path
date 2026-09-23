import { prisma } from "@athar/db";
import { cloudReady, deleteObjects, getObject, putObject } from "@athar/storage";
import { randomUUID } from "node:crypto";

/**
 * حذفٌ لا يُبقي أثراً.
 *
 * الصفّ يذهب من القاعدة والكائن يذهب من الدلو معاً: حذفُ أحدهما وحده
 * يترك بكسلاتٍ تعيش بعد صاحبها. والترتيب مقصود — الصفّ أولاً كي لا
 * يشير معرّفٌ إلى ملفٍّ لم يعد موجوداً لو انقطع ما بينهما.
 */
export async function dropMedia(ids: string[]): Promise<void> {
  if (ids.length === 0) return;

  const rows = await prisma.media.findMany({
    where: { id: { in: ids } },
    select: { id: true, key: true },
  });
  if (rows.length === 0) return;

  await prisma.media.deleteMany({ where: { id: { in: rows.map((row) => row.id) } } });
  await deleteObjects(rows.map((row) => row.key).filter((key): key is string => !!key));
}


/** امتدادٌ يُشتقّ من النوع — ليُقرأ المفتاح في لوحة السحابة. */
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/**
 * ينسخ ملفاً إلى صاحبٍ آخر.
 *
 * ولماذا نسخةٌ لا إشارةٌ إلى الأصل: `User.coverMediaId` فريد، فلو لبس
 * اثنان غلافَ الثيم نفسه لاصطدما على القيد — ولانتُزع الملفُّ من صنف
 * المتجر نفسه. والنسخة تجعل غلافه ملكَه: يغيّره أو يحذفه بلا أن يمسّ
 * الصنف. ونسخةُ الويب في `src/lib/media.ts` مثلُها.
 */
export async function copyMedia(
  sourceId: string,
  toOwnerId: string,
): Promise<{ id: string } | null> {
  const source = await prisma.media.findUnique({
    where: { id: sourceId },
    select: { mime: true, width: true, height: true, key: true, bytes: true },
  });
  if (!source) return null;

  if (source.key) {
    if (!cloudReady()) return null;
    const answer = await getObject(source.key);
    if (!answer.ok) return null;
    const bytes = new Uint8Array(await answer.arrayBuffer());
    const key = `${toOwnerId}/${randomUUID()}.${EXT[source.mime] ?? "bin"}`;
    await putObject(key, bytes, source.mime);
    return prisma.media.create({
      data: {
        ownerId: toOwnerId,
        mime: source.mime,
        key,
        width: source.width,
        height: source.height,
      },
      select: { id: true },
    });
  }

  if (!source.bytes) return null;
  return prisma.media.create({
    data: {
      ownerId: toOwnerId,
      mime: source.mime,
      bytes: source.bytes,
      width: source.width,
      height: source.height,
    },
    select: { id: true },
  });
}

/**
 * غلافُ الثيم يُلبَس عند شرائه.
 *
 * الثيم مزاجٌ كامل — ألوانُه وصورتُه — وغلافٌ لا يشبهه يكسره. فمن
 * اشتراه وجد غلافه معه، وله أن يغيّره بعدها: نسخةٌ يملكها لا قفلٌ عليه.
 *
 * والفشل يُبتلع: شراءٌ يُلغى لأنّ صورةً لم تُنسخ خسارةٌ لا مقابل لها.
 */
export async function wearItemCover(
  coverMediaId: string | null,
  userId: string,
): Promise<void> {
  if (!coverMediaId) return;
  try {
    const copy = await copyMedia(coverMediaId, userId);
    if (!copy) return;
    const old = await prisma.user.findUnique({
      where: { id: userId },
      select: { coverMediaId: true },
    });
    await prisma.user.update({
      where: { id: userId },
      data: { coverMediaId: copy.id, coverY: 50, coverX: 50, coverZoom: 100 },
    });
    if (old?.coverMediaId) await dropMedia([old.coverMediaId]);
  } catch {
    // غلافٌ لم يُلبَس لا يُبطل شراءً تمّ.
  }
}
