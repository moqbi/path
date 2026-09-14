import { Hono } from "hono";
import { zValidator } from "../../lib/validate";
import { loginInput, refreshInput, registerInput } from "@athar/shared";
import * as auth from "../../services/auth";
import { requireAuth, me } from "../../middleware/auth";
import { rateLimit } from "../../middleware/rate-limit";

/**
 * مسارات الحساب.
 *
 * المسار يتحقّق ويستدعي — لا منطق هنا. المنطق في `services/`، فيُقرأ
 * ويُختبر بلا خادمٍ يُشغَّل، ويُستعمل من مكانٍ آخر بلا نسخ.
 */
export const authRoutes = new Hono()
  // الدخول والتسجيل أهدأ من غيرهما: خمس محاولات في الدقيقة لكل عنوان.
  .use("/register", rateLimit(5, 60))
  .use("/login", rateLimit(5, 60))
  .use("/refresh", rateLimit(30, 60))

  .post("/register", zValidator("json", registerInput), async (c) => {
    const input = c.req.valid("json");
    const device = c.req.header("user-agent");
    return c.json(await auth.register({ ...input, device }), 201);
  })

  .post("/login", zValidator("json", loginInput), async (c) => {
    const input = c.req.valid("json");
    const device = c.req.header("user-agent");
    return c.json(await auth.login({ ...input, device }));
  })

  .post("/refresh", zValidator("json", refreshInput), async (c) => {
    const { refreshToken } = c.req.valid("json");
    return c.json(await auth.refresh(refreshToken, c.req.header("user-agent")));
  })

  .post("/logout", zValidator("json", refreshInput), async (c) => {
    await auth.logout(c.req.valid("json").refreshToken);
    return c.json({ ok: true });
  })

  .post("/logout-all", requireAuth, async (c) => {
    await auth.logoutAll(me(c));
    return c.json({ ok: true });
  })

  .get("/me", requireAuth, async (c) => c.json({ user: await auth.profile(me(c)) }));
