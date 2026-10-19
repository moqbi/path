import "server-only";
import { randomUUID } from "node:crypto";
import { SignJWT } from "jose";
import { clientIp } from "@/lib/rate-limit";

/**
 * بابُ الويب إلى الواجهة البرمجية لما **يعيش في ذاكرتها وحدها** — منارةُ «من حولك»
 * (القاعدة ٢٨٠): الويبُ عمليّةٌ أخرى، فمنارةٌ في ذاكرته لا يراها مستعملُ الجوّال ولا
 * يراه. فيُوقَّع توكنُ وصولٍ بمفتاح الخادم نفسه (`.env` واحدٌ للخدمات الثلاث — OPS ٨)
 * ويُسأل الخادمُ داخل الجهاز لا عبر الإنترنت. والهويّةُ من جلسة الويب لا من الطلب.
 *
 * وعنوانُ الزائر يُمرَّر (`cf-connecting-ip`) فيبقى كشفُ الحسابات المرتبطة صادقاً
 * (القاعدة ١٩٤) — الطلبُ لا يمرّ بـCaddy فلا يكتب أحدٌ فوقه.
 */
const BASE = process.env.INTERNAL_API_URL ?? `http://127.0.0.1:${process.env.API_PORT ?? 4000}`;

export class BridgeError extends Error {}

export async function apiAs<T>(userId: string, path: string, init: { method: string; body?: unknown } = { method: "GET" }): Promise<T> {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new BridgeError("غير متاح الآن");
  const token = await new SignJWT({ role: "USER" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setJti(randomUUID())
    .setIssuedAt()
    .setIssuer("athr")
    .setAudience("athr-app")
    .setExpirationTime("2m")
    .sign(new TextEncoder().encode(secret));

  const ip = await clientIp().catch(() => "");
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: init.method,
      cache: "no-store",
      headers: {
        authorization: `Bearer ${token}`,
        ...(init.body === undefined ? {} : { "content-type": "application/json" }),
        ...(ip ? { "cf-connecting-ip": ip } : {}),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new BridgeError("تعذّر الاتصال — حاول بعد قليل");
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
  if (!res.ok) throw new BridgeError(data.error ?? data.message ?? "تعذّر الطلب");
  return data as T;
}
