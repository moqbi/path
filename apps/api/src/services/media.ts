import { prisma } from "@athar/db";
import { cloudReady, deleteObjects, getObject, putObject } from "@athar/storage";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { squareCrop } from "../lib/process";

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
 * يقصّ صورةَ اللحظة مربّعاً بموضعها ويكتبها فوق الأصل (القاعدة ٣٦٤): الملفُّ
 * المنشور هو ما ضبطه صاحبُه، ولا يبقى في الدلو غيرُه. المتحرّكةُ تُترك كما هي
 * (القاعدة ٨٢)، والفشلُ يردّ `false` فتبقى الصورةُ كاملةً بموضعها ولا يسقط النشر.
 */
export async function squareMomentPhoto(id: string, x: number, y: number): Promise<boolean> {
  const media = await prisma.media.findUnique({
    where: { id },
    select: { mime: true, key: true, bytes: true },
  });
  if (!media || media.mime === "image/gif" || !media.mime.startsWith("image/")) return false;
  try {
    let input: Uint8Array;
    if (media.key) {
      if (!cloudReady()) return false;
      const answer = await getObject(media.key);
      if (!answer.ok) return false;
      input = new Uint8Array(await answer.arrayBuffer());
    } else if (media.bytes) {
      input = media.bytes;
    } else return false;

    const meta = await sharp(Buffer.from(input), { animated: true }).metadata();
    if ((meta.pages ?? 1) > 1) return false;

    const out = await squareCrop(input, x, y);
    if (media.key) {
      await putObject(media.key, out.bytes, out.mime);
      await prisma.media.update({ where: { id }, data: { mime: out.mime, width: out.width, height: out.height } });
    } else {
      await prisma.media.update({
        where: { id },
        data: { mime: out.mime, bytes: Buffer.from(out.bytes), width: out.width, height: out.height },
      });
    }
    return true;
  } catch (problem) {
    console.error("[moments] تعذّر قصّ الصورة مربّعاً", id, problem);
    return false;
  }
}
