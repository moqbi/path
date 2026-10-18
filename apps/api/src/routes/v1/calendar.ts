import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "../../lib/validate";
import { requireAuth, me } from "../../middleware/auth";
import { CALENDAR_YEARS, month } from "../../services/calendar";
import { badRequest } from "../../lib/errors";

const query = z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) });

/** التقويم (القاعدة ٢٩٢): شهرٌ بذكرياته ومناسباته — لصاحبه وحده. */
export const calendarRoutes = new Hono()
  .use("*", requireAuth)
  .get("/", zValidator("query", query), async (c) => {
    const [year, monthNo] = c.req.valid("query").month.split("-").map(Number);
    // سنةٌ في مدى التطبيق وحده: كلُّ سنةٍ جديدة تُبنى لها خريطةٌ هجريّة وتُحفظ.
    if (year < CALENDAR_YEARS.from || year > CALENDAR_YEARS.to) throw badRequest("الشهر خارج التقويم");
    return c.json(await month(me(c), year, monthNo));
  });
