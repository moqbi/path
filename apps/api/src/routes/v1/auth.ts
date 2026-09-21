import { Hono } from "hono";
import { zValidator } from "../../lib/validate";
import {
  forgotInput,
  loginInput,
  refreshInput,
  registerInput,
  oauthInput,
  resetInput,
  verifyInput,
} from "@athar/shared";
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
  .use("/oauth", rateLimit(10, 60))
  .use("/refresh", rateLimit(30, 60))
  // وبابُ البريد أهدأ منها كلّها: ثلاثٌ في الدقيقة، فلا يصير مِرشّة بريد.
  .use("/forgot", rateLimit(3, 60))
  .use("/reset", rateLimit(5, 60))

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

  /**
   * الدخول بمزوّد — والرمزُ يُتحقَّق منه في الخادم لا يُصدَّق كما جاء:
   * من يرسل طلباً بيده يكتب أيَّ معرّفٍ فيدخل حسابَ غيره.
   */
  .post("/oauth", zValidator("json", oauthInput), async (c) => {
    const input = c.req.valid("json");
    const device = c.req.header("user-agent");
    return c.json(await auth.oauth({ ...input, device }));
  })

  .post("/refresh", zValidator("json", refreshInput), async (c) => {
    const { refreshToken } = c.req.valid("json");
    return c.json(await auth.refresh(refreshToken, c.req.header("user-agent")));
  })

  /**
   * «نسيت كلمة المرور» — والجواب واحدٌ وُجد الحساب أو لم يوجد، وإلّا
   * صار البابُ وسيلةً لمعرفة من عندنا حساب.
   */
  .post("/forgot", zValidator("json", forgotInput), async (c) =>
    c.json(await auth.forgot(c.req.valid("json").email)),
  )

  .post("/reset", zValidator("json", resetInput), async (c) =>
    c.json(await auth.resetPassword(c.req.valid("json"))),
  )

  .post("/verify", zValidator("json", verifyInput), async (c) =>
    c.json(await auth.verifyEmail(c.req.valid("json").token)),
  )

  .post("/logout", zValidator("json", refreshInput), async (c) => {
    await auth.logout(c.req.valid("json").refreshToken);
    return c.json({ ok: true });
  })

  .post("/logout-all", requireAuth, async (c) => {
    await auth.logoutAll(me(c));
    return c.json({ ok: true });
  })

  .get("/me", requireAuth, async (c) => c.json({ user: await auth.profile(me(c)) }));
