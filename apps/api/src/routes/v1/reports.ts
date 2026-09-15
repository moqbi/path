import { Hono } from "hono";
import { z } from "zod";
import { cuid } from "@athar/shared";
import { zValidator } from "../../lib/validate";
import { requireAuth, requireAdmin, me } from "../../middleware/auth";
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
