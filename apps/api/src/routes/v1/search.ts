import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "../../lib/validate";
import { unknownKinds } from "../../lib/client-kinds";
import { requireAuth, me } from "../../middleware/auth";
import { rateLimitUser } from "../../middleware/rate-limit";
import { search } from "../../services/search";

const query = z.object({ q: z.string().max(120).default("") });

/** البحثُ الذكيّ (القاعدة ٣٣٥): ستّون في خمس دقائق — كلُّ حرفٍ يُكتب طلب. */
export const searchRoutes = new Hono()
  .use("*", requireAuth)
  .get("/", rateLimitUser(60, 300), zValidator("query", query), async (c) =>
    c.json(await search(me(c), c.req.valid("query").q, unknownKinds(c) as never)),
  );
