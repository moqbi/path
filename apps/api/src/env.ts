import { z } from "zod";

/**
 * البيئة تُفحص عند الإقلاع لا عند أول طلب.
 *
 * خادمٌ يقلع بمفتاحٍ ناقص يسقط بعد ساعة على مستخدمٍ حقيقي؛ وفحصٌ هنا
 * يسقطه في ثانيته الأولى ويقول ما الناقص بالاسم.
 *
 * والمفتاحان منفصلان عمداً: تسريب مفتاح الوصول لا يمنح تجديداً، وتدوير
 * أحدهما لا يُخرج الناس من حساباتهم.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),

  DATABASE_URL: z.string().min(1, "رابط القاعدة مفقود"),

  JWT_ACCESS_SECRET: z.string().min(32, "مفتاح الوصول ٣٢ حرفاً فأكثر"),
  JWT_REFRESH_SECRET: z.string().min(32, "مفتاح التجديد ٣٢ حرفاً فأكثر"),

  /** الدومينات المسموح لها بالنداء. في الإنتاج قائمةٌ محدّدة لا نجمة. */
  CORS_ORIGINS: z.string().default("http://localhost:3000,http://localhost:8081"),

  R2_ACCOUNT_ID: z.string().optional(),
  R2_ENDPOINT: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),

  SENTRY_DSN: z.string().optional(),
  POSTHOG_KEY: z.string().optional(),
  POSTHOG_HOST: z.string().default("https://us.i.posthog.com"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const lines = parsed.error.issues.map((issue) => `  ــ ${issue.path.join(".")}: ${issue.message}`);
  console.error("✗ الإقلاع متوقف. البيئة ناقصة:\n" + lines.join("\n"));
  process.exit(1);
}

export const env = parsed.data;

export const isProd = env.NODE_ENV === "production";

/** الدومينات المسموح بها قائمةً مشذّبة — لا فراغات ولا نجمة في الإنتاج. */
export const corsOrigins = env.CORS_ORIGINS.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
