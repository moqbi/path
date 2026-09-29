import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getObject } from "@/lib/storage";

/**
 * مرفقُ رسالة دعمٍ أو طلبِ وظيفة — للوحة وحدها.
 *
 * سيرةُ متقدّمٍ أو صورةُ مشكلةٍ لا تُفتح لأحدٍ غير من يقرأ الرسائل: المالك،
 * وممنوحُ اللوحة كلّها، وممنوحُ البلاغات والدعم (القاعدة ٧٣). والدرجةُ تُقرأ
 * من الصفّ هنا لا من إخفاء الرابط. و«غير موجود» لا «ممنوع» (القاعدة ٢٣ب).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const missing = () => new NextResponse("غير موجود", { status: 404 });

  const viewer = await currentUser();
  if (!viewer) return missing();
  const allowed =
    viewer.role === "ADMIN" || viewer.adminScope === "ALL" || viewer.adminScope === "REPORTS";
  if (!allowed) return missing();

  const file = await prisma.ticketFile.findUnique({
    where: { id },
    select: { name: true, mime: true, key: true, bytes: true },
  });
  if (!file) return missing();

  const headers = new Headers({
    "Content-Type": file.mime,
    "Cache-Control": "private, no-store",
    // الصورُ تُعرض في مكانها، والـPDF يُفتح في المتصفّح باسمه كما رُفع.
    "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    "X-Content-Type-Options": "nosniff",
  });

  if (file.key) {
    const upstream = await getObject(file.key);
    if (!upstream.ok) return missing();
    return new NextResponse(upstream.body, { headers });
  }
  if (!file.bytes) return missing();
  return new NextResponse(new Uint8Array(file.bytes), { headers });
}
