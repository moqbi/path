import { Hono } from "hono";
import { z } from "zod";
import { cuid, messageInput, pageQuery } from "@athar/shared";
import { zValidator } from "../../lib/validate";
import { requireActive, requireAuth, me } from "../../middleware/auth";
import { pushBoth } from "../../lib/hub";
import * as dm from "../../services/dm";

const byId = z.object({ id: cuid });

const sendInput = z.object({
  kind: z.enum(["TEXT", "VOICE", "PHOTO"]).default("TEXT"),
  body: z.string().trim().max(2000).optional(),
  mediaId: cuid.optional(),
  seconds: z.coerce.number().int().min(1).max(600).optional(),
});

/**
 * المحادثات.
 *
 * كل مسارٍ يمرّ على إثبات الطرف في الخدمة لا هنا، ثم يُدفع الحدث إلى
 * الطرفين: الطرف الآخر ليسمع، والمرسل ليُزامن أجهزته الأخرى.
 */
export const dmRoutes = new Hono()
  .use("*", requireAuth)

  .get("/", async (c) => c.json(await dm.list(me(c))))
  .get("/unread", async (c) => c.json(await dm.unreadCount(me(c))))

  /** فتح محادثةٍ مع صديق — تُنشأ إن لم تكن. */
  .post("/with/:id", zValidator("param", byId), async (c) =>
    c.json(await dm.open(me(c), c.req.valid("param").id), 201),
  )

  .post("/delivered", async (c) => c.json(await dm.markDelivered(me(c))))

  .get(
    "/:id",
    zValidator("param", byId),
    zValidator("query", pageQuery),
    async (c) => c.json(await dm.thread(me(c), c.req.valid("param").id, c.req.valid("query"))),
  )

  .post("/:id/messages", zValidator("param", byId), zValidator("json", sendInput), async (c) => {
    const sent = await dm.send(me(c), c.req.valid("param").id, c.req.valid("json"));
    pushBoth(me(c), sent.to, "message", {
      conversationId: sent.conversationId,
      message: sent.message,
    });
    return c.json({ message: sent.message }, 201);
  })

  .post("/:id/read", zValidator("param", byId), async (c) => {
    const result = await dm.markRead(me(c), c.req.valid("param").id);
    if (result.read > 0) {
      pushBoth(me(c), result.to, "read", { conversationId: result.conversationId, by: me(c) });
    }
    return c.json({ read: result.read });
  })

  .delete("/:id", zValidator("param", byId), async (c) => {
    const result = await dm.remove(me(c), c.req.valid("param").id);
    pushBoth(me(c), result.to, "conversation:gone", { conversationId: result.conversationId });
    return c.json({ ok: true });
  });

/** الرسالة تُعدَّل بمعرّفها لا بمعرّف محادثتها. */
export const messageRoutes = new Hono()
  /*
    والكتابة تُغلق في وجه الموقوف مؤقّتاً (`requireActive`) — والقراءة
    تبقى: من مُنع من النشر لا يُمنع من رؤية ما قاله له الناس، ولا من
    قراءة سبب وقفه.
  */
  .use("*", requireAuth, requireActive)

  .patch("/:id", zValidator("param", byId), zValidator("json", messageInput), async (c) => {
    const edited = await dm.edit(me(c), c.req.valid("param").id, c.req.valid("json").body);
    pushBoth(me(c), edited.to, "message:edited", {
      conversationId: edited.conversationId,
      message: edited.message,
    });
    return c.json({ message: edited.message });
  });
