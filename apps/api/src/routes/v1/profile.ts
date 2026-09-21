import { Hono } from "hono";
import { z } from "zod";
import {
  coverInput,
  cuid,
  emailChangeInput,
  notifyInput,
  pageQuery,
  passwordChangeInput,
  privacyInput,
  profileInput,
} from "@athar/shared";
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

  /** التنبيهات: ما يصل الجهاز ومتى يسكت. */
  .put("/notifications", zValidator("json", notifyInput), async (c) =>
    c.json(await profile.saveNotifications(me(c), c.req.valid("json"))),
  )

  /** كلمة المرور — القديمةُ شرط، كالبريد وكالحذف. */
  .put("/password", zValidator("json", passwordChangeInput), async (c) =>
    c.json(await profile.changePassword(me(c), c.req.valid("json"))),
  )

  .put("/cover", zValidator("json", coverInput), async (c) =>
    c.json(await profile.setCoverPosition(me(c), c.req.valid("json").y)),
  )

  .delete("/cover", async (c) => c.json(await profile.clearCover(me(c))))

  /** صورة العرض والغلاف — الملف مُعتمَدٌ قبل أن يصل هنا. */
  .put(
    "/avatar",
    zValidator("json", z.object({ mediaId: cuid })),
    async (c) => c.json(await profile.setPicture(me(c), "avatar", c.req.valid("json").mediaId)),
  )

  .put(
    "/cover/image",
    zValidator("json", z.object({ mediaId: cuid })),
    async (c) => c.json(await profile.setPicture(me(c), "cover", c.req.valid("json").mediaId)),
  )

  /** الدعم داخل التطبيق: الرسالة تُحفظ والردّ يُقرأ في مكانه. */
  .get("/support", async (c) => c.json(await profile.tickets(me(c))))

  .post(
    "/support",
    zValidator("json", z.object({ body: z.string().trim().min(5).max(1200) })),
    async (c) => c.json(await profile.openTicket(me(c), c.req.valid("json").body), 201),
  )

  /** حذف الحساب — بكلمة المرور، وآخر ما في الملف. */
  .post(
    "/delete",
    zValidator("json", z.object({ password: z.string().min(1).max(200) })),
    async (c) => c.json(await profile.deleteAccount(me(c), c.req.valid("json").password)),
  );
