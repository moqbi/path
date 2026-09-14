import "server-only";
import { prisma } from "@/lib/db";

/** أقصى حجم مقبول بعد تصغير المتصفح — حارس ضد رفع ملف ضخم يدوياً. */
const MAX_BYTES = 1_500_000;
/** المتحرّكة تُرفع بملفها بلا تصغير، فحدُّها أعلى — ونفس ما يُقال للمستخدم. */
const MAX_ANIMATED_BYTES = 3_000_000;
const MAX_ANIMATED_SIDE = 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

/**
 * أمتحرّكةٌ هي؟ يُقرأ من الملف لا من امتداده.
 *
 * GIF متحرّكة إن حملت أكثر من كتلة صورة (`,` بعد الرأس)، وWebP متحرّكة
 * إن حملت كتلة `ANIM`. والفحص على الخادم لأن الميزة مدفوعة: امتدادٌ
 * يُكتب في العميل ليس قيداً.
 */
export function isAnimated(mime: string, bytes: Buffer): boolean {
  if (mime === "image/gif") {
    // كتلة «التحكّم بالرسم» (21 F9 04) تسبق كل إطار: اثنتان تعني حركة.
    let frames = 0;
    for (let i = 0; i < bytes.length - 2 && frames < 2; i++) {
      if (bytes[i] === 0x21 && bytes[i + 1] === 0xf9 && bytes[i + 2] === 0x04) frames++;
    }
    return frames >= 2;
  }
  if (mime === "image/webp") return bytes.subarray(0, 64).includes(Buffer.from("ANIM"));
  return false;
}

/**
 * يخزّن صورة قادمة كـ data URL من المتصفح.
 *
 * التحقق يعاد هنا ولا يُكتفى بتصغير العميل: إجراءات الخادم تُستدعى مباشرة
 * بـPOST، فما يحدّه المتصفح ليس قيداً.
 */
export async function storeDataUrl(
  ownerId: string,
  dataUrl: string,
  width: number,
  height: number,
  /** يُسمح بصورةٍ متحركة (وبحدِّ حجمها الأعلى) — لمشتركي أثر+. */
  allowAnimated = false,
) {
  const match = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(dataUrl);
  if (!match) throw new Error("صيغة الصورة غير مدعومة");

  const [, mime, base64] = match;
  if (!ALLOWED.has(mime)) throw new Error("يُقبل JPEG أو PNG أو WebP فقط");

  const bytes = Buffer.from(base64, "base64");
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
