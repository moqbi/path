import { Hono } from "hono";
import { z } from "zod";
import { cuid } from "@athar/shared";
import { zValidator } from "../../lib/validate";
import { requireAuth, me } from "../../middleware/auth";
import * as store from "../../services/store";

const byId = z.object({ id: cuid });

/**
 * المتجر.
 *
 * كل ثمنٍ يُحسب على الخادم: سعرٌ يأتي من الجهاز ليس سعراً. والخصم
 * والتمليك في معاملةٍ واحدة — الرصيد لا ينقص بلا صنف ولا العكس.
 */
export const storeRoutes = new Hono()
  .use("*", requireAuth)

  .get("/", async (c) => c.json(await store.storefront(me(c))))
  .get("/mine", async (c) => c.json({ items: await store.myItems(me(c)) }))

  // والمدّةُ اختياريّةٌ في الطلب: صنفٌ بلا مُددٍ يُشترى بلا `plan`.
  // والجسمُ يُقرأ بيدنا لا بمدقّق: نسخُ التطبيق القديمة ترسل الطلب بلا جسمٍ
  // أصلاً، ومدقّقُ JSON يردّها بـ٤٠٠ قبل أن يصل الشراء.
  .post("/:id/buy", zValidator("param", byId), async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const plan = z.object({ plan: cuid.optional() }).safeParse(body);
    return c.json(
      await store.buy(me(c), c.req.valid("param").id, plan.success ? plan.data.plan : undefined),
    );
  })

  .post(
    "/:id/gift",
    zValidator("param", byId),
    zValidator("json", z.object({ to: cuid, plan: cuid.optional() })),
    async (c) => {
      const body = c.req.valid("json");
      return c.json(await store.gift(me(c), c.req.valid("param").id, body.to, body.plan));
    },
  )

  .post("/:id/equip", zValidator("param", byId), async (c) =>
    c.json(await store.equip(me(c), c.req.valid("param").id)),
  )

  .post(
    "/unequip",
    zValidator("json", z.object({ kind: z.enum(["FRAME", "BACKGROUND", "CHARM"]) })),
    async (c) => c.json(await store.unequip(me(c), c.req.valid("json").kind)),
  );

/**
 * باقات النقاط.
 *
 * قراءةٌ فقط: الشراء نفسه لا يمرّ بنا — السلع الرقمية تُباع عبر متجر
 * المنصّة وحده، والإيداع يجري حين يصل حدثُ RevenueCat إلى
 * `/v1/webhooks/revenuecat`. فلا باب «اشترِ نقاط» هنا، ولو وُجد لكان
 * بابَ منحٍ مجّانيّ لمن يعرف كيف يرسل طلباً.
 */
export const coinRoutes = new Hono()
  .use("*", requireAuth)
  .get("/packs", async (c) => c.json(await store.coinPacks()));

/** الاشتراك — بابُه منفصلٌ عن المتجر: «آثار+» ليس صنفاً يُشترى. */
export const plusRoutes = new Hono()
  .use("*", requireAuth)

  .post(
    "/",
    zValidator("json", z.object({ plan: z.enum(["MONTHLY", "YEARLY"]) })),
    async (c) => c.json(await store.subscribe(me(c), c.req.valid("json").plan)),
  )

  .delete("/", async (c) => c.json(await store.cancelPlus(me(c))));
