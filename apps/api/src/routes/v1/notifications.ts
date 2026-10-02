import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "../../lib/validate";
import { requireAuth, me } from "../../middleware/auth";
import * as notes from "../../services/notifications";

/**
 * الإشعارات — تُشتقّ ولا تُخزَّن، فلا مؤشّر لها ولا صفحات.
 *
 * والعدّ منفصلٌ لأنّ الشريط السفلي يسأل عنه وحده: نقطةٌ فوق أيقونة لا
 * تحتاج أربعين صفاً لتُرسم.
 */
export const notificationRoutes = new Hono()
  .use("*", requireAuth)

  .get(
    "/",
    zValidator("query", z.object({ limit: z.coerce.number().int().min(1).max(60).default(40) })),
    async (c) => c.json({ notes: await notes.notifications(me(c), c.req.valid("query").limit) }),
  )

  .get("/count", async (c) => c.json({ unseen: await notes.unseenCount(me(c)) }))

  // الحذفُ من كل مكان: الخادمُ والويبُ يستثنيان ما حُذف من الاشتقاق نفسه.
  .delete("/", async (c) => {
    await notes.clearAll(me(c));
    return c.json({ ok: true });
  })

  .delete(
    "/:id",
    zValidator("param", z.object({ id: z.string().min(1).max(80) })),
    async (c) => {
      await notes.dismiss(me(c), c.req.valid("param").id);
      return c.json({ ok: true });
    },
  );
