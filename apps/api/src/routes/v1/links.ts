import { Hono } from "hono";
import { requireAuth } from "../../middleware/auth";
import { rateLimitUser } from "../../middleware/rate-limit";
import { linkPreview } from "../../lib/link-preview";

/**
 * معاينةُ الروابط (القاعدة ٣٦٦). لصاحب جلسةٍ وحده، وستّون في خمس دقائق:
 * كلُّ معاينةٍ طلبٌ يخرج من خادمنا إلى موقعٍ يختاره المستخدم، فبابٌ بلا
 * حدٍّ يصير أداةَ إغراقٍ لمواقع غيرنا. والفشلُ `null` لا خطأ: الرابطُ
 * يبقى نصّاً يُضغط.
 */
export const linkRoutes = new Hono()
  .use("*", requireAuth)
  .use("*", rateLimitUser(60, 300))
  .get("/preview", async (c) => {
    const url = (c.req.query("url") ?? "").slice(0, 2048);
    if (!url) return c.json({ preview: null });
    return c.json({ preview: await linkPreview(url) });
  });
