import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { cloudReady, deleteObjects, getObject, putObject } from "@/lib/storage";

/** أقصى حجم مقبول بعد تصغير المتصفح — حارس ضد رفع ملف ضخم يدوياً. */
const MAX_BYTES = 1_500_000;
/** المتحرّكة تُرفع بملفها بلا تصغير، فحدُّها أعلى — ونفس ما يُقال للمستخدم. */
const MAX_ANIMATED_BYTES = 3_000_000;
/** ٣٢٠ لا ١٠٢٤: تُرفع بملفها بلا تصغير، وأكبرُ ما تُعرض فيه ١٠٤ بكسلاً. */
const MAX_ANIMATED_SIDE = 320;
const MIN_ANIMATED_SIDE = 120;
/** الصوت مسجَّلٌ في المتصفح بجودةٍ منخفضة: دقيقتان فيه أقلّ من ميغا. */
const MAX_AUDIO_BYTES = 2_000_000;
/** الفيديو عشرون ثانية بمعدّل بتّ محدود — وما زاد يُردّ برسالة لا بصمت. */
const MAX_VIDEO_BYTES = 9_000_000;

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
/** صيغ التسجيل التي تخرج من `MediaRecorder` على المتصفحات المختلفة. */
const AUDIO = new Set(["audio/webm", "audio/mp4", "audio/ogg", "audio/mpeg", "audio/aac"]);
const VIDEO = new Set(["video/webm", "video/mp4", "video/quicktime"]);

/** `audio/webm;codecs=opus` ← `audio/webm`: الوسائط تُقدَّم بنوعها الأساسي. */
export function baseMime(mime: string): string {
  return mime.split(";")[0].trim().toLowerCase();
}

/**
 * أمتحرّكةٌ هي؟ يُقرأ من الملف لا من امتداده.
 *
 * GIF متحرّكة إن حملت أكثر من كتلة صورة (`,` بعد الرأس)، وWebP متحرّكة
 * إن حملت كتلة `ANIM`. والفحص على الخادم لأن الميزة مدفوعة: امتدادٌ
 * يُكتب في العميل ليس قيداً.
 */
export function isAnimated(mime: string, bytes: Uint8Array<ArrayBuffer>): boolean {
  if (mime === "image/gif") {
    // كتلة «التحكّم بالرسم» (21 F9 04) تسبق كل إطار: اثنتان تعني حركة.
    let frames = 0;
    for (let i = 0; i < bytes.length - 2 && frames < 2; i++) {
      if (bytes[i] === 0x21 && bytes[i + 1] === 0xf9 && bytes[i + 2] === 0x04) frames++;
    }
    return frames >= 2;
  }
  if (mime === "image/webp") return Buffer.from(bytes.subarray(0, 64)).includes("ANIM");
  return false;
}

/**
 * يخزّن صورةً وصلت ملفاً في نموذج.
 *
 * الملف لا النصّ: الصورة كانت تُرسل data URL في وسيط الإجراء، فيكبر حجمها
 * الثلث بترميز base64 ويقطعها حدّان — حدُّ جسد الطلب، وحدُّ «الفتحات» في
 * وسائط الإجراءات (مليون، وهو أقلّ من طول نصّ صورةٍ متوسطة). أمّا ملفٌ في
 * `FormData` فيمرّ جزءاً مستقلاً بلا ترميز ولا عدٍّ.
 *
 * والتحقق يعاد هنا ولا يُكتفى بتصغير العميل: إجراءات الخادم تُستدعى مباشرة
 * بـPOST، فما يحدّه المتصفح ليس قيداً.
 */
export async function storeUpload(
  ownerId: string,
  file: File | Blob,
  width: number,
  height: number,
  allowAnimated = false,
) {
  const mime = baseMime(file.type);
  if (!ALLOWED.has(mime)) throw new Error("يُقبل JPEG أو PNG أو WebP فقط");
  const bytes = new Uint8Array(await file.arrayBuffer());
  return keep(ownerId, mime, bytes, width, height, allowAnimated);
}

/**
 * صوتٌ أو فيديو.
 *
 * لا تصغير هنا: الصوت يخرج من المسجّل بجودةٍ منخفضة أصلاً، والفيديو
 * لا يُعاد ترميزه في المتصفح — فالحدّ حجمٌ يُردّ برسالة، لا صمت.
 */
export async function storeClip(
  ownerId: string,
  file: File | Blob,
  kind: "audio" | "video",
  width = 0,
  height = 0,
) {
  const mime = baseMime(file.type);
  const allowed = kind === "audio" ? AUDIO : VIDEO;
  if (!allowed.has(mime)) {
    throw new Error(kind === "audio" ? "صيغة الصوت غير مدعومة" : "صيغة الفيديو غير مدعومة");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length === 0) throw new Error("الملف فارغ");
  const cap = kind === "audio" ? MAX_AUDIO_BYTES : MAX_VIDEO_BYTES;
  if (bytes.length > cap) {
    throw new Error(
      kind === "audio" ? "التسجيل كبير" : "الفيديو كبير — صوّره أقصر أو بجودة أقل",
    );
  }

  return write(ownerId, mime, bytes, Math.max(0, Math.round(width)), Math.max(0, Math.round(height)));
}

/** الفحص والحفظ في مكان واحد. */
async function keep(
  ownerId: string,
  mime: string,
  bytes: Uint8Array<ArrayBuffer>,
  width: number,
  height: number,
  allowAnimated: boolean,
) {
  if (bytes.length === 0) throw new Error("الملف فارغ");

  const moving = isAnimated(mime, bytes);
  if (moving && !allowAnimated) throw new Error("الصورة المتحركة لمشتركي آثار+");
  if (!moving && mime === "image/gif") throw new Error("يُقبل JPEG أو PNG أو WebP فقط");
  const cap = moving ? MAX_ANIMATED_BYTES : MAX_BYTES;
  if (bytes.length > cap) throw new Error("الصورة كبيرة — صغّرها وأعد المحاولة");
  if (moving && Math.max(width, height) > MAX_ANIMATED_SIDE) {
    throw new Error("مقاس الصورة المتحركة أكبر من ٣٢٠×٣٢٠");
  }
  if (moving && Math.min(width, height) < MIN_ANIMATED_SIDE) {
    throw new Error("مقاس الصورة المتحركة أقلّ من ١٢٠×١٢٠");
  }

  return write(ownerId, mime, bytes, Math.max(1, Math.round(width)), Math.max(1, Math.round(height)));
}

/** امتدادٌ يُشتقّ من النوع — ليُقرأ المفتاح في لوحة السحابة. */
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "audio/webm": "weba",
  "audio/mp4": "m4a",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/aac": "aac",
  "video/webm": "webm",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
};

/**
 * يكتب الملف حيث يجب: في السحابة إن رُبطت، وإلا في القاعدة.
 *
 * صفُّ `Media` يبقى في الحالتين — هو سجلّ الملكية والنوع والمقاس —
 * ويتبدّل مكان البايتات وحده.
 */
async function write(
  ownerId: string,
  mime: string,
  bytes: Uint8Array<ArrayBuffer>,
  width: number,
  height: number,
) {
  if (!cloudReady()) {
    return prisma.media.create({
      data: { ownerId, mime, bytes, width, height },
      select: { id: true },
    });
  }

  const key = `${ownerId}/${randomUUID()}.${EXT[mime] ?? "bin"}`;
  await putObject(key, bytes, mime);
  return prisma.media.create({
    data: { ownerId, mime, key, width, height },
    select: { id: true },
  });
}

/**
 * حذفٌ نهائيّ: الصفّ والكائن معاً.
 *
 * «لا نحتفظ بها» تعني ألّا تبقى في السحابة أيضاً — فالصفّ وحده لو ذهب
 * بقيت البكسلات في R2 إلى الأبد بلا شيء يدلّ عليها.
 */
export async function dropMedia(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const rows = await prisma.media.findMany({
    where: { id: { in: ids } },
    select: { id: true, key: true },
  });
  await prisma.media.deleteMany({ where: { id: { in: rows.map((row) => row.id) } } });
  await deleteObjects(rows.map((row) => row.key).filter((key): key is string => !!key));
}

/**
 * ينسخ ملفاً إلى صاحبٍ آخر.
 *
 * ولماذا نسخةٌ لا إشارةٌ إلى الأصل: `User.coverMediaId` فريد
 * (علاقةٌ واحدٌ لواحد)، فلو لبس اثنان غلافَ الثيم نفسه لاصطدما على
 * القيد — ولانتُزع الملفُّ من صنف المتجر نفسه. والنسخة تجعل غلافه
 * ملكَه: يغيّره أو يحذفه بلا أن يمسّ الصنف في المتجر.
 *
 * والبايتات تُنسخ حيث هي: صفٌّ جديد في القاعدة إن كانت فيها، وكائنٌ
 * جديد في الدلو إن كانت في السحابة.
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
    const answer = await getObject(source.key);
    if (!answer.ok) return null;
    const bytes = new Uint8Array(await answer.arrayBuffer());
    return write(toOwnerId, source.mime, bytes, source.width, source.height);
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

export const mediaUrl = (id: string | null | undefined) => (id ? `/api/media/${id}` : null);

/**
 * نقل ما بقي في القاعدة إلى السحابة.
 *
 * الملفات القديمة رُفعت قبل ربط R2 فبايتاتها في `Media.bytes`. ونقلها
 * لا يحتاج سكربتاً يُشغَّل بيدٍ على خادمٍ لا نصل إليه: يجري وحده،
 * دفعةً صغيرة مع كل كنسة — فالقاعدة تخفّ من نفسها.
 *
 * والترتيب لا يخسر شيئاً: يُكتب الكائن أولاً، فإن سقط الاتصال بعده بقي
 * الصفّ ببايتاته كما كان ويُعاد في الدورة التالية. ولا تُمسح البايتات
 * إلا بعد أن يصير للصفّ مفتاحٌ يدلّ على نسخةٍ موجودة.
 */
export async function migrateToCloud(limit = 20): Promise<number> {
  if (!cloudReady()) return 0;

  const rows = await prisma.media.findMany({
    where: { key: null, bytes: { not: null } },
    select: { id: true, ownerId: true, mime: true, bytes: true },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  let moved = 0;
  for (const row of rows) {
    if (!row.bytes) continue;
    try {
      const key = `${row.ownerId}/${randomUUID()}.${EXT[row.mime] ?? "bin"}`;
      await putObject(key, new Uint8Array(row.bytes), row.mime);
      await prisma.media.update({ where: { id: row.id }, data: { key, bytes: null } });
      moved++;
    } catch (problem) {
      // ملفٌّ واحدٌ يتعثّر لا يوقف البقية، ويُعاد في الدورة التالية.
      console.error("✗ نقل ملف إلى السحابة", row.id, problem);
    }
  }

  if (moved > 0) console.log(`↑ نُقل ${moved} ملفاً إلى السحابة`);
  return moved;
}
