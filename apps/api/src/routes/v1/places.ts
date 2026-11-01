import { Hono } from "hono";
import { z } from "zod";
import { requireActive, requireAuth, me } from "../../middleware/auth";
import { nearbyPlaces, searchPlaces } from "../../lib/places";
import { checkInCity } from "../../services/moments";
import { rememberSpot } from "../../services/discover";
import { landmark } from "../../lib/landmark";
import { rateLimit } from "../../middleware/rate-limit";

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
  // كلُّ بحثٍ نداءٌ مدفوعٌ عند قوقل: عشرون في الدقيقة تكفي إصبعاً يكتب.
  .use("/search", rateLimit(20, 60))

  /*
    صورةُ معلم الدولة وبانوراما المدينة في «خريطتي» (القاعدة ٣٨٤): ويكيبيديا تُسأل من هنا
    وتُحفظ أسبوعاً، والصورةُ تعود \`data:\` مصغّرة. وستّون في الدقيقة تكفي خريطةً تُفتح.
  */
  .get("/landmark", rateLimit(60, 60), async (c) => {
    const parsed = z
      .object({
        kind: z.enum(["country", "city"]),
        name: z.string().trim().min(1).max(80),
        size: z.enum(["pin", "hero"]).default("pin"),
        lat: z.coerce.number().min(-90).max(90).optional(),
        lng: z.coerce.number().min(-180).max(180).optional(),
      })
      .safeParse(c.req.query());
    if (!parsed.success) return c.json({ image: null, credit: null });
    const { kind, name, size, lat, lng } = parsed.data;
    const near = lat != null && lng != null ? { lat, lng } : undefined;
    return c.json(await landmark(kind, name, size, near));
  })

  .get("/nearby", async (c) => {
    const parsed = query.safeParse({ lat: c.req.query("lat"), lng: c.req.query("lng") });
    if (!parsed.success) return c.json({ places: [] });

    // `source` تقرؤه الشاشة لتنسب القائمة إلى قوقل كما تشترط شروطُه.
    return c.json(await nearbyPlaces(parsed.data.lat, parsed.data.lng));
  })

  // بحثٌ بالاسم لما لم يظهر في القائمة — قوقل وحده، وبلا مفتاحٍ فارغ.
  .get("/search", async (c) => {
    const parsed = query.safeParse({ lat: c.req.query("lat"), lng: c.req.query("lng") });
    const text = c.req.query("q") ?? "";
    if (!parsed.success) return c.json({ places: [], source: "google" });
    const places = await searchPlaces(parsed.data.lat, parsed.data.lng, text);
    return c.json({ places, source: "google" });
  })

  /*
    فتحُ التطبيق في مدينةٍ أخرى: يكتب «وصل إلى …» مرّةً واحدة.
    وهو بابُ كتابةٍ فيمرّ بـ`requireActive` كبقيّتها (القاعدة ١١٦).
  */
  .post("/check-in", requireActive, async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as unknown;
    const parsed = query.extend({
      airport: z.string().trim().min(1).max(120).optional(),
      city: z.string().trim().min(1).max(80).optional(),
      country: z.string().trim().min(1).max(80).optional(),
      countryCode: z.string().trim().length(2).optional(),
    }).safeParse(body);
    if (!parsed.success) return c.json({ city: null, wrote: false });

    // ومعه آخرُ موضعٍ لمن فعّل تنبيهَ «من حولك» (القاعدة ٢٨٢) — ساعةً في الذاكرة.
    void rememberSpot(me(c), parsed.data);
    const result = await checkInCity(me(c), parsed.data.lat, parsed.data.lng, parsed.data);
    return c.json(result);
  });
