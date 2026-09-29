import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getObject } from "@/lib/storage";

/**
 * صورُ الموقع العامّ — صورةُ الرأس ولقطاتُ «من داخل التطبيق».
 *
 * `/api/media` يشترط جلسةً (القاعدة ٢٣ب)، وزائرُ صفحة الهبوط لا جلسةَ له —
 * فكانت صورةُ الرأس المرفوعة من اللوحة لا تظهر إلا للمشرف الذي رفعها.
 * وهذا البابُ **لا يفتح إلا ما رُبط بصورةٍ من صور الموقع** (`SiteImage`
 * أو `SiteShot` — والمخفيّةُ منها أيضاً، فهي صورٌ تُعرض للناس أصلاً وتُرى في اللوحة قبل إظهارها): معرّفُ لحظةٍ أو رسالةٍ يُردّ «غير موجود» ولو عُرف
 * — الاستثناءُ نفسه الذي في القاعدة ٢٣ج، بحدودٍ مرسومة.
 * و`public` صحيحة: صورٌ عامّة، ومعرّفُها يتغيّر مع كل استبدال.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const missing = () => new NextResponse("غير موجود", { status: 404 });

  const media = await prisma.media.findFirst({
    where: {
      id,
      OR: [{ siteImage: { isNot: null } }, { siteShot: { isNot: null } }],
    },
    select: { mime: true, key: true, bytes: true },
  });
  if (!media) return missing();

  const headers = new Headers({
    "Content-Type": media.mime,
    "Cache-Control": "public, max-age=86400",
    "X-Content-Type-Options": "nosniff",
  });

  if (media.key) {
    const upstream = await getObject(media.key, request.headers.get("range"));
    if (!upstream.ok && upstream.status !== 206) return missing();
    for (const name of ["content-length", "content-range", "etag"]) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    return new NextResponse(upstream.body, { status: upstream.status, headers });
  }
  if (!media.bytes) return missing();
  return new NextResponse(new Uint8Array(media.bytes), { headers });
}
