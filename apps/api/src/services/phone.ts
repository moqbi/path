import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { prisma } from "@athar/db";
import { CONTACTS_MAX, maskPhone, normalizePhone } from "@athar/shared";
import { badRequest, tooMany } from "../lib/errors";
import { take } from "../middleware/rate-limit";
import { CARD, withRelation } from "./discover";
import { sendSms } from "./sms";
import { blockedWith } from "./visibility";

/**
 * رقمُ الجوال ومزامنةُ جهات الاتصال (القاعدة ٢٩٧) — **بقرار المالك**، بابٌ سادسٌ
 * للإضافة. الرقمُ **لا يُكتب إلا مؤكَّداً** برمز SMS، وجهاتُ الاتصال **تُرفع مجزَّأةً
 * وتُطابَق ولا تُخزَّن**: لا يبقى عندنا من دفتر أحدٍ شيء.
 */

const CODE_MINUTES = 10;
const CODE_TRIES = 5;
/** رمزٌ كلَّ دقيقة لحساب، وخمسةٌ في اليوم لرقمٍ واحد — وإلّا صار البابُ مِرشّةَ رسائل. */
const RESEND_MS = 60_000;
const PER_PHONE_DAY = 5;

/** sha256 بالسداسيّ لـ E.164 — الصيغةُ نفسُها التي يُجزّئ بها الجهازُ دفترَه. */
export const hashPhone = (e164: string) => createHash("sha256").update(e164).digest("hex");
const hashCode = (userId: string, code: string) => createHash("sha256").update(`${userId}:${code}`).digest("hex");

/** رموزُ الدول المقبولة للتأكيد — شريحةٌ سعوديّة لا تُرسل خارج المملكة إلا بكلفة. */
function allowed(e164: string): boolean {
  const codes = (process.env.SMS_COUNTRIES ?? "966").split(",").map((c) => c.trim()).filter(Boolean);
  return codes.some((code) => e164.startsWith(`+${code}`));
}

export async function startPhone(userId: string, raw: string) {
  const phone = normalizePhone(raw);
  if (!phone) throw badRequest("اكتب رقم جوال صحيح");
  if (!allowed(phone)) throw badRequest("التأكيد للأرقام السعودية (+966) حالياً");

  const [me, pending] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { phone: true } }),
    prisma.phoneCode.findUnique({ where: { userId }, select: { sentAt: true } }),
  ]);
  if (me?.phone === phone) return { ok: true, already: true, phone };
  if (pending && Date.now() - pending.sentAt.getTime() < RESEND_MS) {
    throw tooMany("انتظر دقيقة قبل طلب رمز جديد");
  }
  if (!take(`phone:${phone}`, PER_PHONE_DAY, 86_400_000)) throw tooMany("طلبات كثيرة لهذا الرقم — حاول بكرة");

  // لا يُقال «الرقم مربوط بحسابٍ آخر»: ذاك كشفٌ لمن سجّل. ومن أكّده يأخذه (القاعدة ٢٩٧).
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const data = {
    phone,
    codeHash: hashCode(userId, code),
    attempts: 0,
    expiresAt: new Date(Date.now() + CODE_MINUTES * 60_000),
    sentAt: new Date(),
  };
  await prisma.phoneCode.upsert({ where: { userId }, create: { userId, ...data }, update: data });
  await sendSms(phone, `رمز آثار: ${code}\nلا تعطه أحداً — صالح ${CODE_MINUTES} دقائق.`);
  return { ok: true, already: false, phone };
}

export async function verifyPhone(userId: string, code: string) {
  const row = await prisma.phoneCode.findUnique({ where: { userId } });
  if (!row || row.expiresAt < new Date()) throw badRequest("انتهى الرمز — اطلب رمزاً جديداً");
  if (row.attempts >= CODE_TRIES) {
    await prisma.phoneCode.delete({ where: { userId } }).catch(() => {});
    throw tooMany("محاولات كثيرة — اطلب رمزاً جديداً");
  }
  const a = Buffer.from(hashCode(userId, code), "hex");
  const b = Buffer.from(row.codeHash, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    await prisma.phoneCode.update({ where: { userId }, data: { attempts: { increment: 1 } } });
    throw badRequest("الرمز غير صحيح");
  }

  // من أكّد الرقم يملكه الآن — رقمٌ أعادته الشركةُ لغير صاحبه القديم يُنزع من حسابه.
  await prisma.$transaction([
    prisma.user.updateMany({
      where: { phone: row.phone, id: { not: userId } },
      data: { phone: null, phoneHash: null, phoneVerifiedAt: null },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { phone: row.phone, phoneHash: hashPhone(row.phone), phoneVerifiedAt: new Date() },
    }),
    prisma.phoneCode.delete({ where: { userId } }),
  ]);
  return { ok: true, phone: row.phone, masked: maskPhone(row.phone) };
}

export async function removePhone(userId: string) {
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { phone: null, phoneHash: null, phoneVerifiedAt: null } }),
    prisma.phoneCode.deleteMany({ where: { userId } }),
  ]);
  return { ok: true };
}

/** «تخطَّ» في شاشة الرقم بعد الدخول — لا تُعرض ثانيةً، ويبقى البابُ في الإعدادات. */
export async function skipPhone(userId: string) {
  await prisma.user.update({ where: { id: userId }, data: { phoneSkippedAt: new Date() } });
  return { ok: true };
}

/**
 * المطابقة: تجزئاتٌ من دفتر صاحبها مقابل أرقامٍ **مؤكَّدة** أصحابُها لم يُطفئوا
 * «من عنده رقمي يجدني». والمحجوبُ في الاتجاهين ونفسُه خارجها. ولا يُخزَّن ممّا
 * رُفع شيء — الطلبُ يُقرأ ويُنسى.
 */
/**
 * ميزانيّةُ اليوم: ستّةُ آلاف رقمٍ لكلّ حساب. دفترُ الإنسان لا يبلغها، ومن يسأل
 * عن الأرقام كلّها ليعرف من سجّل يبلغها في ساعة — فيُوقف حتى الغد.
 */
const DAY_BUDGET = 6000;
const spent = new Map<string, { used: number; resetAt: number }>();

export async function matchContacts(userId: string, hashes: string[]) {
  const wanted = [...new Set(hashes)].slice(0, CONTACTS_MAX);
  if (wanted.length === 0) return [];
  const now = Date.now();
  const day = spent.get(userId);
  const budget = day && day.resetAt > now ? day : { used: 0, resetAt: now + 86_400_000 };
  if (budget.used + wanted.length > DAY_BUDGET) throw tooMany("زامنت كثيراً اليوم — حاول بكرة");
  budget.used += wanted.length;
  spent.set(userId, budget);
  const blocked = await blockedWith(userId);
  const people = await prisma.user.findMany({
    where: {
      phoneHash: { in: wanted },
      phoneVerifiedAt: { not: null },
      findByPhone: true,
      id: { notIn: [userId, ...blocked] },
    },
    select: CARD,
    take: 300,
  });
  const found = await withRelation(userId, people);
  const order = { incoming: 0, none: 1, sent: 2, friend: 3 } as const;
  return found.sort((x, y) => order[x.relation] - order[y.relation] || x.name.localeCompare(y.name, "ar"));
}
