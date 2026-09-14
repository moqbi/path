import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { prisma } from "@athar/db";
import { TOKEN } from "@athar/shared";
import { hashToken, newFamily, readRefresh, signAccess, signRefresh } from "../lib/tokens";
import { badRequest, unauthorized } from "../lib/errors";

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

/**
 * كلمة المرور: scrypt بملحٍ لكل حساب.
 *
 * الملح يُمرَّر بايتاتٍ لا نصّاً سداسياً — بحرفيّة ما يفعله الويب الحالي:
 * تمريره نصّاً يشتقّ مفتاحاً مختلفاً، فتُغلق الحسابات القائمة في وجه
 * أصحابها. الصيغة `salt:hash` بالسداسي في الحالتين.
 */
async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `${salt.toString("hex")}:${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, keyHex] = stored.split(":");
  if (!saltHex || !keyHex) return false;
  const got = await scrypt(password, Buffer.from(saltHex, "hex"), 64);
  const want = Buffer.from(keyHex, "hex");
  // مقارنةٌ ثابتة الزمن: المقارنة العادية تُسرّب طول التطابق.
  return got.length === want.length && timingSafeEqual(got, want);
}

const PUBLIC_USER = {
  id: true,
  name: true,
  email: true,
  handle: true,
  memberNo: true,
  role: true,
  isPlus: true,
  avatarMediaId: true,
} as const;

/**
 * ما يُعطى للعميل: توكنان ومعلومات الحساب — بلا كلمة مرور ولا ملخّصها.
 *
 * العائلة تُورَّث عند التجديد ولا تُستأنف: هي خيط الجلسة الواحدة من أول
 * دخولٍ إلى آخر تجديد. عائلةٌ جديدة مع كل تجديد تقطع الخيط، فتُصبح
 * إعادةُ استعمال توكنٍ قديم لا تُسقط إلا نفسها — ويبقى ما في يد السارق
 * صالحاً. وهذا ما كشفه الفحص.
 */
async function issue(
  user: { id: string; role: "USER" | "ADMIN" },
  device?: string,
  inherited?: string,
) {
  const family = inherited ?? newFamily();
  const [access, refresh] = await Promise.all([
    signAccess(user.id, user.role),
    signRefresh(user.id, family),
  ]);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      hash: hashToken(refresh),
      family,
      device: device?.slice(0, 120) ?? null,
      expiresAt: new Date(Date.now() + TOKEN.refreshDays * 86_400_000),
    },
  });

  return { accessToken: access, refreshToken: refresh };
}

export async function register(input: {
  email: string;
  password: string;
  name: string;
  device?: string;
}) {
  const taken = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (taken) throw badRequest("هذا البريد مسجّل");

  const last = await prisma.user.findFirst({
    orderBy: { memberNo: "desc" },
    select: { memberNo: true },
  });

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash: await hashPassword(input.password),
      name: input.name,
      memberNo: (last?.memberNo ?? 0) + 1,
    },
    select: PUBLIC_USER,
  });

  return { user, ...(await issue(user, input.device)) };
}

export async function login(input: { email: string; password: string; device?: string }) {
  const row = await prisma.user.findUnique({
    where: { email: input.email },
    select: { ...PUBLIC_USER, passwordHash: true },
  });

  // رسالةٌ واحدة للحالتين: «لا يوجد حساب» تقول للمهاجم أيّ بريدٍ مسجّل.
  if (!row || !(await verifyPassword(input.password, row.passwordHash))) {
    throw unauthorized("البريد أو كلمة المرور غير صحيحة");
  }

  const { passwordHash: _ignored, ...user } = row;
  return { user, ...(await issue(user, input.device)) };
}

/**
 * التجديد بتدوير التوكن.
 *
 * كل تجديدٍ يُبطل القديم ويصدر جديداً. وإن عاد توكنٌ مُبطَل فهذه سرقةٌ
 * ظاهرة: تُلغى عائلة الجلسة كلها ويُطالَب صاحبها بالدخول من جديد.
 */
export async function refresh(token: string, device?: string) {
  let claims: { sub: string; family: string };
  try {
    claims = await readRefresh(token);
  } catch {
    throw unauthorized("انتهت الجلسة — سجّل الدخول");
  }

  const row = await prisma.refreshToken.findUnique({ where: { hash: hashToken(token) } });

  if (!row || row.userId !== claims.sub) throw unauthorized("جلسة غير معروفة");

  if (row.revokedAt || row.expiresAt <= new Date()) {
    await prisma.refreshToken.updateMany({
      where: { family: row.family, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw unauthorized("جلسة منتهية — سجّل الدخول");
  }

  const user = await prisma.user.findUnique({ where: { id: row.userId }, select: PUBLIC_USER });
  if (!user) throw unauthorized();

  await prisma.refreshToken.update({
    where: { id: row.id },
    data: { revokedAt: new Date() },
  });

  return { user, ...(await issue(user, device, row.family)) };
}

/** الخروج: يُبطل جلسةً واحدة. والخروج من كل الأجهزة يُبطل ما لصاحبها. */
export async function logout(token: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { hash: hashToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function logoutAll(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function profile(userId: string) {
  return prisma.user.findUnique({ where: { id: userId }, select: PUBLIC_USER });
}
