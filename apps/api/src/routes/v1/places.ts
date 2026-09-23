import { Hono } from "hono";
import { z } from "zod";
import { requireActive, requireAuth, me } from "../../middleware/auth";
import { nearbyPlaces } from "../../lib/places";
import { checkInCity } from "../../services/moments";

/**
 * الأماكن حول المستخدم.
 *
 * النداء من الخادم لا من الجهاز: Photon تُسأل بترويسةٍ تعرّف بالتطبيق،
 * وإحداثيات الناس لا تخرج إلى طرفٍ ثالث من أجهزتهم. والشاشة تعرض ما
 * يردّ ويختار صاحبها بنفسه — أقربُ عنوانٍ يردّ شارعاً، والشارع لا يقول
 * أين أنت (القاعدة ٦٣).
 *
 * والفشل قائمةٌ فارغة لا خطأ: النشر لا يتعطّل لأنّ خريطةً تأخّرت.
 */
const query = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

export const placeRoutes = new Hono()
  .use("*", requireAuth)

  .get("/nearby", async (c) => {
    const parsed = query.safeParse({ lat: c.req.query("lat"), lng: c.req.query("lng") });
    if (!parsed.success) return c.json({ places: [] });

    const places = await nearbyPlaces(parsed.data.lat, parsed.data.lng);
    return c.json({ places });
  })

  /*
    فتحُ التطبيق في مدينةٍ أخرى: يكتب «وصل إلى …» مرّةً واحدة.
    وهو بابُ كتابةٍ فيمرّ بـ`requireActive` كبقيّتها (القاعدة ١١٦).
  */
  .post("/check-in", requireActive, async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as unknown;
    const parsed = query.safeParse(body);
    if (!parsed.success) return c.json({ city: null, wrote: false });

    const result = await checkInCity(me(c), parsed.data.lat, parsed.data.lng);
    return c.json(result);
  });
