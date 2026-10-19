import { Hono } from "hono";
import { z } from "zod";
import { cuid, storyReactInput } from "@athar/shared";
import { zValidator } from "../../lib/validate";
import { requireActive, requireAuth, me } from "../../middleware/auth";
import { rateLimitUser } from "../../middleware/rate-limit";
import * as notes from "../../services/notes";
import { previewUrl, searchTracks, topTracks } from "../../services/music";

const byId = z.object({ id: cuid });

const noteInput = z.object({
  text: z.string().max(200).optional(),
  trackId: z.string().regex(/^\d{1,15}$/).optional(),
  trackStart: z.number().int().min(0).max(30).optional(),
  trackSeconds: z.number().int().min(1).max(30).optional(),
  trackFull: z.boolean().optional(),
  groupId: cuid.nullable().optional(),
});

/** النوت (القاعدة ٢٦٩). */
export const noteRoutes = new Hono()
  .use("*", requireAuth)
  .get("/", async (c) => c.json({ notes: await notes.list(me(c)) }))
  // ثلاثون في الساعة: نوتٌ تُبدَّل لا تُنشر سيلاً.
  .post("/", requireActive, rateLimitUser(30, 3600), zValidator("json", noteInput), async (c) =>
    c.json(await notes.post(me(c), c.req.valid("json")), 201),
  )
  .delete("/mine", async (c) => c.json(await notes.removeMine(me(c))))
  .get("/:id/audio", rateLimitUser(120, 3600), zValidator("param", byId), async (c) =>
    c.json(await notes.audio(me(c), c.req.valid("param").id)),
  )
  .get("/:id/viewers", zValidator("param", byId), async (c) =>
    c.json({ viewers: await notes.viewers(me(c), c.req.valid("param").id) }),
  )
  .post(
    "/:id/seen",
    zValidator("param", byId),
    zValidator("json", z.object({ listened: z.boolean().optional() })),
    async (c) => c.json(await notes.see(me(c), c.req.valid("param").id, Boolean(c.req.valid("json").listened))),
  )
  .post("/:id/react", requireActive, rateLimitUser(120, 3600), zValidator("param", byId), zValidator("json", storyReactInput), async (c) =>
    c.json(await notes.react(me(c), c.req.valid("param").id, c.req.valid("json").kind)),
  );

/**
 * الأغاني من دِيزر عبر خادمنا (القاعدة ٢٦٩): ثلاثون بحثاً في الدقيقة لكل حساب —
 * البحثُ يُرسَل مع كل حرفٍ مؤجَّلاً، والحدُّ يحرس واجهتهم من حسابٍ واحد.
 */
export const musicRoutes = new Hono()
  .use("*", requireAuth)
  .get("/top", rateLimitUser(30, 60), async (c) => c.json({ tracks: await topTracks() }))
  .get("/search", rateLimitUser(30, 60), async (c) =>
    c.json({ tracks: await searchTracks(c.req.query("q") ?? "") }),
  )
  // معاينةُ أغنيةٍ قبل اختيارها — لشريط القصّ.
  .get("/:id/preview", rateLimitUser(60, 60), zValidator("param", z.object({ id: z.string().regex(/^\d{1,15}$/) })), async (c) =>
    c.json({ url: await previewUrl(c.req.valid("param").id) }),
  );
