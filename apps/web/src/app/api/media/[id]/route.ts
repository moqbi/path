import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canSeeMedia } from "@/lib/visibility";
import { getObject } from "@/lib/storage";

/**
 * يقدّم الملفات المرفوعة — لمن يراها وحده.
 *
 * ومعرّف الملف ليس صلاحية: كان هذا الباب يفتح أيّ صورةٍ في القاعدة لأي
 * طلب، بلا حساب أصلاً، وبترويسة `public` تسمح لوسيطٍ مشترك أن يحتفظ
 * بصورة أحدهم ويقدّمها لغيره. الآن: جلسةٌ أولاً، ثم `canSeeMedia` —
 * القواعد نفسها التي تحكم قراءة اللحظات (القاعدة ٢٣) — ثم `private`
 * في الخبيئة.
 *
 * والمدّة تبقى طويلة: المعرّف يتغيّر مع كل رفع، فلا يوجد ما يُبطَل.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const viewer = await currentUser();
  if (!viewer) return new NextResponse("غير موجود", { status: 404 });

  const media = await prisma.media.findUnique({
    where: { id },
    select: { bytes: true, key: true, mime: true },
  });
  // «غير موجود» لا «ممنوع»: الثانية تؤكّد للسائل أنّ الملفّ قائم.
  if (!media) return new NextResponse("غير موجود", { status: 404 });
  if (!(await canSeeMedia(viewer.id, id))) return new NextResponse("غير موجود", { status: 404 });

  /*
    الملف في السحابة: يُمرَّر بثّه كما هو ومعه طلب المدى.
    والمرور عبر التطبيق مقصود — الدلو مغلق، فلا رابط مباشر يُنسخ ويُوزَّع
    خارج الدائرة، والصلاحية تبقى حيث تُفحص.
  */
  if (media.key) {
    const upstream = await getObject(media.key, request.headers.get("range"));
    if (!upstream.ok && upstream.status !== 206) {
      return new NextResponse("غير موجود", { status: upstream.status === 404 ? 404 : 502 });
    }
    const pass = new Headers();
    pass.set("Content-Type", media.mime);
    pass.set("Cache-Control", "private, max-age=31536000, immutable");
    pass.set("Accept-Ranges", "bytes");
    for (const name of ["content-length", "content-range", "etag"]) {
      const value = upstream.headers.get(name);
      if (value) pass.set(name, value);
    }
    return new NextResponse(upstream.body, { status: upstream.status, headers: pass });
  }

  if (!media.bytes) return new NextResponse("غير موجود", { status: 404 });
  const bytes = new Uint8Array(media.bytes);
  const headers = {
    "Content-Type": media.mime,
    "Cache-Control": "private, max-age=31536000, immutable",
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
