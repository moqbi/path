import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { appUrl } from "@/lib/site-url";
import { letterHtml, sendMail } from "@/lib/mail";
import { hashPassword } from "@/lib/auth";
import { UNVERIFIED_MINUTES } from "@/lib/verify";

/**
 * التسجيلُ بالبريد: **طلبٌ ينتظر، لا حسابٌ يُنشأ**.
 *
 * حسابٌ يُنشأ قبل التأكيد يأخذ رقمَ عضويّةٍ من المتسلسلة، فإذا حُذف
 * لأنّ صاحبه لم يؤكّد بقيت فجوةٌ لا صاحب لها — والرقمُ لا يُعاد
 * استعماله (القاعدة ١٥)، ولا يصحّ أن يُعاد: رابطُ المشاركة `/u/<الرقم>`
 * يصير حينئذٍ لشخصٍ آخر.
 *
 * فيُحفظ الطلبُ وحده، ويُولَد `User` عند فتح الرابط فيأخذ رقمَه في
 * تلك اللحظة. فلا عضويّةَ بلا صاحب، ولا صفَّ حسابٍ لم يكتمل.
 *
 * **وكلمةُ المرور مجزَّأةٌ هنا كما تُجزَّأ هناك**: جدولٌ ينتظر عشر
 * دقائق لا يُستثنى من قاعدةٍ تحمي ما يدوم. والرمزُ مجزَّأٌ كذلك
 * (القاعدة ١١٩ب).
 */
const digest = (token: string) => createHash("sha256").update(token).digest("hex");

export type SignupResult = { ok: string } | { error: string };

export async function requestSignup(input: {
  name: string;
  email: string;
  password: string;
}): Promise<SignupResult> {
  const taken = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });
  // ويُقال صراحةً — بخلاف بابِ الدخول وإعادةِ الضبط: من يسجّل ببريدٍ
  // مأخوذ لا بدّ أن يعرف لماذا رُفض، وإلّا أعاد المحاولة أبداً.
  if (taken) return { error: "هذا البريد مسجّل — سجّل الدخول به" };

  const token = randomBytes(32).toString("base64url");
  const data = {
    name: input.name,
    passwordHash: await hashPassword(input.password),
    tokenHash: digest(token),
    expiresAt: new Date(Date.now() + UNVERIFIED_MINUTES * 60_000),
  };

  /*
     وطلبٌ ثانٍ بالبريد نفسه يحلّ محلّ الأوّل: من أخطأ في كلمته أو لم
     تصله الرسالة يعيد، ولا يُردّ بـ«مسجّل» على طلبٍ لم يكتمل. ورمزُ
     الطلب السابق يبطل بذلك من نفسه.
  */
  await prisma.pendingSignup.upsert({
    where: { email: input.email },
    create: { email: input.email, ...data },
    update: data,
  });

  const url = appUrl(`/verify?token=${token}`);
  const sent = await sendMail({
    to: input.email,
    subject: "أكّد بريدك لتفتح حسابك في آثار",
    text: `أهلاً ${input.name} — افتح هذا الرابط لتفتح حسابك: ${url}`,
    html: letterHtml({
      title: `أهلاً ${input.name}`,
      intro:
        "لم يُفتح حسابك بعد. افتح الرابط ليُفتح — ولا يعمل إلا لدقائق، فإن تأخّرتَ أعِد التسجيل.",
      button: "افتح حسابي",
      url,
      note: "إن لم تكن أنت من طلب هذا، تجاهل الرسالة ولا يحدث شيء.",
    }),
  });

  // وفشلُ الإرسال يُقال: بخلاف رسالةٍ تُرسَل لحسابٍ قائم، هذه هي البابُ
  // الوحيد — ومن ظنّ أنّ حسابه فُتح وينتظر رسالةً لن تأتي ينتظر أبداً.
  if (!sent) return { error: "تعذّر إرسال الرسالة — حاول بعد قليل" };

  return { ok: "أرسلنا رابطاً إلى بريدك — افتحه ليُفتح حسابك." };
}

/**
 * تفعيلُ الطلب: يُنشأ `User` ويأخذ رقمَ عضويّته الآن.
 *
 * ويُحذف الطلبُ في المعاملة نفسها: رابطٌ يُفتح مرّتين لا يُنشئ حسابين.
 */
export async function activateSignup(
  token: string,
): Promise<{ userId: string } | { error: string }> {
  if (!token) return { error: "رابطٌ ناقص" };

  const row = await prisma.pendingSignup.findUnique({
    where: { tokenHash: digest(token) },
  });
  if (!row) return { error: "رابطٌ غير صالح — أو استُعمل من قبل" };
  if (row.expiresAt < new Date()) {
    await prisma.pendingSignup.delete({ where: { id: row.id } }).catch(() => {});
    return { error: "انتهت مهلة الرابط — سجّل من جديد" };
  }

  // وقد يكون البريد سُجّل بمزوّدٍ بين الطلب والفتح.
  const taken = await prisma.user.findUnique({
    where: { email: row.email },
    select: { id: true },
  });
  if (taken) {
    await prisma.pendingSignup.delete({ where: { id: row.id } }).catch(() => {});
    return { error: "هذا البريد صار مسجّلاً — سجّل الدخول به" };
  }

  const [user] = await prisma.$transaction([
    prisma.user.create({
      data: {
        email: row.email,
        name: row.name,
        passwordHash: row.passwordHash,
        emailVerifiedAt: new Date(),
      },
      select: { id: true },
    }),
    prisma.pendingSignup.delete({ where: { id: row.id } }),
  ]);

  return { userId: user.id };
}

/** يكنس الطلبات التي انقضت مهلتُها — لا حساب لها فلا شيء يُحذف معها. */
export async function sweepPendingSignups(): Promise<number> {
  const { count } = await prisma.pendingSignup.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return count;
}
