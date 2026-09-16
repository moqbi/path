import "server-only";
import { cache } from "react";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/db";
import { deliverTo } from "@/lib/dm";

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

/**
 * ختم الحضور.
 *
 * كتابةٌ عند كل طلب تُثقل القاعدة بلا فائدة — دقيقة واحدة تكفي لتمييز
 * «متصل الآن» عن «آخر ظهور». والفشل يُبتلع: الحضور زينة لا تُعطّل الصفحة.
 */
async function touch(id: string, lastSeenAt: Date | null) {
  if (lastSeenAt && Date.now() - lastSeenAt.getTime() < 60_000) return;
  try {
    await prisma.user.update({ where: { id }, data: { lastSeenAt: new Date() } });
  } catch {}
  // حضوره يعني أنّ ما أُرسل إليه قد وصله، فيرى المرسل الصحّين.
  await deliverTo(id);
}

export type SessionUser = {
  id: string;
  memberNo: number;
  name: string;
  handle: string | null;
  email: string;
  city: string | null;
  bio: string | null;
  isPlus: boolean;
  coins: number;
  createdAt: Date;
  role: "USER" | "ADMIN";
  /// مدى صلاحية اللوحة الممنوح لغير المالك.
  adminScope: "NONE" | "STORE" | "ALL";
  /// صلاحية الإشراف على المحتوى — مستقلّةٌ عن اللوحة، والمالك يملكها دائماً.
  canModerate: boolean;
  avatarMediaId: string | null;
  coverMediaId: string | null;
  coverY: number;
  /** الملبوس الآن: المعرّفان ليُعرف أيّ صنفٍ عليه علامة «ملبوس». */
  frameId: string | null;
  backgroundId: string | null;
  charmId: string | null;
  frame: { spec: string } | null;
  /** الثيم الملبوس: صورته إن رُفعت، وتدرّجه إن لم تُرفع. */
  background: { spec: string; mediaId: string | null; palette: string | null } | null;
  charm: { spec: string; mediaId: string | null } | null;
  tag: { name: string; bg: string; fg: string } | null;
};

/**
 * تُقرأ مرّة واحدة لكل طلب: التخطيط يقرأها ليلبس الثيم، والصفحة تقرأها
 * لمحتواها — بلا `cache` لصار الاستعلامان اثنين وختمُ الحضور مرّتين.
 */
export const currentUser = cache(async function currentUser(): Promise<SessionUser | null> {
  const id = await currentUserId();
  if (!id) return null;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      memberNo: true,
      name: true,
      handle: true,
      email: true,
      city: true,
      bio: true,
      isPlus: true,
      plusUntil: true,
      coins: true,
      createdAt: true,
      role: true,
      adminScope: true,
      canModerate: true,
      avatarMediaId: true,
      coverMediaId: true,
      coverY: true,
      lastSeenAt: true,
      frameId: true,
      backgroundId: true,
      charmId: true,
      frame: { select: { spec: true } },
      background: { select: { spec: true, mediaId: true, palette: true } },
      charm: { select: { spec: true, mediaId: true } },
      tag: { select: { name: true, bg: true, fg: true } },
    },
  });
  if (!user) return null;

  await touch(user.id, user.lastSeenAt);

  // الاشتراك المنتهي يُقرأ كغير مشترك دون انتظار مهمة تنظيف.
  const active = user.isPlus && (!user.plusUntil || user.plusUntil > new Date());

  return {
    id: user.id,
    memberNo: user.memberNo,
    name: user.name,
    handle: user.handle,
    email: user.email,
    city: user.city,
    bio: user.bio,
    isPlus: active,
    coins: user.coins,
    createdAt: user.createdAt,
    role: user.role,
    adminScope: user.adminScope,
    canModerate: user.role === "ADMIN" || user.canModerate,
    avatarMediaId: user.avatarMediaId,
    coverMediaId: user.coverMediaId,
    coverY: user.coverY,
    frameId: user.frameId,
    backgroundId: user.backgroundId,
    charmId: user.charmId,
    frame: user.frame,
    background: user.background,
    charm: user.charm,
    tag: user.tag,
  };
});

/** يستخدمها كل إجراء خادم يحتاج مستخدماً مسجَّلاً. */
export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) throw new Error("غير مصرح");
  return user;
}
