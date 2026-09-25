import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getObject } from "@/lib/storage";

/**
 * صورةُ العرض والغلاف لصفحة المشاركة — بلا حساب.
 *
 * **استثناءٌ مقصود للقاعدة ٢٣ب**، وحدودُه مرسومة: `/api/media/[id]` يفحص
 * الجلسة ثم الصلاحية، وهذا الباب لا جلسة له. ولذلك لا يقبل معرّف ملفٍ
 * أصلاً — يقبل **رقم عضوية**، ويقرأ منه حقلين اثنين لا غير: صورةَ عرض
 * صاحبه وغلافه. فلا يُفتح به ملفُّ لحظةٍ ولا قصةٍ ولا رسالة مهما عُرف
 * معرّفه.
 *
 * ومعهما **الإطار والتميمة الملبوسان**: رسمُ صنفِ متجرٍ يُعرض للجميع
 * أصلاً (القاعدة ٢٣ب)، ويُقرأ هنا من رقم العضوية أيضاً لا من معرّفه —
 * فلا يصير هذا البابُ طريقاً إلى ملفٍّ غيرهما.
 *
 * وما يُقدَّم هنا هو بعينه ما تعرضه الصفحة العامة `/u/[memberNo]`: من
 * أعطى رابطه أعطى وجهه. ولا يُكشف شيءٌ زائد.
 *
 * والخبيئة `public` هنا صحيحة لا خطأ: الصورة عامةٌ قصداً، وزاحفُ
 * واتساب وتويتر يقرأها بلا كوكي فلا سبيل إلى «خاصّة».
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ kind: string; memberNo: string }> },
) {
  const { kind, memberNo } = await params;
  if (kind !== "avatar" && kind !== "cover" && kind !== "frame" && kind !== "charm") {
    return new NextResponse("غير موجود", { status: 404 });
  }

  const number = Number(memberNo);
  if (!Number.isInteger(number) || number < 1) {
    return new NextResponse("غير موجود", { status: 404 });
  }

  const person = await prisma.user.findUnique({
    where: { memberNo: number },
    select: {
      avatarMediaId: true,
      coverMediaId: true,
      frame: { select: { mediaId: true } },
      charm: { select: { mediaId: true } },
    },
  });
  const mediaId =
    kind === "avatar"
      ? person?.avatarMediaId
      : kind === "cover"
        ? person?.coverMediaId
        : kind === "frame"
          ? person?.frame?.mediaId
          : person?.charm?.mediaId;
  if (!mediaId) return new NextResponse("غير موجود", { status: 404 });

  const media = await prisma.media.findUnique({
    where: { id: mediaId },
    select: { bytes: true, key: true, mime: true },
  });
  if (!media) return new NextResponse("غير موجود", { status: 404 });

  const cache = "public, max-age=3600, stale-while-revalidate=86400";

  if (media.key) {
    const upstream = await getObject(media.key, null);
    if (!upstream.ok) return new NextResponse("غير موجود", { status: 404 });

    const headers = new Headers();
    headers.set("Content-Type", media.mime);
    headers.set("Cache-Control", cache);
    const length = upstream.headers.get("content-length");
    if (length) headers.set("Content-Length", length);
    return new NextResponse(upstream.body, { status: 200, headers });
  }

  if (!media.bytes) return new NextResponse("غير موجود", { status: 404 });

  return new NextResponse(new Uint8Array(media.bytes), {
    status: 200,
    headers: { "Content-Type": media.mime, "Cache-Control": cache },
  });
}
