import { prisma } from "@athar/db";
import { cloudReady, deleteObjects, getObject, putObject } from "@athar/storage";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { processImage, squareCrop, videoPoster } from "../lib/process";

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

/**
 * غلافُ مقطع اللحظة (القاعدة ٤٣٤): إطارٌ منه مربّعٌ كصورة اللحظة (القاعدة ٣٦٤)،
 * ملفٌّ مستقلٌّ لصاحبه يُكتب `Moment.mediaId`. والفشلُ `null` — لحظةٌ بمقطعٍ بلا
 * غلاف خيرٌ من مقطعٍ لا يُنشر، والسطرُ في السجلّ يقول السبب.
 */
export async function posterFor(ownerId: string, videoId: string, full = false): Promise<string | null> {
  try {
    const video = await prisma.media.findUnique({ where: { id: videoId }, select: { key: true, bytes: true } });
    if (!video) return null;
    let input: Uint8Array;
    if (video.key) {
      if (!cloudReady()) return null;
      const answer = await getObject(video.key);
      if (!answer.ok) return null;
      input = new Uint8Array(await answer.arrayBuffer());
    } else if (video.bytes) input = video.bytes;
    else return null;

    const frame = await videoPoster(input, "mp4");
    // ولحظةُ آثار+ غلافُها بنسبة مقطعها لا مربّعاً (القاعدة ٤٧٤).
    const out = full ? await processImage(frame, "image/jpeg", { side: 2048, quality: 88 }) : await squareCrop(frame, 50, 50);
    if (cloudReady()) {
      const key = `${ownerId}/${randomUUID()}.${EXT[out.mime] ?? "bin"}`;
      await putObject(key, out.bytes, out.mime);
      const row = await prisma.media.create({
        data: { ownerId, mime: out.mime, key, width: out.width, height: out.height, ready: true, purpose: "MOMENT" },
        select: { id: true },
      });
      return row.id;
    }
    const row = await prisma.media.create({
      data: { ownerId, mime: out.mime, bytes: Buffer.from(out.bytes), width: out.width, height: out.height, ready: true, purpose: "MOMENT" },
      select: { id: true },
    });
    return row.id;
  } catch (problem) {
    console.error("[moments] تعذّر صنعُ غلاف المقطع", videoId, problem);
    return null;
  }
}
