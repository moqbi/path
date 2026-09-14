import { createHash, randomBytes, randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { TOKEN } from "@athar/shared";
import { env } from "../env";

/**
 * التوكنات.
 *
 * الوصول قصيرٌ (١٥ دقيقة) فالتسريب لا يعيش، والتجديد طويلٌ (٣٠ يوماً)
 * فلا يُخرَج الناس من حساباتهم كل ربع ساعة. ومفتاحاهما منفصلان: من يسرق
 * أحدهما لا يصنع الآخر.
 *
 * وتوكن التجديد لا يُخزَّن كما هو: يُحفظ ملخّصه (SHA-256) — فقاعدةٌ
 * تُسرَّق لا تعطي سارقها جلسات الناس. والمقارنة تكون على الملخّص.
 */
const accessKey = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
const refreshKey = new TextEncoder().encode(env.JWT_REFRESH_SECRET);

export type Claims = { sub: string; role: "USER" | "ADMIN"; jti: string };

export async function signAccess(userId: string, role: "USER" | "ADMIN"): Promise<string> {
  return new SignJWT({ role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setJti(randomUUID())
    .setIssuedAt()
    .setIssuer("athr")
    .setAudience("athr-app")
    .setExpirationTime(`${TOKEN.accessMinutes}m`)
    .sign(accessKey);
}

export async function signRefresh(userId: string, family: string): Promise<string> {
  return new SignJWT({ family })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setJti(randomUUID())
    .setIssuedAt()
    .setIssuer("athr")
    .setAudience("athr-refresh")
    .setExpirationTime(`${TOKEN.refreshDays}d`)
    .sign(refreshKey);
}

export async function readAccess(token: string): Promise<Claims> {
  const { payload } = await jwtVerify(token, accessKey, {
    issuer: "athr",
    audience: "athr-app",
  });
  return {
    sub: String(payload.sub),
    role: payload.role === "ADMIN" ? "ADMIN" : "USER",
    jti: String(payload.jti),
  };
}

export async function readRefresh(token: string): Promise<{ sub: string; family: string }> {
  const { payload } = await jwtVerify(token, refreshKey, {
    issuer: "athr",
    audience: "athr-refresh",
  });
  return { sub: String(payload.sub), family: String(payload.family ?? "") };
}

/** ما يُخزَّن في القاعدة: ملخّص التوكن لا التوكن. */
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** عائلة الجلسة: تُدوَّر مع كل تجديد، وسرقةُ توكنٍ قديم تُسقط العائلة كلها. */
export const newFamily = () => randomBytes(16).toString("hex");
