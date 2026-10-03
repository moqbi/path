import { Hono } from "hono";
import { cuid } from "@athar/shared";
import { z } from "zod";
import { zValidator } from "../../lib/validate";
import { requireActive, requireAuth, me } from "../../middleware/auth";
import { rateLimitUser } from "../../middleware/rate-limit";
import * as memories from "../../services/memories";
import * as recap from "../../services/recap";

const byId = z.object({ id: cuid });
const byYear = z.object({ year: z.coerce.number().int().min(2024).max(2100) });
/** جمهورُ المشاركة كجمهور اللحظة: الدائرة، أو تصنيف، أو أشخاصٌ بأعيانهم. */
const shareInput = z.object({
  audience: z.enum(["CIRCLE", "GROUP", "PICKED"]).default("CIRCLE"),
  audienceGroupId: cuid.optional(),
  viewers: z.array(cuid).max(150).optional(),
});

/**
 * الذكرياتُ ومناسباتُ الصداقة وآثرك السنويّ (القاعدة ٢٣٥) — لصاحبها وحده:
 * لا معرّفَ حسابٍ في أيّ مسار، فلا يُسأل عن ذكريات غيره أصلاً.
 */
export const memoryRoutes = new Hono()
  .use("*", requireAuth)

  /** بطاقةُ اليوم أعلى اللحظات. */
  .get("/today", async (c) => c.json(await memories.today(me(c))))

  /** «×»: تُطوى لليوم وتعود غداً بما يقع فيه. */
  .post("/today/dismiss", async (c) => c.json(await memories.dismiss(me(c))))

  /** «شاركها»: نسخةٌ باسم صاحبها لمن يختار. */
  .post(
    "/:id/share",
    requireActive,
    rateLimitUser(30, 3600),
    zValidator("param", byId),
    zValidator("json", shareInput),
    async (c) => c.json(await memories.shareMemory(me(c), c.req.valid("param").id, c.req.valid("json")), 201),
  );

export const recapRoutes = new Hono()
  .use("*", requireAuth)

  /** أفي النافذة ملخّصٌ لهذا الحساب؟ — لبابه في «أنا». */
  .get("/", async (c) => c.json(await recap.recapStatus(me(c))))

  .get("/:year", zValidator("param", byYear), async (c) =>
    c.json({ recap: await recap.recapFor(me(c), c.req.valid("param").year) }),
  )

  .post(
    "/:year/share",
    requireActive,
    rateLimitUser(10, 3600),
    zValidator("param", byYear),
    zValidator("json", shareInput),
    async (c) => c.json(await recap.shareRecap(me(c), c.req.valid("param").year, c.req.valid("json")), 201),
  );
