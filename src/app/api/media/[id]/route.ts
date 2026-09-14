import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * يقدّم الصور المرفوعة من القاعدة.
 *
 * الصور والأصوات ومقاطع الفيديو محتوى داخل دوائر مغلقة، لكن معرّفها cuid غير قابل للتخمين ولا
 * يُنشر إلا لمن يرى اللحظة أو الملف. تُخزَّن مؤقتاً في المتصفح طويلاً لأن
 * المعرّف يتغيّر مع كل رفع جديد، فلا يوجد ما يُبطَل.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const media = await prisma.media.findUnique({
    where: { id },
    select: { bytes: true, mime: true },
  });
  if (!media) return new NextResponse("غير موجود", { status: 404 });

  const bytes = new Uint8Array(media.bytes);
  const headers = {
    "Content-Type": media.mime,
    "Cache-Control": "public, max-age=31536000, immutable",
    "Accept-Ranges": "bytes",
  };

  /*
    طلب المدى: سفاري لا يشغّل فيديو من مصدرٍ لا يردّ ٢٠٦ — يطلب أول
    بايتات ليقرأ الرأس، فإن جاءه الملف كاملاً بـ٢٠٠ ترك المشغّل فارغاً.
  */
  const range = request.headers.get("range");
  const match = range ? /bytes=(\d*)-(\d*)/.exec(range) : null;
  if (match) {
    const start = match[1] ? Number(match[1]) : 0;
    const end = match[2] ? Math.min(Number(match[2]), bytes.length - 1) : bytes.length - 1;
    if (start >= bytes.length || start > end) {
      return new NextResponse(null, {
        status: 416,
        headers: { ...headers, "Content-Range": `bytes */${bytes.length}` },
      });
    }
    return new NextResponse(bytes.subarray(start, end + 1), {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${bytes.length}` },
    });
  }

  return new NextResponse(bytes, { headers });
}
