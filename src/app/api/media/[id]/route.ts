import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * يقدّم الصور المرفوعة من القاعدة.
 *
 * الصور محتوى داخل دوائر مغلقة، لكن معرّفها cuid غير قابل للتخمين ولا
 * يُنشر إلا لمن يرى اللحظة أو الملف. تُخزَّن مؤقتاً في المتصفح طويلاً لأن
 * المعرّف يتغيّر مع كل رفع جديد، فلا يوجد ما يُبطَل.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const media = await prisma.media.findUnique({
    where: { id },
    select: { bytes: true, mime: true },
  });
  if (!media) return new NextResponse("غير موجود", { status: 404 });

  return new NextResponse(new Uint8Array(media.bytes), {
    headers: {
      "Content-Type": media.mime,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
