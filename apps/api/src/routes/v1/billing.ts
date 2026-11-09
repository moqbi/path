import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "../../lib/validate";
import { requireAuth, me } from "../../middleware/auth";
import { HuaweiError, claimHuawei } from "../../services/huawei";

/**
 * دفعُ هواوي (القاعدة ٤٤٦): الجهازُ يرسل ما ردّته نافذةُ الدفع، والخادمُ يتحقّق منه عند هواوي
 * ثمّ يودع ويستهلك. ولا يُصدَّق ما فيه إلا `purchaseToken` — وما تقوله هواوي هو ما يُودَع.
 */
const claimInput = z.object({
  data: z.string().min(10).max(20_000),
  type: z.union([z.literal(0), z.literal(2)]),
});

export const billingRoutes = new Hono()
  .use("*", requireAuth)
  .post("/huawei", zValidator("json", claimInput), async (c) => {
    const { data, type } = c.req.valid("json");
    try {
      return c.json(await claimHuawei(me(c), data, type));
    } catch (problem) {
      if (problem instanceof HuaweiError) return c.json({ error: problem.message }, 400);
      throw problem;
    }
  });
