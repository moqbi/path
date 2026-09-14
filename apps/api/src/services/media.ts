import { prisma } from "@athar/db";
import { deleteObjects } from "@athar/storage";

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
