import { Hono } from "hono";
import { z } from "zod";
import { cuid, friendGroupInput, groupInput, pageQuery } from "@athar/shared";
import { zValidator } from "../../lib/validate";
import { requireAuth, me } from "../../middleware/auth";
import * as circle from "../../services/circle";
import * as feed from "../../services/feed";

const byId = z.object({ id: cuid });

/**
 * الدائرة.
 *
 * المسارات الثابتة قبل المعامِلة: `/suggestions` و`/groups` و`/blocked`
 * تسبق `/:id` وإلا ابتلعها.
 */
export const circleRoutes = new Hono()
  .use("*", requireAuth)

  .get("/", async (c) => c.json(await circle.circle(me(c))))
  .get("/suggestions", async (c) => c.json({ people: await circle.suggestions(me(c)) }))
  .get("/blocked", async (c) => c.json({ people: await circle.blockedList(me(c)) }))

  /** التصنيفات: يملكها صاحبها ولا يراها من صُنّف فيها. */
  .post("/groups", zValidator("json", groupInput), async (c) =>
    c.json({ group: await circle.createGroup(me(c), c.req.valid("json").name) }, 201),
  )

  .delete("/groups/:id", zValidator("param", byId), async (c) =>
    c.json(await circle.deleteGroup(me(c), c.req.valid("param").id)),
  )

  /** طلبٌ يُقبل أو يُهمَل — والإهمال حذفٌ لا حالة. */
  .post("/requests/:id/accept", zValidator("param", byId), async (c) =>
    c.json(await circle.acceptFriend(me(c), c.req.valid("param").id)),
  )

  .post("/requests/:id/ignore", zValidator("param", byId), async (c) =>
    c.json(await circle.ignoreFriend(me(c), c.req.valid("param").id)),
  )

  /** طلب صداقة إلى من يجمعك به صديقٌ مشترك. */
  .post("/:id/request", zValidator("param", byId), async (c) =>
    c.json(await circle.requestFriend(me(c), c.req.valid("param").id)),
  )

  .delete("/:id", zValidator("param", byId), async (c) =>
    c.json(await circle.removeFriend(me(c), c.req.valid("param").id)),
  )

  .put(
    "/:id/group",
    zValidator("param", byId),
    zValidator("json", friendGroupInput),
    async (c) =>
      c.json(
        await circle.setFriendGroup(
          me(c),
          c.req.valid("param").id,
          c.req.valid("json").groupId ?? null,
        ),
      ),
  )

  .post("/:id/block", zValidator("param", byId), async (c) =>
    c.json(await circle.blockUser(me(c), c.req.valid("param").id)),
  )

  .delete("/:id/block", zValidator("param", byId), async (c) =>
    c.json(await circle.unblockUser(me(c), c.req.valid("param").id)),
  );

export const userRoutes = new Hono()
  .use("*", requireAuth)

  .get("/:id", zValidator("param", byId), async (c) =>
    c.json(await circle.userProfile(me(c), c.req.valid("param").id)),
  )

  .get(
    "/:id/moments",
    zValidator("param", byId),
    zValidator("query", pageQuery),
    async (c) => {
      const { id } = c.req.valid("param");
      // الملفّ يُفتح أولاً: من لا يُسمح له برؤيته لا يُعطى لحظاته.
      await circle.userProfile(me(c), id);
      return c.json(await feed.momentsOf(me(c), id, c.req.valid("query")));
    },
  );
