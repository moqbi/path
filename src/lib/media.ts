import "server-only";
import { prisma } from "@/lib/db";

/** أقصى حجم مقبول بعد تصغير المتصفح — حارس ضد رفع ملف ضخم يدوياً. */
const MAX_BYTES = 1_500_000;
/** المتحرّكة تُرفع بملفها بلا تصغير، فحدُّها أعلى — ونفس ما يُقال للمستخدم. */
const MAX_ANIMATED_BYTES = 3_000_000;
const MAX_ANIMATED_SIDE = 1024;
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

  return prisma.media.create({
    data: { ownerId, mime, bytes, width: Math.max(0, Math.round(width)), height: Math.max(0, Math.round(height)) },
    select: { id: true },
  });
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
  if (moving && !allowAnimated) throw new Error("الصورة المتحركة لمشتركي أثر+");
  if (!moving && mime === "image/gif") throw new Error("يُقبل JPEG أو PNG أو WebP فقط");
  const cap = moving ? MAX_ANIMATED_BYTES : MAX_BYTES;
  if (bytes.length > cap) throw new Error("الصورة كبيرة — صغّرها وأعد المحاولة");
  if (moving && Math.max(width, height) > MAX_ANIMATED_SIDE) {
    throw new Error("مقاس الصورة المتحركة أكبر من ١٠٢٤×١٠٢٤");
  }

  return prisma.media.create({
    data: {
      ownerId,
      mime,
      bytes,
      width: Math.max(1, Math.round(width)),
      height: Math.max(1, Math.round(height)),
    },
    select: { id: true },
  });
}

export const mediaUrl = (id: string | null | undefined) => (id ? `/api/media/${id}` : null);
