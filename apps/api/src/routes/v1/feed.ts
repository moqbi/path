import { Hono } from "hono";
import { pageQuery, cuid } from "@athar/shared";
import { z } from "zod";
import { zValidator } from "../../lib/validate";
import { requireAuth, me } from "../../middleware/auth";
import * as feed from "../../services/feed";

/** الخط الزمني واللحظة. كلّها خلف التوكن — لا قراءة بلا حساب. */
export const feedRoutes = new Hono()
  .use("*", requireAuth)

  .get("/", zValidator("query", pageQuery), async (c) =>
    c.json(await feed.timeline(me(c), c.req.valid("query"))),
  )

  .get("/private", zValidator("query", pageQuery), async (c) =>
    c.json(await feed.privateTimeline(me(c), c.req.valid("query"))),
  );

export const momentRoutes = new Hono()
  .use("*", requireAuth)

  .get("/:id", zValidator("param", z.object({ id: cuid })), async (c) =>
    c.json({ moment: await feed.momentById(me(c), c.req.valid("param").id) }),
  );
