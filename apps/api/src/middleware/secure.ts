import type { MiddlewareHandler } from "hono";
import { isProd } from "../env";

/**
 * رؤوس الأمان.
 *
 * الـAPI يردّ JSON لا صفحات، فسياسة المحتوى عنده صارمة إلى أقصاها: لا
 * سكربت ولا إطار ولا مصدر — فحتى لو رُدّت صفحةٌ بالغلط لا تُنفَّذ.
 */
export const secureHeaders: MiddlewareHandler = async (c, next) => {
  await next();
  const h = c.res.headers;
  h.set("X-Content-Type-Options", "nosniff");
  h.set("X-Frame-Options", "DENY");
  h.set("Referrer-Policy", "no-referrer");
  h.set("Cross-Origin-Resource-Policy", "same-site");
  h.set("Permissions-Policy", "geolocation=(), camera=(), microphone=()");
  h.set(
    "Content-Security-Policy",
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  );
  if (isProd) h.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
};
