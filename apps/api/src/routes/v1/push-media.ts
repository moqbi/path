import { Hono } from "hono";
import { pushImageBytes, pushImageValid } from "../../services/push-image";

/**
 * صورةُ التنبيه الموقَّعة (القاعدة ٣٨٨) — بلا جلسة: يجلبها نظامُ الجهاز لا التطبيق. التوقيعُ
 * والمدّةُ هما الحارس، وما لا يطابقهما «غير موجود» (القاعدة ٢٣ب).
 */
export const pushMediaRoutes = new Hono().get("/:id", async (c) => {
  const id = c.req.param("id");
  const exp = Number(c.req.query("e"));
  const signature = c.req.query("s") ?? "";
  if (!/^[a-z0-9]{20,40}$/.test(id) || !pushImageValid(id, exp, signature)) {
    return c.json({ error: "غير موجود" }, 404);
  }
  const bytes = await pushImageBytes(id).catch(() => null);
  if (!bytes) return c.json({ error: "غير موجود" }, 404);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
