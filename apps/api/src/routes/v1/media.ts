import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "@athar/db";
import { getObject } from "@athar/storage";
import { cuid } from "@athar/shared";
import { zValidator } from "../../lib/validate";
import { requireAuth } from "../../middleware/auth";
import { notFound } from "../../lib/errors";

/**
 * تقديم الملفات.
 *
 * خلف التوكن دائماً: الدلو مغلق ولا رابط مباشر يخرج منه، فكل بايتٍ يمرّ
 * من هنا وتُفحص الجلسة قبله. والمعرّف `cuid` لا يُخمَّن، فلا يُطلب ملفٌ
 * بالمصادفة.
 *
 * وطلب المدى يُمرَّر كما هو: سفاري لا يشغّل فيديو من مصدرٍ يردّ الملف
 * كاملاً على `Range`.
 */
export const mediaRoutes = new Hono()
  .use("*", requireAuth)

  .get("/:id", zValidator("param", z.object({ id: cuid })), async (c) => {
    const { id } = c.req.valid("param");

    const media = await prisma.media.findUnique({
      where: { id },
      select: { bytes: true, key: true, mime: true },
    });
    if (!media) throw notFound("الملف غير موجود");

    const headers = new Headers({
      "Content-Type": media.mime,
      // خاصٌّ لا عام: وسيطٌ مشترك لا يحتفظ بملفّ أحدهم ليقدّمه لغيره.
      "Cache-Control": "private, max-age=31536000, immutable",
      "Accept-Ranges": "bytes",
    });

    if (media.key) {
      const upstream = await getObject(media.key, c.req.header("range"));
      if (!upstream.ok && upstream.status !== 206) throw notFound("الملف غير موجود");
      for (const name of ["content-length", "content-range", "etag"]) {
        const value = upstream.headers.get(name);
        if (value) headers.set(name, value);
      }
      return new Response(upstream.body, { status: upstream.status, headers });
    }

    if (!media.bytes) throw notFound("الملف غير موجود");
    const bytes = new Uint8Array(media.bytes);

    const range = /bytes=(\d*)-(\d*)/.exec(c.req.header("range") ?? "");
    if (range) {
      const start = range[1] ? Number(range[1]) : 0;
      const end = range[2] ? Math.min(Number(range[2]), bytes.length - 1) : bytes.length - 1;
      if (start >= bytes.length || start > end) {
        headers.set("Content-Range", `bytes */${bytes.length}`);
        return new Response(null, { status: 416, headers });
      }
      headers.set("Content-Range", `bytes ${start}-${end}/${bytes.length}`);
      return new Response(bytes.subarray(start, end + 1), { status: 206, headers });
    }

    return new Response(bytes, { headers });
  });
