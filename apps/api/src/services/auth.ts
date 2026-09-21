import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { prisma } from "@athar/db";
import { consume, sendReset, sendVerify } from "./email-tokens";
import { readIdentity, upsertIdentity } from "./oauth";
import { TOKEN, UNVERIFIED_MINUTES } from "@athar/shared";
import { hashToken, newFamily, readRefresh, signAccess, signRefresh } from "../lib/tokens";
import { badRequest, forbidden, unauthorized } from "../lib/errors";
import { suspensionOf, untilText } from "../middleware/auth";

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
export async function hashPassword(password: string): Promise<string> {
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

  /*
     ورقمُ العضوية **لا يُكتب هنا**: مصدرُه متسلسلةُ Postgres
     (`@default(autoincrement())` — القاعدة ١٥). وحسابُه في التطبيق
     يعطل من وجهين: مسجّلان في اللحظة نفسها يقرآن آخرَ رقمٍ فيكتبانه
     معاً، **وكتابتُه يدوياً لا تُقدّم المتسلسلة** — فحين تلحق بما كُتب
     يسقط كلُّ تسجيلٍ بعدها على قيد الفرادة.
  */
  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash: await hashPassword(input.password),
      name: input.name,
    },
    select: PUBLIC_USER,
  });

  /*
     رسالةُ التأكيد تُرسَل ولا يُنتظر جوابُها، وفشلُها يُبتلع: حسابٌ
     أُنشئ لا يُلغى لأنّ بريداً لم يخرج، ومن لم تصله رسالةٌ يطلبها من
     الإعدادات.
  */
  void sendVerify(user.id, input.email, input.name).catch(() => {});

  return { user, ...(await issue(user, input.device)) };
}

/**
 * «نسيت كلمة المرور»: رسالةٌ برابطٍ لساعة.
 *
 * والجواب واحدٌ وُجد الحساب أو لم يوجد — وإلّا صار البابُ وسيلةً لمعرفة
 * من عندنا حساب.
 */
export async function forgot(email: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, email: true, name: true },
  });
  // ومن لا بريدَ له (دخل بسناب) لا يصله شيء — ولا يُقال ذلك للسائل.
  if (user?.email) await sendReset(user.id, user.email, user.name);
  return { ok: true };
}

/**
 * ضبطُ كلمة المرور بالرمز.
 *
 * والجلساتُ القائمة تُبطَل: من نسي كلمته قد يكون فقد جهازه، وهذا بابُه
 * الوحيد لإخراج من فيه. ومن وصلته الرسالة يملك البريد، فهو تأكيدُه.
 */
export async function resetPassword(input: { token: string; password: string }) {
  const read = await consume(input.token, "RESET");
  if ("error" in read) throw badRequest(read.error);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: read.userId },
      data: {
        passwordHash: await hashPassword(input.password),
        emailVerifiedAt: new Date(),
      },
    }),
    prisma.refreshToken.deleteMany({ where: { userId: read.userId } }),
  ]);
  return { ok: true };
}

/** تأكيدُ البريد بالرمز — من الرابط أو من داخل التطبيق. */
export async function verifyEmail(token: string) {
  const read = await consume(token, "VERIFY");
  if ("error" in read) throw badRequest(read.error);

  await prisma.user.update({
    where: { id: read.userId },
    data: { emailVerifiedAt: new Date() },
  });
  return { ok: true };
}

/** إعادةُ إرسال رسالة التأكيد لصاحب الجلسة. */
export async function resendVerify(userId: string) {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true, emailVerifiedAt: true },
  });
  if (!row) throw badRequest("لا يوجد هذا الحساب");
  if (!row.email) throw badRequest("اربط بريدك أوّلاً");
  if (row.emailVerifiedAt) return { ok: true, already: true };

  const sent = await sendVerify(userId, row.email, row.name);
  if (!sent) throw badRequest("تعذّر الإرسال الآن — جرّب بعد دقيقة");
  return { ok: true };
}

/**
 * الدخول بمزوّد: يتحقّق الخادمُ من الرمز، ثمّ يجد الحساب أو ينشئه،
 * ثمّ يُصدر جلستنا نحن — لا جلسةَ المزوّد.
 *
 * والموقوفُ مؤقّتاً لا تُصدَر له جلسة من هنا كما لا تُصدَر من الدخول
 * بالبريد: بابٌ ثانٍ يتجاوز الإيقاف ليس إيقافاً.
 */
export async function oauth(input: {
  provider: "GOOGLE" | "APPLE" | "SNAP";
  idToken: string;
  name?: string | null;
  device?: string;
}) {
  const identity = await readIdentity(input.provider, input.idToken, input.name ?? null);
  const { userId } = await upsertIdentity(identity);

  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: PUBLIC_USER,
  });
  if (!row) throw unauthorized("تعذّر الدخول");

  const held = await suspensionOf(userId);
  if (held) {
    throw forbidden(
      `حسابك موقوف حتى ${untilText(held.until)}${held.reason ? ` — ${held.reason}` : ""}`,
    );
  }

  return { user: row, ...(await issue(row, input.device)) };
}

export async function login(input: { email: string; password: string; device?: string }) {
  const row = await prisma.user.findUnique({
    where: { email: input.email },
    select: { ...PUBLIC_USER, passwordHash: true },
  });

  // رسالةٌ واحدة للحالتين: «لا يوجد حساب» تقول للمهاجم أيّ بريدٍ مسجّل.
  // ومن دخل بمزوّدٍ ولم يضع كلمةً بعد لا كلمةَ له تُطابَق.
  if (!row || !row.passwordHash || !(await verifyPassword(input.password, row.passwordHash))) {
    throw unauthorized("البريد أو كلمة المرور غير صحيحة");
  }

  /*
    والموقوف مؤقّتاً لا تُصدَر له جلسة.

    ولا يُقال «البريد أو كلمة المرور غير صحيحة»: هو أدخلهما صحيحين،
    وإخفاءُ السبب يجعله يظنّ حسابه سُرق فيغيّر كلمته مراراً بلا فائدة.
    وقد عرفنا أنّه هو بعد فحص كلمته، فلا شيء يُسرَّب بإخباره.
  */
  const held = await suspensionOf(row.id);
  if (held) {
    throw forbidden(
      `حسابك موقوف حتى ${untilText(held.until)}${held.reason ? ` — ${held.reason}` : ""}`,
    );
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

/**
 * يحذف الحسابات التي سُجّلت ببريدٍ ولم تُؤكَّد خلال المهلة.
 *
 * حذفٌ حقيقيّ لا إخفاء: صفُّ المستخدم يذهب ومعه ما يشير إليه بالتتالي
 * — ورقمُ عضويّته لا يُعاد استعماله (القاعدة ١٥)، فلا يرث أحدٌ رقمَ من
 * حُذف.
 *
 * وشروطُه في `UNVERIFIED_MINUTES` مشروحة: من دخل بمزوّدٍ لا يطاله،
 * ومن نشر لحظةً لا يطاله، والمشرفُ لا يطاله بحال.
 */
export async function sweepUnverified(): Promise<number> {
  const cutoff = new Date(Date.now() - UNVERIFIED_MINUTES * 60_000);
  const { count } = await prisma.user.deleteMany({
    where: {
      emailVerifiedAt: null,
      email: { not: null },
      passwordHash: { not: null },
      role: "USER",
      createdAt: { lt: cutoff },
      identities: { none: {} },
      moments: { none: {} },
    },
  });
  if (count > 0) console.info("[كنس] حساباتٌ لم تُؤكَّد:", count);
  return count;
}
