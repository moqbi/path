import { Hono } from "hono";
import { z } from "zod";
import { cuid, statusCommentInput, storyReactInput } from "@athar/shared";
import { zValidator } from "../../lib/validate";
import { requireActive, requireAuth, me } from "../../middleware/auth";
import { rateLimitUser } from "../../middleware/rate-limit";
import * as notes from "../../services/notes";
import * as floats from "../../services/floats";
import { previewUrl, searchTracks, topTracks } from "../../services/music";
import * as giphy from "../../services/giphy";

const byId = z.object({ id: cuid });

const noteInput = z.object({
  text: z.string().max(200).optional(),
  // `am:` أغنيةٌ من Apple Music (القاعدة ٣٠٤).
  trackId: z.string().regex(/^(am:)?\d{1,15}$/).optional(),
  trackStart: z.number().int().min(0).max(30).optional(),
  trackSeconds: z.number().int().min(1).max(30).optional(),
  trackFull: z.boolean().optional(),
  // صورةٌ متحرّكة من GIPHY (القاعدة ٣١٥).
  gifId: z.string().regex(giphy.GIF_ID).optional(),
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
  )
  /** ما يطفو على النوت (القاعدة ٣٤٤). */
  .get("/:id/floats", zValidator("param", byId), async (c) =>
    c.json(await floats.floats(me(c), { kind: "note", id: c.req.valid("param").id })),
  )
  .post("/:id/comments", requireActive, rateLimitUser(60, 3600), zValidator("param", byId), zValidator("json", statusCommentInput), async (c) =>
    c.json(await floats.comment(me(c), { kind: "note", id: c.req.valid("param").id }, c.req.valid("json").body), 201),
  );

/**
 * الأغاني من دِيزر عبر خادمنا (القاعدة ٢٦٩): ثلاثون بحثاً في الدقيقة لكل حساب —
 * البحثُ يُرسَل مع كل حرفٍ مؤجَّلاً، والحدُّ يحرس واجهتهم من حسابٍ واحد.
 */
export const musicRoutes = new Hono()
  .use("*", requireAuth)
  .get("/top", rateLimitUser(30, 60), async (c) => c.json({ tracks: await topTracks() }))
  // `apple=1` يجمع Apple Music إلى دِيزر — ترسله نسخةُ التطوير وحدها حتى يُعتمد (القاعدة ٣٠٤).
  .get("/search", rateLimitUser(30, 60), async (c) =>
    c.json({ tracks: await searchTracks(c.req.query("q") ?? "", c.req.query("apple") === "1") }),
  )
  // معاينةُ أغنيةٍ قبل اختيارها — لشريط القصّ.
  .get("/:id/preview", rateLimitUser(60, 60), zValidator("param", z.object({ id: z.string().regex(/^(am:)?\d{1,15}$/) })), async (c) =>
    c.json({ url: await previewUrl(c.req.valid("param").id) }),
  );

/**
 * الصورُ المتحرّكة من GIPHY عبر خادمنا (القاعدة ٣١٥): الرائجةُ ثمّ البحث، بحدّ
 * الأغاني نفسه — والبحثُ يُرسَل مؤجَّلاً مع الكتابة.
 */
export const gifRoutes = new Hono()
  .use("*", requireAuth)
  .get("/trending", rateLimitUser(30, 60), async (c) => c.json(await giphy.trending()))
  .get("/search", rateLimitUser(30, 60), async (c) => c.json(await giphy.search(c.req.query("q") ?? "")));
