import "server-only";
import { cache } from "react";
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/db";
import { totpMark } from "@/lib/totp";

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const SESSION_COOKIE = "athar_session";
const SESSION_DAYS = 30;
/*
  جلسةُ اللوحة كوكي ثانٍ فوق الجلسة (القاعدة ٤٩٣): يُكتب بعد التحقّق الثنائيّ وحده، ويعيش
  اثنتي عشرة ساعة لا ثلاثين يوماً. الجلسةُ وحدها — من دخول الويب أو رابط التذاكر — لا تُعطي
  صلاحيةً في اللوحة: كان كوكي واحدٌ يفتح التطبيقَ واللوحةَ معاً، فمن سُرقت جلستُه في `/app`
  سُرقت لوحتُه.
*/
const PANEL_COOKIE = "athar_panel";
const PANEL_HOURS = 12;

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

/**
 * بصمةُ كلمة المرور في الجلسة: تغييرُها — أو ضبطُها من «نسيت كلمتي» —
 * يُبطل كلَّ كوكي صدر قبلها. كان الكوكي يعيش ثلاثين يوماً مهما جرى، فمن
 * سُرقت جلستُه في اللوحة لا يُخرجه تغييرُ الكلمة.
 * والبصمةُ مقطعٌ من تجزئة التجزئة: لا تُعيد شيئاً من الكلمة ولا من ملحها.
 */
function passwordMark(hash: string | null): string {
  return createHash("sha256").update(hash ?? "none").digest("base64url").slice(0, 16);
}

export async function createSession(userId: string, passwordHash: string | null): Promise<void> {
  const token = await new SignJWT({ sub: userId, pv: passwordMark(passwordHash) })
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
  store.delete(PANEL_COOKIE);
}

/** يفتح اللوحة بعد التحقّق الثنائيّ: مربوطةً بالحساب وبصمتَي الكلمة والسرّ. */
export async function createPanelSession(
  userId: string,
  passwordHash: string | null,
  totpSecret: string,
): Promise<void> {
  const token = await new SignJWT({ sub: userId, pv: passwordMark(passwordHash), tv: totpMark(totpSecret) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${PANEL_HOURS}h`)
    .sign(secret());
  const store = await cookies();
  store.set(PANEL_COOKIE, token, {
    httpOnly: true,
    /*
      `lax` لا `strict`: الدخولُ يمرّ بتحويلة Cloudflare Access من نطاقها، والمتصفّحُ يعدّ
      الصفحةَ — وإعادةَ تحميلها — قادمةً من موقعٍ آخر فلا يُرسل كوكي `strict`، فكان التحديثُ
      يطلب الرمزَ من جديد. و`lax` لا يُرسَل مع طلبٍ `POST` من موقعٍ آخر، فالإجراءاتُ محميّة.
    */
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PANEL_HOURS * 60 * 60,
  });
}

/** يُغلق اللوحة ويُبقي الجلسة — «خروج من اللوحة». */
export async function closePanel(): Promise<void> {
  const store = await cookies();
  store.delete(PANEL_COOKIE);
}

async function readPanel(): Promise<{ id: string; pv: string; tv: string } | null> {
  const store = await cookies();
  const token = store.get(PANEL_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string" || typeof payload.pv !== "string" || typeof payload.tv !== "string") {
      return null;
    }
    return { id: payload.sub, pv: payload.pv, tv: payload.tv };
  } catch {
    return null;
  }
}

/** له صلاحيةٌ في اللوحة — من الصفّ لا من الجلسة. */
export function hasPanelPower(row: {
  role: "USER" | "ADMIN";
  adminScope: "NONE" | "STORE" | "REPORTS" | "ALL";
  canModerate: boolean;
  canBlog: boolean;
}): boolean {
  return row.role === "ADMIN" || row.adminScope !== "NONE" || row.canModerate || row.canBlog;
}

/** الجلسة من الكوكي: المعرّف وبصمة الكلمة، أو null إن لم توجد جلسة صالحة. */
async function readSession(): Promise<{ id: string; pv: string | null } | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string") return null;
    return { id: payload.sub, pv: typeof payload.pv === "string" ? payload.pv : null };
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
  /*
    ولا تسليمَ رسائل هنا: ذاك نبض حضور التطبيق لا اللوحة. المشرف يفتح
    لوحته من متصفّح، وختمُ وصولِ رسائله ينتظر دخوله من تطبيقه هو.
  */
}

export type SessionUser = {
  id: string;
  memberNo: number;
  name: string;
  handle: string | null;
  email: string | null;
  city: string | null;
  bio: string | null;
  isPlus: boolean;
  coins: number;
  createdAt: Date;
  role: "USER" | "ADMIN";
  /// مدى صلاحية اللوحة الممنوح لغير المالك.
  adminScope: "NONE" | "STORE" | "REPORTS" | "ALL";
  /// صلاحية الإشراف على المحتوى — مستقلّةٌ عن اللوحة، والمالك يملكها دائماً.
  canModerate: boolean;
  /// الكتابةُ في المدونة (القاعدة ٤٩٠): المالكُ وممنوحُ اللوحة كلّها، ومن مُنحها وحدها.
  canBlog: boolean;
  /// إيقافٌ مؤقّت قائم — `null` يشمل إيقافاً انقضى.
  suspendedUntil: Date | null;
  suspendedReason: string | null;
  avatarMediaId: string | null;
  coverMediaId: string | null;
  coverY: number;
  /** الملبوس الآن: المعرّفان ليُعرف أيّ صنفٍ عليه علامة «ملبوس». */
  frameId: string | null;
  backgroundId: string | null;
  charmId: string | null;
  frame: { spec: string; mediaId: string | null; frameHole: number | null } | null;
  /** الثيم الملبوس: صورته إن رُفعت، وتدرّجه إن لم تُرفع. */
  background: { spec: string; mediaId: string | null; palette: string | null } | null;
  charm: { spec: string; mediaId: string | null } | null;
  tag: { name: string; bg: string; fg: string } | null;
  /// اللوحةُ مفتوحة: جلسةُ لوحةٍ صالحة بعد التحقّق الثنائيّ (القاعدة ٤٩٣).
  panel: boolean;
  /// له صلاحيةٌ ولم يتحقّق بعد — اللوحةُ تُحيله إلى `/login/verify`.
  panelPending: boolean;
  /// ضبط التحقّقَ الثنائيّ من قبل.
  hasTotp: boolean;
};

/**
 * تُقرأ مرّة واحدة لكل طلب: التخطيط يقرأها ليلبس الثيم، والصفحة تقرأها
 * لمحتواها — بلا `cache` لصار الاستعلامان اثنين وختمُ الحضور مرّتين.
 */
export const currentUser = cache(async function currentUser(): Promise<SessionUser | null> {
  const session = await readSession();
  if (!session) return null;
  const id = session.id;

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
      canBlog: true,
      suspendedUntil: true,
      suspendedReason: true,
      avatarMediaId: true,
      coverMediaId: true,
      coverY: true,
      lastSeenAt: true,
      passwordHash: true,
      totpSecret: true,
      frameId: true,
      backgroundId: true,
      charmId: true,
      frame: { select: { spec: true, mediaId: true, frameHole: true, fit: true } },
      background: { select: { spec: true, mediaId: true, palette: true } },
      charm: { select: { spec: true, mediaId: true, fit: true } },
      tag: { select: { name: true, bg: true, fg: true } },
    },
  });
  if (!user) return null;
  // كوكي بلا بصمةٍ أو ببصمةٍ قديمة: صدر قبل تغيير الكلمة، فلا يُقبل.
  if (session.pv !== passwordMark(user.passwordHash)) return null;

  await touch(user.id, user.lastSeenAt);

  /*
    الصلاحياتُ لا تُقرأ إلا وجلسةُ اللوحة صالحة: لنفس الحساب، وبنفس الكلمة، وبنفس السرّ.
    وبلاها يُقرأ صاحبُها مستخدماً عاديّاً في كلّ صفحةٍ وإجراء — فلا تُنسى في واحد.
  */
  const power = hasPanelPower(user);
  const panelToken = power && user.totpSecret ? await readPanel() : null;
  const panel = Boolean(
    panelToken &&
      panelToken.id === user.id &&
      panelToken.pv === passwordMark(user.passwordHash) &&
      panelToken.tv === totpMark(user.totpSecret),
  );

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
    role: panel ? user.role : "USER",
    adminScope: panel ? user.adminScope : "NONE",
    canModerate: panel && (user.role === "ADMIN" || user.canModerate),
    canBlog: panel && (user.role === "ADMIN" || user.adminScope === "ALL" || user.canBlog),
    panel,
    panelPending: power && !panel,
    hasTotp: Boolean(user.totpSecret),
    // انقضى = غير موقوف: التاريخ يبقى في الصفّ ولا يُقرأ حظراً.
    suspendedUntil:
      user.suspendedUntil && user.suspendedUntil > new Date() ? user.suspendedUntil : null,
    suspendedReason: user.suspendedReason,
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
  /*
    والموقوف مؤقّتاً يُمنع من الكتابة: `requireUser` بوّابةُ كل إجراءٍ
    يكتب، فشرطٌ واحد هنا أوثق من شرطٍ في كل إجراء يُنسى في واحد.
    والقراءة تبقى — `currentUser()` لا تمنع أحداً.
  */
  if (user.suspendedUntil) {
    throw new Error(
      `حسابك موقوف حتى ${new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
        dateStyle: "full",
        timeStyle: "short",
      }).format(user.suspendedUntil)}${user.suspendedReason ? ` — ${user.suspendedReason}` : ""}`,
    );
  }
  return user;
}

/**
 * بوّابةُ كلّ إجراءٍ في اللوحة: مستخدمٌ غيرُ موقوف وجلسةُ لوحته صالحة. والدرجةُ بعدها تُقرأ
 * من الصفّ في كلّ إجراء (القاعدة ١٣) — هذه تقول «تحقّق»، وتلك تقول «مسموح».
 */
export async function requirePanel(): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.panel) throw new Error("افتح اللوحة بالتحقّق الثنائيّ أوّلاً");
  return user;
}
