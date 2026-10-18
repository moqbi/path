import { Hono } from "hono";
import { requireAuth } from "../../middleware/auth";
import { packs } from "../../services/stickers";

/** مجموعاتُ الملصقات بملصقاتها (القاعدة ٢٩١) — والإرسالُ مع التعليق والرسالة. */
export const stickerRoutes = new Hono()
  .use("*", requireAuth)
  .get("/", async (c) => c.json(await packs()));
