import { Hono } from "hono";
import { z } from "zod";
import {
  coverInput,
  cuid,
  emailChangeInput,
  notifyInput,
  pageQuery,
  deviceInput,
  passwordChangeInput,
  privacyInput,
  profileInput,
} from "@athar/shared";
import { badRequest } from "../../lib/errors";
import { zValidator } from "../../lib/validate";
import { requireAuth, me } from "../../middleware/auth";
import * as profile from "../../services/profile";
import * as feed from "../../services/feed";
import * as auth from "../../services/auth";
import * as push from "../../services/push";
import * as oauth from "../../services/oauth";

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

  /**
   * تسجيلُ جهازٍ للتنبيهات ونزعُه.
   *
   * الرمزُ من Expo، ويُسجَّل لصاحب الجلسة — وينتقل إليه إن كان لغيره:
   * جهازٌ واحد قد يُسجَّل عليه حسابان بالتتابع.
   */
  .put("/devices", zValidator("json", deviceInput), async (c) => {
    const { token, platform } = c.req.valid("json");
    return c.json(await push.registerDevice(me(c), token, platform));
  })

  /** تنبيهٌ تجريبيّ إلى أجهزتي — يردّ جواب الخدمة لكل جهاز. */
  .post("/devices/test", async (c) => c.json(await push.testPush(me(c))))

  .delete("/devices", zValidator("json", z.object({ token: z.string().min(10).max(300) })), async (c) =>
    c.json(await push.forgetDevice(me(c), c.req.valid("json").token)),
  )

  /** ما رُبط بحسابك من مزوّدين، وفكُّ أحدها. */
  .get("/identities", async (c) => c.json({ identities: await oauth.myIdentities(me(c)) }))

  .delete("/identities/:id", async (c) =>
    c.json(await oauth.unlinkIdentity(me(c), c.req.param("id"))),
  )

  /** إعادةُ إرسال رسالة تأكيد البريد. */
  .post("/verify/send", async (c) => c.json(await auth.resendVerify(me(c))))

  /** كلمة المرور — القديمةُ شرط، كالبريد وكالحذف. */
  .put("/password", zValidator("json", passwordChangeInput), async (c) =>
    c.json(await profile.changePassword(me(c), c.req.valid("json"))),
  )

  .put("/cover", zValidator("json", coverInput), async (c) =>
    c.json(await profile.setCoverPosition(me(c), c.req.valid("json"))),
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

  /*
    الرسالة بسببها ومرفقاتها: `multipart/form-data` (نصٌّ وسببٌ وحتى ثلاث صور)،
    و`json` يبقى لنسخةٍ قديمة من التطبيق ما زالت ترسل النصَّ وحده.
  */
  .post("/support", async (c) => {
    const type = c.req.header("content-type") ?? "";
    if (type.includes("multipart/form-data")) {
      const form = await c.req.parseBody({ all: true });
      const raw = form["files"];
      const files = (Array.isArray(raw) ? raw : raw ? [raw] : []).filter(
        (entry): entry is File => typeof entry !== "string",
      );
      const topic = typeof form["topic"] === "string" && form["topic"] ? form["topic"] : null;
      const body = typeof form["body"] === "string" ? form["body"] : "";
      return c.json(await profile.openTicket(me(c), body, topic, files), 201);
    }
    const parsed = z
      .object({ body: z.string().trim().min(5).max(1200), topic: z.string().max(20).optional() })
      .safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) throw badRequest("اكتب رسالتك");
    return c.json(await profile.openTicket(me(c), parsed.data.body, parsed.data.topic ?? null), 201);
  })

  /** الانضمامُ إلى فريق التجربة — نموذجُ `/beta` في الموقع نفسه. */
  .post(
    "/beta",
    zValidator(
      "json",
      z.object({
        email: z.string().trim().email().max(200),
        device: z.enum(["iPhone", "Android"]),
        note: z.string().max(600).optional(),
      }),
    ),
    async (c) => c.json(await profile.joinBeta(me(c), c.req.valid("json")), 201),
  )

  /**
   * حذف الحساب — بكلمة المرور، أو بالبريد لمن لا كلمةَ له، أو بآبل من
   * جديد لمن رُبط بها (ومعه رمزُ تفويضٍ يُلغى به الربط). وآخر ما في الملف.
   */
  .post(
    "/delete",
    zValidator(
      "json",
      z
        .object({
          password: z.string().min(1).max(200).optional(),
          apple: z
            .object({ idToken: z.string().min(20).max(4000), code: z.string().min(10).max(1000) })
            .optional(),
        })
        .refine((body) => body.password || body.apple, { message: "التأكيد مطلوب" }),
    ),
    async (c) => c.json(await profile.deleteAccount(me(c), c.req.valid("json"))),
  );
