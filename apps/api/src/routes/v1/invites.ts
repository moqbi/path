import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "../../lib/validate";
import { requireAuth, me } from "../../middleware/auth";
import { rateLimitUser } from "../../middleware/rate-limit";
import * as invites from "../../services/invites";

const claimInput = z.object({ memberNo: z.coerce.number().int().positive().max(100_000_000) });

/** برنامجُ الدعوات (القاعدة ٢٤٣) — تقدّمي فيه، و«من دعاك؟» في أيّامي الأولى. */
export const inviteRoutes = new Hono()
  .use("*", requireAuth)
  .get("/", async (c) => c.json(await invites.status(me(c))))
  .post("/claim", rateLimitUser(10, 3600), zValidator("json", claimInput), async (c) =>
    c.json(await invites.claim(me(c), c.req.valid("json").memberNo)),
  );
