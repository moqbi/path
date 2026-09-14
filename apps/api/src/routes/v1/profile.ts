import { Hono } from "hono";
import { coverInput, emailChangeInput, pageQuery, privacyInput, profileInput } from "@athar/shared";
import { zValidator } from "../../lib/validate";
import { requireAuth, me } from "../../middleware/auth";
import * as profile from "../../services/profile";
import * as feed from "../../services/feed";

/**
 * حسابي.
 *
 * `userId` من التوكن وحده: لا مسار هنا يقبل معرّف صاحبٍ في جسدٍ أو
 * استعلام، فلا يُحرَّر ملفُّ غيرك بتبديل رقم.
 */
export const profileRoutes = new Hono()
  .use("*", requireAuth)

  .get("/", async (c) => c.json({ user: await profile.me(me(c)) }))

  /** أرقام «أنا» — تُقرأ مرّةً مع الشاشة لا مع كل لحظة. */
  .get("/stats", async (c) => c.json(await profile.stats(me(c))))

  /** لحظاتي أنا — بلا شرط رؤية: صاحبها يراها كلها. */
  .get("/moments", zValidator("query", pageQuery), async (c) =>
    c.json(await feed.momentsOf(me(c), me(c), c.req.valid("query"))),
  )

  .patch("/", zValidator("json", profileInput), async (c) =>
    c.json({ user: await profile.saveProfile(me(c), c.req.valid("json")) }),
  )

  /** البريد وحده خلف كلمة المرور: تغييرُه نقلٌ للحساب. */
  .put("/email", zValidator("json", emailChangeInput), async (c) =>
    c.json({ user: await profile.changeEmail(me(c), c.req.valid("json")) }),
  )

  .put("/privacy", zValidator("json", privacyInput), async (c) =>
    c.json(await profile.savePrivacy(me(c), c.req.valid("json"))),
  )

  .put("/cover", zValidator("json", coverInput), async (c) =>
    c.json(await profile.setCoverPosition(me(c), c.req.valid("json").y)),
  )

  .delete("/cover", async (c) => c.json(await profile.clearCover(me(c))));
