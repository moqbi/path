import { Hono } from "hono";
import { z } from "zod";
import { cuid } from "@athar/shared";
import { zValidator } from "../../lib/validate";
import { rateLimitUser } from "../../middleware/rate-limit";
import { requireAuth, requireAdmin, requireModerator, me } from "../../middleware/auth";
import * as feed from "../../services/feed";
import * as reports from "../../services/reports";

const reportInput = z.object({
  target: z.enum(["MOMENT", "STORY", "MESSAGE", "USER"]),
  targetId: cuid,
  reason: z.enum(["SPAM", "HATE", "SEXUAL", "VIOLENCE", "SELF_HARM", "OTHER"]),
  note: z.string().trim().max(500).optional(),
});

/** بابُ المستخدم: بلاغٌ على لحظة أو قصة أو رسالة أو شخص. */
export const reportRoutes = new Hono()
  .use("*", requireAuth)
  // والبلاغُ عشرون في الساعة: من يُبلّغ أكثر يُبلّغ بلا قراءة.
  .use("/", rateLimitUser(20, 3600))

  .post("/", zValidator("json", reportInput), async (c) =>
    c.json(await reports.open(me(c), c.req.valid("json")), 201),
  );

/**
 * بابُ اللوحة: البلاغات وقرارها، وقائمة الكلمات.
 *
 * الدور يُفحص في المسار لا في العرض — إخفاء الرابط ليس حماية.
 */
export const moderationRoutes = new Hono()
  .use("*", requireAuth, requireAdmin)

  .get(
    "/reports",
    zValidator("query", z.object({ state: z.enum(["OPEN", "KEPT", "REMOVED"]).optional() })),
    async (c) => c.json(await reports.list(c.req.valid("query").state ?? "OPEN")),
  )

  .post(
    "/reports/:id",
    zValidator("param", z.object({ id: cuid })),
    zValidator("json", z.object({ verdict: z.enum(["KEPT", "REMOVED"]) })),
    async (c) =>
      c.json(
        await reports.decide(me(c), c.req.valid("param").id, c.req.valid("json").verdict),
      ),
  )

  .get("/banned-words", async (c) => c.json(await reports.words()))

  .post(
    "/banned-words",
    zValidator(
      "json",
      z.object({
        word: z.string().trim().min(2).max(60),
        hard: z.boolean().default(true),
        note: z.string().trim().max(200).optional(),
      }),
    ),
    async (c) => {
      const input = c.req.valid("json");
      return c.json(await reports.addWord(input.word, input.hard, input.note), 201);
    },
  )

  .delete("/banned-words/:id", zValidator("param", z.object({ id: cuid })), async (c) =>
    c.json(await reports.dropWord(c.req.valid("param").id)),
  );

/**
 * بابُ الإشراف على المحتوى — لمن مُنح `canModerate` وللمالك.
 *
 * منفصلٌ عن `moderationRoutes` قصداً: تلك للمالك وحدها (الكلمات
 * الممنوعة وقرار البلاغ)، وهذه لمن يُنظر في البلاغات. وصلاحيةٌ واحدة
 * تفتح البابين معاً تعطي مَن يُراجع البلاغاتِ مفاتيحَ اللوحة كلّها.
 */
export const contentRoutes = new Hono()
  .use("*", requireAuth, requireModerator)

  /* لحظات حسابٍ بعينه بلا صداقة — للتأكّد من بلاغ، لا للتصفّح. */
  .get(
    "/users/:id/moments",
    zValidator("param", z.object({ id: cuid })),
    zValidator("query", z.object({ cursor: cuid.optional(), limit: z.coerce.number().int().min(1).max(50).default(20) })),
    async (c) => {
      const { cursor, limit } = c.req.valid("query");
      return c.json(
        await feed.moderatedMomentsOf(me(c), c.req.valid("param").id, { cursor, limit }),
      );
    },
  )

  .delete("/moments/:id", zValidator("param", z.object({ id: cuid })), async (c) =>
    c.json(await reports.removeMoment(me(c), c.req.valid("param").id)),
  )

  /* السجلّ: من حذف ماذا ومتى. */
  .get("/logs", async (c) => c.json(await reports.logs()));
