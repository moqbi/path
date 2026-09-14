import { Hono } from "hono";
import { z } from "zod";
import { cuid, pageQuery } from "@athar/shared";
import { zValidator } from "../../lib/validate";
import { requireAuth, me } from "../../middleware/auth";
import * as circle from "../../services/circle";
import * as feed from "../../services/feed";

export const circleRoutes = new Hono()
  .use("*", requireAuth)
  .get("/", async (c) => c.json(await circle.circle(me(c))))
  .get("/suggestions", async (c) => c.json({ people: await circle.suggestions(me(c)) }));

export const userRoutes = new Hono()
  .use("*", requireAuth)

  .get("/:id", zValidator("param", z.object({ id: cuid })), async (c) =>
    c.json(await circle.userProfile(me(c), c.req.valid("param").id)),
  )

  .get(
    "/:id/moments",
    zValidator("param", z.object({ id: cuid })),
    zValidator("query", pageQuery),
    async (c) => {
      const { id } = c.req.valid("param");
      // الملفّ يُفتح أولاً: من لا يُسمح له برؤيته لا يُعطى لحظاته.
      await circle.userProfile(me(c), id);
      return c.json(await feed.momentsOf(me(c), id, c.req.valid("query")));
    },
  );
