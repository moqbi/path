import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { corsOrigins, env, isProd } from "./env";
import { secureHeaders } from "./middleware/secure";
import { authRoutes } from "./routes/v1/auth";

/**
 * خادم أثر.
 *
 * Hono على Node: صغيرٌ وسريع ويعمل داخل حاوية بلا تخصيصٍ لمزوّد — وهو
 * المقصود، فالوجهة VPS لا منصّةٌ بعينها.
 *
 * الترتيب مقصود: رؤوس الأمان أولاً، ثم CORS بقائمةٍ محدّدة، ثم السجلّ،
 * ثم المسارات. ومعالج الخطأ في الآخر يمنع تسرّب الأثر إلى المستخدم.
 */
const app = new Hono();

app.use("*", secureHeaders);
app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin) return undefined;
      // الموبايل يرسل بلا أصل، والويب يرسل أصله — والقائمة محدّدة في الإنتاج.
      return corsOrigins.includes(origin) ? origin : undefined;
    },
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Authorization", "Content-Type"],
    maxAge: 600,
    credentials: false,
  }),
);
if (!isProd) app.use("*", logger());

app.get("/health", (c) => c.json({ ok: true, at: new Date().toISOString() }));

app.route("/v1/auth", authRoutes);

app.notFound((c) => c.json({ error: "المسار غير موجود" }, 404));

app.onError((error, c) => {
  if (error instanceof HTTPException) {
    return c.json({ error: error.message }, error.status);
  }
  // الأثر إلى السجلّ لا إلى المستخدم: رسائل النظام تصف الداخل.
  console.error("✗", error);
  return c.json({ error: "حدث خطأ غير متوقّع" }, 500);
});

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`أثر · الخادم على ${info.port} · ${env.NODE_ENV}`);
});

export type AppType = typeof app;
