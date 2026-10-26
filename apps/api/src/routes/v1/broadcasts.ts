import { Hono } from "hono";
import { requireAuth } from "../../middleware/auth";
import { broadcastCard } from "../../services/broadcasts";
import { notFound } from "../../lib/errors";

/** بطاقةُ تنبيه المشرف تُفتح بضغطه (القاعدة ٣٦٣). */
export const broadcastRoutes = new Hono()
  .use("*", requireAuth)
  .get("/:id", async (c) => {
    const card = await broadcastCard(c.req.param("id"));
    if (!card) throw notFound("غير موجود");
    return c.json({ card });
  });
