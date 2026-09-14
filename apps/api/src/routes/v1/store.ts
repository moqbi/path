import { Hono } from "hono";
import { requireAuth, me } from "../../middleware/auth";
import * as store from "../../services/store";

export const storeRoutes = new Hono()
  .use("*", requireAuth)
  .get("/", async (c) => c.json(await store.storefront(me(c))))
  .get("/mine", async (c) => c.json({ items: await store.myItems(me(c)) }));
