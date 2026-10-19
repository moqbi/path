import { Hono } from "hono";
import { z } from "zod";
import { cuid } from "@athar/shared";
import { zValidator } from "../../lib/validate";
import { requireAuth, me } from "../../middleware/auth";
import { buyPack, friendPacks, giftPack, packs } from "../../services/stickers";

const byId = z.object({ id: cuid });

/** مجموعاتُ الملصقات بملصقاتها (القاعدة ٢٩١) — والإرسالُ مع التعليق والرسالة. */
export const stickerRoutes = new Hono()
  .use("*", requireAuth)
  .get("/", async (c) => c.json(await packs(me(c))))
  // شراءُ مجموعةٍ مدفوعة بالنقاط (القاعدة ٢٩٤).
  // ما يملكه الصديقُ منها، ثمّ إهداؤها له (القاعدة ٢٩٨).
  .get("/owned/:id", zValidator("param", byId), async (c) => c.json(await friendPacks(me(c), c.req.valid("param").id)))
  .post(
    "/packs/:id/gift",
    zValidator("param", byId),
    zValidator("json", z.object({ to: cuid })),
    async (c) => c.json(await giftPack(me(c), c.req.valid("param").id, c.req.valid("json").to)),
  )
  .post("/packs/:id/buy", zValidator("param", byId), async (c) => c.json(await buyPack(me(c), c.req.valid("param").id)));
