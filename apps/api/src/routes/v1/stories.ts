import { Hono } from "hono";
import { z } from "zod";
import { cuid, storyInput, storyReactInput } from "@athar/shared";
import { zValidator } from "../../lib/validate";
import { requireActive, requireAuth, me } from "../../middleware/auth";
import { rateLimitUser } from "../../middleware/rate-limit";
import * as stories from "../../services/stories";

const byId = z.object({ id: cuid });

export const storyRoutes = new Hono()
  .use("*", requireAuth, requireActive)
  // وعشرون قصّةً في الساعة: القصّة تذهب بيومها، ولا أحد ينشر أكثر.
  .use("/", rateLimitUser(20, 3600))

  /** الحلقات: أنت أولاً، ثم من لم تُشاهد قصصهم. */
  .get("/", async (c) => c.json({ rings: await stories.rings(me(c)) }))

  .post("/", zValidator("json", storyInput), async (c) =>
    c.json(await stories.post(me(c), c.req.valid("json")), 201),
  )

  .get("/user/:id", zValidator("param", byId), async (c) =>
    c.json({ stories: await stories.storiesOf(me(c), c.req.valid("param").id) }),
  )

  /** من شاهد قصّتي — لصاحبها وحده. */
  .get("/:id/viewers", zValidator("param", byId), async (c) =>
    c.json({ viewers: await stories.viewers(me(c), c.req.valid("param").id) }),
  )

  /** تفاعلُ المشاهد بأحد الوجوه الخمسة — أو `null` يرفعه. */
  .post("/:id/react", rateLimitUser(120, 3600), zValidator("param", byId), zValidator("json", storyReactInput), async (c) =>
    c.json(await stories.react(me(c), c.req.valid("param").id, c.req.valid("json").kind)),
  )

  .post("/:id/seen", zValidator("param", byId), async (c) =>
    c.json(await stories.see(me(c), c.req.valid("param").id)),
  )

  .delete("/:id", zValidator("param", byId), async (c) =>
    c.json(await stories.remove(me(c), c.req.valid("param").id)),
  );
