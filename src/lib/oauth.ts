import { createRemoteJWKSet, jwtVerify } from "jose";
import { prisma } from "@/lib/db";

import { sendVerify } from "@/lib/email-tokens";

/**
 * الدخول بمزوّد على الويب — نسخةُ `apps/api/src/services/oauth.ts`.
 *
 * **الجهاز يأتي برمزٍ موقَّع، والخادم يتحقّق منه بنفسه** — لا يكتفي
 * بمعرّفٍ يرسله التطبيق: من يرسل طلباً بيده يستطيع أن يكتب أيَّ معرّف،
 * فيدخل حسابَ غيره بسطر. والتحقّق بمفاتيح المزوّد المنشورة (JWKS)،
 * ويُفحص معه **الجمهور** (`aud`) وإلّا قُبل رمزٌ صدر لتطبيقٍ آخر.
 */

/** مفاتيحُ المزوّدين — تُجلب مرّةً وتُحدَّث من نفسها. */
const APPLE_KEYS = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));
const GOOGLE_KEYS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

/** من يقبله الرمز: معرّفاتُ عملائنا، مفصولةً بفاصلة في البيئة. */
function audiences(name: string): string[] {
  return (process.env[name] ?? "")
    .split(",")
    .map((one) => one.trim())
    .filter(Boolean);
}

export type Identity = {
  provider: "GOOGLE" | "APPLE";
  subject: string;
  email: string | null;
  /** آبل لا تعطي الاسم إلا مرّةً واحدة وقت أوّل موافقة، فيأتي من الجهاز. */
  name: string | null;
  emailVerified: boolean;
};

/** يتحقّق من رمز آبل ويردّ هويّةً. */
async function readApple(idToken: string, name: string | null): Promise<Identity> {
  const allowed = audiences("APPLE_CLIENT_IDS");
  if (allowed.length === 0) throw new Error("الدخول بآبل غير مفعّل");

  const { payload } = await jwtVerify(idToken, APPLE_KEYS, {
    issuer: "https://appleid.apple.com",
    audience: allowed,
  });
  if (!payload.sub) throw new Error("رمزٌ غير صالح");

  return {
    provider: "APPLE",
    subject: payload.sub,
    email: typeof payload.email === "string" ? payload.email.toLowerCase() : null,
    name,
    // آبل تقولها نصّاً أحياناً («true») لا قيمةً منطقية.
    emailVerified: payload.email_verified === true || payload.email_verified === "true",
  };
}

/** يتحقّق من رمز قوقل ويردّ هويّةً. */
async function readGoogle(idToken: string): Promise<Identity> {
  const allowed = audiences("GOOGLE_CLIENT_IDS");
  if (allowed.length === 0) throw new Error("الدخول بقوقل غير مفعّل");

  const { payload } = await jwtVerify(idToken, GOOGLE_KEYS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: allowed,
  });
  if (!payload.sub) throw new Error("رمزٌ غير صالح");

  return {
    provider: "GOOGLE",
    subject: payload.sub,
    email: typeof payload.email === "string" ? payload.email.toLowerCase() : null,
    name: typeof payload.name === "string" ? payload.name : null,
    emailVerified: payload.email_verified === true || payload.email_verified === "true",
  };
}

export async function readIdentity(
  provider: "GOOGLE" | "APPLE",
  idToken: string,
  name: string | null,
): Promise<Identity> {
  try {
    return provider === "APPLE" ? await readApple(idToken, name) : await readGoogle(idToken);
  } catch (problem) {
    if (problem instanceof Error && problem.message.includes("غير مفعّل")) throw problem;
    throw new Error("تعذّر التحقّق من الرمز");
  }
}

/**
 * يجد الحساب أو ينشئه لهويّةٍ تحقّقنا منها.
 *
 * ثلاثُ حالات بترتيبها:
 * ١. هويّةٌ مربوطةٌ من قبل ← صاحبُها.
 * ٢. بريدٌ **مؤكَّدٌ عند المزوّد** يطابق حساباً عندنا ← يُربط به. وشرطُ
 *    التأكيد لازم: بلا ذلك يفتح من سجّل بريدَ غيره عند مزوّدٍ متساهل
 *    حسابَ صاحبه عندنا.
 * ٣. وإلّا حسابٌ جديد بلا كلمة مرور، ورقمُ عضويةٍ بعد آخر رقم.
 */
export async function upsertIdentity(identity: Identity) {
  const found = await prisma.authIdentity.findUnique({
    where: { provider_subject: { provider: identity.provider, subject: identity.subject } },
    select: { userId: true },
  });
  if (found) return { userId: found.userId, created: false };

  if (identity.email && identity.emailVerified) {
    const byEmail = await prisma.user.findUnique({
      where: { email: identity.email },
      select: { id: true },
    });
    if (byEmail) {
      await prisma.authIdentity.create({
        data: {
          userId: byEmail.id,
          provider: identity.provider,
          subject: identity.subject,
          email: identity.email,
        },
      });
      // ومن وصل ببريدٍ أكّده مزوّدُه فبريدُه مؤكَّد عندنا كذلك.
      await prisma.user.update({
        where: { id: byEmail.id },
        data: { emailVerifiedAt: new Date() },
      });
      return { userId: byEmail.id, created: false };
    }
  }

  /*
     ولا بدّ من بريد: هو اسمُ الدخول وبابُ الاستعادة، والمخطّط يفرضه.
     ومن أخفى بريده عند آبل يصلنا عنوانُها المُقنَّع (`privaterelay`) —
     وهو صالحٌ يصل صاحبَه، فيُقبل كغيره.
  */
  if (!identity.email) throw new Error("لم يعطنا المزوّد بريداً — جرّب الدخول بالبريد");

  const last = await prisma.user.findFirst({
    orderBy: { memberNo: "desc" },
    select: { memberNo: true },
  });

  const user = await prisma.user.create({
    data: {
      email: identity.email,
      name: identity.name?.trim() || identity.email.split("@")[0],
      memberNo: (last?.memberNo ?? 0) + 1,
      emailVerifiedAt: identity.emailVerified ? new Date() : null,
      identities: {
        create: {
          provider: identity.provider,
          subject: identity.subject,
          email: identity.email,
        },
      },
    },
    select: { id: true, email: true, name: true },
  });

  // وبريدٌ لم يؤكّده مزوّدُه يُؤكَّد برسالةٍ كما يفعل التسجيل بالبريد.
  if (!identity.emailVerified) {
    void sendVerify(user.id, user.email, user.name).catch(() => {});
  }

  return { userId: user.id, created: true };
}
