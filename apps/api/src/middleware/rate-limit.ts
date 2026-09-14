import type { MiddlewareHandler } from "hono";
import { tooMany } from "../lib/errors";

/**
 * حدّ المعدّل في الذاكرة.
 *
 * يكفي لخادمٍ واحد، وهو حالنا على VPS. وعند تعدّد النسخ يُستبدل المخزن
 * بـRedis بلا تغيير في الاستدعاء — الواجهة هي هي.
 *
 * والمفتاح: العنوان مع المسار، فمحاولاتُ الدخول لا تُنفق حصّة التصفّح.
 */
type Hit = { count: number; resetAt: number };
const hits = new Map<string, Hit>();

// تنظيفٌ كسول: ما انتهت نافذته يُحذف عند أول مرورٍ بعدها.
function take(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const hit = hits.get(key);
  if (!hit || hit.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  hit.count += 1;
  return hit.count <= limit;
}

export function rateLimit(limit: number, windowSeconds: number): MiddlewareHandler {
  const windowMs = windowSeconds * 1000;
  return async (c, next) => {
    const ip =
      c.req.header("cf-connecting-ip") ??
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
    if (!take(`${ip}:${c.req.path}`, limit, windowMs)) throw tooMany();
    await next();
  };
}
