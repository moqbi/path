import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { corsOrigins, env, isProd } from "./env";
import { secureHeaders } from "./middleware/secure";
import { authRoutes } from "./routes/v1/auth";
import { circleRoutes, userRoutes } from "./routes/v1/circle";
import { commentRoutes, feedRoutes, momentRoutes } from "./routes/v1/feed";
import { mediaRoutes } from "./routes/v1/media";
import { notificationRoutes } from "./routes/v1/notifications";
import { profileRoutes } from "./routes/v1/profile";
import { dmRoutes, messageRoutes } from "./routes/v1/dm";
import { mountWs } from "./routes/v1/ws";
import { sweepPending } from "./services/upload";
import { sweepOld } from "./services/dm";
import { plusRoutes, storeRoutes } from "./routes/v1/store";
import { moderationRoutes, reportRoutes } from "./routes/v1/reports";
import { webhookRoutes } from "./routes/v1/webhooks";
import { dripPlusCredit } from "./services/billing";
import { storyRoutes } from "./routes/v1/stories";
import { sweep as sweepStories } from "./services/stories";

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

/**
 * الخطّ الحيّ يشارك الخادم نفسه ومنفذه.
 *
 * خادمٌ ثانٍ للـWebSocket يعني منفذاً ثانياً في الجدار وشهادةً ثانية —
 * والترقية تجري على الاتصال نفسه، فلا داعي لأيّهما.
 */
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

app.use("*", secureHeaders);
app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin) return undefined;
      // الموبايل يرسل بلا أصل، والويب يرسل أصله — والقائمة محدّدة في الإنتاج.
      return corsOrigins.includes(origin) ? origin : undefined;
    },
    // وPUT معها: البريد والخصوصية والغلاف وصورة العرض كلّها `PUT`،
    // فكان المتصفّح يردّ طلبها في الفحص المبدئي قبل أن يصل الخادم.
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Authorization", "Content-Type"],
    maxAge: 600,
    credentials: false,
  }),
);
if (!isProd) app.use("*", logger());

app.get("/health", (c) => c.json({ ok: true, at: new Date().toISOString() }));

/**
 * كنسٌ دوريّ لما لم يُعتمد.
 *
 * كل رابط رفعٍ يُعطى ولا يُستعمل يترك صفّاً معلّقاً ومفتاحاً محجوزاً.
 * الخادم يعيش طويلاً هنا — بخلاف دوالّ الويب — فالكنس مؤقّتٌ على البوت
 * لا عملٌ يُعلَّق على وصول طلب. و`unref` كي لا يمنع المؤقّتُ الخروج.
 */
const SWEEP_MINUTES = 30;
setInterval(
  () => {
    void sweepPending().catch((error) => console.error("✗ كنس المعلّقة", error));
    void sweepOld().catch((error) => console.error("✗ كنس المحادثات", error));
    void sweepStories().catch((error) => console.error("✗ كنس القصص", error));
    void dripPlusCredit().catch((error) => console.error("✗ رصيد أثر+", error));
  },
  SWEEP_MINUTES * 60_000,
).unref();

app.route("/v1/auth", authRoutes);
app.route("/v1/feed", feedRoutes);
app.route("/v1/moments", momentRoutes);
app.route("/v1/comments", commentRoutes);
app.route("/v1/circle", circleRoutes);
app.route("/v1/users", userRoutes);
app.route("/v1/me", profileRoutes);
app.route("/v1/store", storeRoutes);
app.route("/v1/plus", plusRoutes);
app.route("/v1/stories", storyRoutes);
app.route("/v1/media", mediaRoutes);
app.route("/v1/notifications", notificationRoutes);
app.route("/v1/dm", dmRoutes);
app.route("/v1/messages", messageRoutes);
app.route("/v1/reports", reportRoutes);
app.route("/v1/webhooks", webhookRoutes);
/** بابُ اللوحة — الدور يُفحص فيه لا في العرض. */
app.route("/v1/admin", moderationRoutes);

mountWs(app, upgradeWebSocket);

app.notFound((c) => c.json({ error: "المسار غير موجود" }, 404));

app.onError((error, c) => {
  if (error instanceof HTTPException) {
    return c.json({ error: error.message }, error.status);
  }
  // الأثر إلى السجلّ لا إلى المستخدم: رسائل النظام تصف الداخل.
  console.error("✗", error);
  return c.json({ error: "حدث خطأ غير متوقّع" }, 500);
});

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`أثر · الخادم على ${info.port} · ${env.NODE_ENV}`);
});
injectWebSocket(server);

export type AppType = typeof app;
