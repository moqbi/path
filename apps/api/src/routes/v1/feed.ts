import { Hono } from "hono";
import {
  commentInput,
  cuid,
  markInput,
  momentInput,
  pageQuery,
  reactionInput,
} from "@athar/shared";
import { z } from "zod";
import { zValidator } from "../../lib/validate";
import { requireAuth, me } from "../../middleware/auth";
import * as feed from "../../services/feed";
import * as moments from "../../services/moments";

const byId = z.object({ id: cuid });

/** الخط الزمني واللحظة. كلّها خلف التوكن — لا قراءة بلا حساب. */
export const feedRoutes = new Hono()
  .use("*", requireAuth)

  .get("/", zValidator("query", pageQuery), async (c) =>
    c.json(await feed.timeline(me(c), c.req.valid("query"))),
  )

  .get("/private", zValidator("query", pageQuery), async (c) =>
    c.json(await feed.privateTimeline(me(c), c.req.valid("query"))),
  )

  /** «آثارنا»: ما يجمعك بصديقٍ بعينه — ومن ليس في دائرتك لا أثرَ معه. */
  .get("/together/:id", zValidator("param", byId), async (c) =>
    c.json(await feed.togetherTimeline(me(c), c.req.valid("param").id)),
  );

/**
 * اللحظة: قراءةً ونشراً وحذفاً وتفاعلاً.
 *
 * الترتيب مقصود: `/mark` قبل `/:id` — وإلا ابتلعه المعامل وصار «mark»
 * معرّفَ لحظة.
 */
export const momentRoutes = new Hono()
  .use("*", requireAuth)

  .post("/", zValidator("json", momentInput), async (c) =>
    c.json(await moments.createMoment(me(c), c.req.valid("json")), 201),
  )

  /** أغنيةٌ برابطها — العنوان يُقرأ من الرابط لا يُكتب. */
  .post("/music", zValidator("json", z.object({ url: z.string().url().max(500) })), async (c) =>
    c.json(await moments.postMusic(me(c), c.req.valid("json").url), 201),
  )

  /** «نمت» و«صحيت»: بلا متنٍ وبلا جمهورٍ يُختار. */
  .post("/mark", zValidator("json", markInput), async (c) =>
    c.json(await moments.postMark(me(c), c.req.valid("json").kind), 201),
  )

  .get("/:id", zValidator("param", byId), async (c) =>
    c.json({ moment: await feed.momentById(me(c), c.req.valid("param").id) }),
  )

  .delete("/:id", zValidator("param", byId), async (c) =>
    c.json(await moments.deleteMoment(me(c), c.req.valid("param").id)),
  )

  .post("/:id/seen", zValidator("param", byId), async (c) =>
    c.json(await moments.markSeen(me(c), c.req.valid("param").id)),
  )

  .post(
    "/:id/react",
    zValidator("param", byId),
    zValidator("json", reactionInput),
    async (c) => c.json(await moments.react(me(c), c.req.valid("param").id, c.req.valid("json"))),
  )

  .post(
    "/:id/comments",
    zValidator("param", byId),
    zValidator("json", commentInput),
    async (c) =>
      c.json(
        { comment: await moments.addComment(me(c), c.req.valid("param").id, c.req.valid("json").body) },
        201,
      ),
  );

/** التعليق يُحذف بمعرّفه لا بمعرّف لحظته: كاتبه أو صاحب اللحظة. */
export const commentRoutes = new Hono()
  .use("*", requireAuth)

  .delete("/:id", zValidator("param", byId), async (c) =>
    c.json(await moments.deleteComment(me(c), c.req.valid("param").id)),
  );
