import "server-only";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/db";

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const SESSION_COOKIE = "athar_session";
const SESSION_DAYS = 30;

function secret(): Uint8Array {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET مطلوب لتوقيع الجلسات");
  return new TextEncoder().encode(value);
}

/**
 * تجزئة كلمة المرور بـ scrypt من مكتبة Node القياسية.
 *
 * scrypt بدل bcrypt عمداً: لا اعتمادية إضافية، ومقاومته للعتاد المتخصص أفضل.
 * الملح يُخزَّن مع الناتج في نفس السلسلة بالشكل `salt:hash`.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64);
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;

  const derived = await scrypt(password, Buffer.from(saltHex, "hex"), 64);
  const expected = Buffer.from(hashHex, "hex");

  // الطولان لازم يتطابقان قبل المقارنة، وإلا رمى timingSafeEqual.
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

export async function createSession(userId: string): Promise<void> {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** معرّف المستخدم من الجلسة، أو null إن لم توجد جلسة صالحة. */
export async function currentUserId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret());
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    // توقيع فاسد أو جلسة منتهية — يُعامَل كعدم تسجيل دخول.
    return null;
  }
}

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  city: string | null;
  bio: string | null;
  isPlus: boolean;
  storeCredit: number;
  createdAt: Date;
  role: "USER" | "ADMIN";
  avatarMediaId: string | null;
  coverMediaId: string | null;
  frame: { spec: string } | null;
  background: { spec: string } | null;
};

export async function currentUser(): Promise<SessionUser | null> {
  const id = await currentUserId();
  if (!id) return null;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      city: true,
      bio: true,
      isPlus: true,
      plusUntil: true,
      storeCredit: true,
      createdAt: true,
      role: true,
      avatarMediaId: true,
      coverMediaId: true,
      frame: { select: { spec: true } },
      background: { select: { spec: true } },
    },
  });
  if (!user) return null;

  // الاشتراك المنتهي يُقرأ كغير مشترك دون انتظار مهمة تنظيف.
  const active = user.isPlus && (!user.plusUntil || user.plusUntil > new Date());

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    city: user.city,
    bio: user.bio,
    isPlus: active,
    storeCredit: user.storeCredit,
    createdAt: user.createdAt,
    role: user.role,
    avatarMediaId: user.avatarMediaId,
    coverMediaId: user.coverMediaId,
    frame: user.frame,
    background: user.background,
  };
}

/** يستخدمها كل إجراء خادم يحتاج مستخدماً مسجَّلاً. */
export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) throw new Error("غير مصرح");
  return user;
}
