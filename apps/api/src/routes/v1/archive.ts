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
const bookPrefsBody = z.object({
  cover: z.string().max(20),
  title: z.string().max(200).nullable().optional(),
  dedication: z.string().max(400).nullable().optional(),
  sections: z.array(z.object({ id: z.string().max(20), on: z.boolean() })).max(20),
});
const byYear = z.object({ year: z.coerce.number().int().min(2024).max(2100) });

/** «أرشيفي» و«سنتك في كتاب» (القاعدة ٢٤٤) — لصاحبها وحده. */
export const archiveRoutes = new Hono()
  .use("*", requireAuth)
  .get("/", zValidator("query", pageQuery), async (c) => c.json(await archive.archive(me(c), c.req.valid("query"))))
  .get("/years", async (c) => c.json(await archive.years(me(c))))
  // «خريطتي» (القاعدة ٣٦٨).
  .get("/map", async (c) => c.json(await archive.map(me(c))))
  .get("/book/:year", zValidator("param", byYear), async (c) =>
    c.json(await archive.book(me(c), c.req.valid("param").year)),
  )
  // تجهيزُ الكتاب لآثار+ (القاعدة ٣٧٨).
  .put("/book/:year/prefs", zValidator("param", byYear), zValidator("json", bookPrefsBody), async (c) =>
    c.json(await archive.saveBookPrefs(me(c), c.req.valid("param").year, c.req.valid("json"))),
  )
  // الكتابُ صفحةً تُطبع PDF على الجهاز (القاعدة ٢٥٦).
  .get("/book/:year/print", zValidator("param", byYear), async (c) =>
    c.json(await bookHtml(me(c), c.req.valid("param").year)),
  );
