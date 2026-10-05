import { Hono } from "hono";
import { z } from "zod";
import { cuid } from "@athar/shared";
import { zValidator } from "../../lib/validate";
import { requireAuth, me } from "../../middleware/auth";
import * as archive from "../../services/archive";
import { bookHtml } from "../../services/book-print";

const pageQuery = z.object({
  cursor: cuid.optional(),
  limit: z.coerce.number().int().min(1).max(90).default(60),
});
const byYear = z.object({ year: z.coerce.number().int().min(2024).max(2100) });

/** «أرشيفي» و«سنتك في كتاب» (القاعدة ٢٤٤) — لصاحبها وحده. */
export const archiveRoutes = new Hono()
  .use("*", requireAuth)
  .get("/", zValidator("query", pageQuery), async (c) => c.json(await archive.archive(me(c), c.req.valid("query"))))
  .get("/years", async (c) => c.json(await archive.years(me(c))))
  .get("/book/:year", zValidator("param", byYear), async (c) =>
    c.json(await archive.book(me(c), c.req.valid("param").year)),
  )
  // الكتابُ صفحةً تُطبع PDF على الجهاز (القاعدة ٢٥٦).
  .get("/book/:year/print", zValidator("param", byYear), async (c) =>
    c.json(await bookHtml(me(c), c.req.valid("param").year)),
  );
