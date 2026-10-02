import { Hono } from "hono";
import { z } from "zod";
import { cuid, pageQuery } from "@athar/shared";
import { zValidator } from "../../lib/validate";
import { requireActive, requireAuth, me } from "../../middleware/auth";
import { rateLimitUser } from "../../middleware/rate-limit";
import * as groups from "../../services/groups";

const byId = z.object({ id: cuid });
const name = z.string().trim().min(1).max(groups.NAME_MAX);
const ids = z.array(cuid).max(150);

/**
 * المحادثات الجماعيّة (القاعدة ٢١٥). الصلاحيةُ في الخدمة لا هنا: العضويّةُ
 * للقراءة والكتابة، و`canRunGroups` للإنشاء والإدارة. والكتابةُ تُغلق في
 * وجه الموقوف (`requireActive`) كالمحادثة.
 */
export const groupRoutes = new Hono()
  .use("*", requireAuth)

  .get("/", async (c) => c.json(await groups.list(me(c))))

  .get("/candidates", zValidator("query", z.object({ q: z.string().max(400).default("") })), async (c) =>
    c.json(await groups.candidates(me(c), c.req.valid("query").q)),
  )

  .post("/", requireActive, zValidator("json", z.object({ name, memberIds: ids })), async (c) =>
    c.json(await groups.create(me(c), c.req.valid("json")), 201),
  )

  .get("/:id", zValidator("param", byId), zValidator("query", pageQuery), async (c) =>
    c.json(await groups.thread(me(c), c.req.valid("param").id, c.req.valid("query"))),
  )

  .post(
    "/:id/messages",
    requireActive,
    rateLimitUser(200, 3600),
    zValidator("param", byId),
    zValidator(
      "json",
      z.object({
        kind: z.enum(["TEXT", "PHOTO"]).default("TEXT"),
        body: z.string().trim().max(2000).optional(),
        mediaId: cuid.optional(),
      }),
    ),
    async (c) => {
      const sent = await groups.send(me(c), c.req.valid("param").id, c.req.valid("json"));
      return c.json({ message: sent.message }, 201);
    },
  )

  .post("/:id/read", zValidator("param", byId), async (c) =>
    c.json(await groups.markRead(me(c), c.req.valid("param").id)),
  )

  .patch("/:id", requireActive, zValidator("param", byId), zValidator("json", z.object({ name })), async (c) =>
    c.json(await groups.rename(me(c), c.req.valid("param").id, c.req.valid("json").name)),
  )

  .post(
    "/:id/members",
    requireActive,
    zValidator("param", byId),
    zValidator("json", z.object({ ids })),
    async (c) => c.json(await groups.addMembers(me(c), c.req.valid("param").id, c.req.valid("json").ids)),
  )

  .delete(
    "/:id/members/:userId",
    zValidator("param", z.object({ id: cuid, userId: cuid })),
    async (c) => {
      const { id, userId } = c.req.valid("param");
      return c.json(await groups.removeMember(me(c), id, userId));
    },
  )

  .delete("/:id", zValidator("param", byId), async (c) =>
    c.json(await groups.remove(me(c), c.req.valid("param").id)),
  )

  .delete("/messages/:id", zValidator("param", byId), async (c) =>
    c.json(await groups.removeMessage(me(c), c.req.valid("param").id)),
  );
