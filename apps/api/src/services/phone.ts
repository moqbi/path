import { createHash } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { prisma } from "@athar/db";
import { CONTACTS_MAX, maskPhone, normalizePhone } from "@athar/shared";
import { badRequest, tooMany, unauthorized } from "../lib/errors";
import { CARD, withRelation } from "./discover";
import { blockedWith } from "./visibility";

/**
 * رقمُ الجوال ومزامنةُ جهات الاتصال (القاعدة ٢٩٧) — **بقرار المالك**، بابٌ سادسٌ
 * للإضافة. الرقمُ **لا يُكتب إلا مؤكَّداً** برمز SMS من Firebase، وجهاتُ الاتصال **تُرفع مجزَّأةً
 * وتُطابَق ولا تُخزَّن**: لا يبقى عندنا من دفتر أحدٍ شيء.
 */

/** sha256 بالسداسيّ لـ E.164 — الصيغةُ نفسُها التي يُجزّئ بها الجهازُ دفترَه. */
export const hashPhone = (e164: string) => createHash("sha256").update(e164).digest("hex");

/**
 * مفاتيحُ رموز هويّة Firebase المنشورة — بها يُفحص الرمزُ هنا لا بقول الجهاز (القاعدة ١٢١).
 * جوجل تبدّلها دوريّاً، و`createRemoteJWKSet` يجلبها ويخبّئها بنفسه.
 */
const FIREBASE_KEYS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);

/** رمزٌ أقدمُ من هذا لا يُقبل: الرقمُ أُكّد للتوّ في الشاشة، ورمزٌ قديم رمزٌ ملتقَط. */
const FRESH_SECONDS = 10 * 60;

/** رموزُ الدول المقبولة — الرسالةُ تُدفع من حسابنا، والجمهورُ في المملكة. */
function allowed(e164: string): boolean {
  const codes = (process.env.SMS_COUNTRIES ?? "966").split(",").map((c) => c.trim()).filter(Boolean);
  return codes.some((code) => e164.startsWith(`+${code}`));
}

/**
 * الرقمُ من رمز هويّة Firebase (القاعدة ٢٩٧): الجهازُ يتلقّى الرمزَ برسالة من Firebase
 * ويؤكّده هناك، ثمّ يرسل رمزَ الهويّة هنا — فيُفحص توقيعُه بمفاتيح جوجل ومعه **الجمهور**
 * و**المُصدِر** باسم مشروعنا، ويُقرأ الرقمُ من الرمز لا من الطلب. ومن أكّد رقماً يأخذه.
 */
export async function verifyFirebasePhone(userId: string, idToken: string) {
  const project = process.env.FIREBASE_PROJECT_ID;
  if (!project) throw badRequest("تأكيد الجوال غير مفعّل");
  let payload;
  try {
    ({ payload } = await jwtVerify(idToken, FIREBASE_KEYS, {
      issuer: `https://securetoken.google.com/${project}`,
      audience: project,
      algorithms: ["RS256"],
    }));
  } catch {
    throw unauthorized("تعذّر التحقق من الرمز — اطلب رمزاً جديداً");
  }
  const provider = (payload.firebase as { sign_in_provider?: string } | undefined)?.sign_in_provider;
  const authTime = typeof payload.auth_time === "number" ? payload.auth_time : 0;
  if (provider !== "phone" || Date.now() / 1000 - authTime > FRESH_SECONDS) {
    throw unauthorized("تعذّر التحقق من الرمز — اطلب رمزاً جديداً");
  }
  const phone = normalizePhone(String(payload.phone_number ?? ""));
  if (!phone || !allowed(phone)) throw badRequest("التأكيد للأرقام السعودية (+966) حالياً");

  // من أكّد الرقم يملكه الآن — رقمٌ أعادته الشركةُ لغير صاحبه القديم يُنزع من حسابه.
  await prisma.$transaction([
    prisma.user.updateMany({
      where: { phone, id: { not: userId } },
      data: { phone: null, phoneHash: null, phoneVerifiedAt: null },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { phone, phoneHash: hashPhone(phone), phoneVerifiedAt: new Date() },
    }),
  ]);
  return { ok: true, phone, masked: maskPhone(phone) };
}

export async function removePhone(userId: string) {
  await prisma.user.update({ where: { id: userId }, data: { phone: null, phoneHash: null, phoneVerifiedAt: null } });
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
