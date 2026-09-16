import { Hono } from "hono";
import { z } from "zod";
import { cuid, storyInput } from "@athar/shared";
import { zValidator } from "../../lib/validate";
import { requireActive, requireAuth, me } from "../../middleware/auth";
import * as stories from "../../services/stories";

const byId = z.object({ id: cuid });

export const storyRoutes = new Hono()
  .use("*", requireAuth, requireActive)

  /** الحلقات: أنت أولاً، ثم من لم تُشاهد قصصهم. */
  .get("/", async (c) => c.json({ rings: await stories.rings(me(c)) }))

  .post("/", zValidator("json", storyInput), async (c) =>
    c.json(await stories.post(me(c), c.req.valid("json")), 201),
  )

  .get("/user/:id", zValidator("param", byId), async (c) =>
    c.json({ stories: await stories.storiesOf(me(c), c.req.valid("param").id) }),
  )

  .post("/:id/seen", zValidator("param", byId), async (c) =>
    c.json(await stories.see(me(c), c.req.valid("param").id)),
  )

  .delete("/:id", zValidator("param", byId), async (c) =>
    c.json(await stories.remove(me(c), c.req.valid("param").id)),
  );
