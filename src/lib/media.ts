import "server-only";
import { prisma } from "@/lib/db";

/** أقصى حجم مقبول بعد تصغير المتصفح — حارس ضد رفع ملف ضخم يدوياً. */
const MAX_BYTES = 1_500_000;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * يخزّن صورة قادمة كـ data URL من المتصفح.
 *
 * التحقق يعاد هنا ولا يُكتفى بتصغير العميل: إجراءات الخادم تُستدعى مباشرة
 * بـPOST، فما يحدّه المتصفح ليس قيداً.
 */
export async function storeDataUrl(ownerId: string, dataUrl: string, width: number, height: number) {
  const match = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(dataUrl);
  if (!match) throw new Error("صيغة الصورة غير مدعومة");

  const [, mime, base64] = match;
  if (!ALLOWED.has(mime)) throw new Error("يُقبل JPEG أو PNG أو WebP فقط");

  const bytes = Buffer.from(base64, "base64");
  if (bytes.length === 0) throw new Error("الملف فارغ");
  if (bytes.length > MAX_BYTES) throw new Error("الصورة كبيرة — صغّرها وأعد المحاولة");

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
