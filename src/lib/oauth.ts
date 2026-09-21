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
  provider: "GOOGLE" | "APPLE" | "SNAP";
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

/**
 * سناب: **رمزُ وصولٍ لا رمزُ هويّة**.
 *
 * فلا مفاتيحَ تُفحص ولا جمهورٌ يُقارن — بل نسأل خادمَها بالرمز: «من
 * صاحبُ هذا؟». والجوابُ معرّفٌ خارجيّ واسمُ عرض، **ولا بريدَ إطلاقاً**
 * (سناب لا تعطيه)، فمن دخل بها يربط بريده من الإعدادات.
 *
 * والسؤالُ من خادمنا لا من الجهاز: رمزٌ يمرّ بالتطبيق وحده يصدّقه من
 * يكتبه بيده.
 */
async function readSnap(accessToken: string): Promise<Identity> {
  if (!process.env.SNAP_CLIENT_ID) throw new Error("الدخول بسناب غير مفعّل");

  /*
     و`kit.snapchat.com` لا `api.snapchat.com`: الثاني يُحلّ إلى
     `feelinsonice-hrd.appspot.com` — خادمُ سناب القديم على App Engine —
     بشهادةٍ لا تحمل اسمه، فيسقط الطلب في المصافحة قبل أن يصل. وNode
     تردّ عليه «fetch failed» عاريةً، فلا يقول السجلّ إنّ العلّة في
     العنوان لا في الشبكة.
  */
  const response = await fetch("https://kit.snapchat.com/v1/me", {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ query: "{me{externalId displayName}}" }),
  });
  /*
     والحالتان تُفرَّقان في السجلّ وإن اتّحدت الرسالة: ردٌّ برفضٍ من سناب
     شيء، وردٌّ بنجاحٍ لا معرّف فيه شيءٌ آخر — والأولى مفاتيحُ والثانية
     صلاحيّاتٌ لم تُمنح. ولا يُكتب الرمز.
  */
  if (!response.ok) {
    console.error("[snap] /v1/me", response.status, (await response.text().catch(() => "")).slice(0, 300));
    throw new Error("تعذّر التحقّق من الرمز");
  }

  const payload = (await response.json()) as {
    data?: { me?: { externalId?: string; displayName?: string } };
  };
  const me = payload.data?.me;
  if (!me?.externalId) {
    console.error("[snap] /v1/me ردٌّ بلا externalId", JSON.stringify(payload).slice(0, 300));
    throw new Error("تعذّر التحقّق من الرمز");
  }

  return {
    provider: "SNAP",
    subject: me.externalId,
    email: null,
    name: me.displayName ?? null,
    emailVerified: false,
  };
}

/**
 * سببُ خطأٍ نصّاً، ومعه سببُه إن كان له سبب.
 *
 * `fetch` في Node تردّ «fetch failed» لكلّ عطلٍ في الشبكة — عنوانٌ لا
 * يُحلّ، ومنفذٌ مغلق، ومصافحةٌ مرفوضة، ومهلةٌ — والفرقُ بينها كلُّ ما
 * يهمّ، وهو في `cause` وحدها. وبلا قراءتها يبقى السجلّ يقول «فشل».
 */
function why(problem: unknown): string {
  if (!(problem instanceof Error)) return String(problem);
  const cause = problem.cause;
  const inner =
    cause instanceof Error
      ? `${cause.message}${"code" in cause ? ` (${String((cause as { code?: unknown }).code)})` : ""}`
      : cause
        ? String(cause)
        : "";
  return inner ? `${problem.message} · ${inner}` : problem.message;
}

export async function readIdentity(
  provider: "GOOGLE" | "APPLE" | "SNAP",
  idToken: string,
  name: string | null,
): Promise<Identity> {
  try {
    if (provider === "APPLE") return await readApple(idToken, name);
    if (provider === "SNAP") return await readSnap(idToken);
    return await readGoogle(idToken);
  } catch (problem) {
    if (problem instanceof Error && problem.message.includes("غير مفعّل")) throw problem;
    /*
       الرسالةُ تُسطَّح في وجه المستخدم عمداً — تفصيلُ سببِ رفضِ رمزٍ
       يعين من يجرّب — لكنّها لا تُسطَّح في السجلّ: بلا هذا السطر يبقى
       «تعذّر التحقّق من الرمز» كلَّ ما يملكه من يصلح العطل، وهي تقول
       كلَّ شيءٍ إلا ما جرى.
    */
    console.error("[oauth]", provider, why(problem));
    throw new Error("تعذّر التحقّق من الرمز", { cause: problem });
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
     **وحسابُ سناب يُنشأ بلا بريد**: سناب لا تعطيه، ويربطه صاحبُه من
     الإعدادات. ومن أخفى بريده عند آبل يصلنا عنوانُها المُقنَّع
     (`privaterelay`) وهو صالحٌ يصل صاحبَه، فيُقبل كغيره.

     وغيرُ سناب لا بدّ له من بريد: آبل وقوقل تعطيانه، وغيابُه عندهما
     يعني رمزاً ناقصاً لا حساباً بلا بريد.
  */
  if (!identity.email && identity.provider !== "SNAP") {
    throw new Error("لم يعطنا المزوّد بريداً — جرّب الدخول بالبريد");
  }

  const last = await prisma.user.findFirst({
    orderBy: { memberNo: "desc" },
    select: { memberNo: true },
  });

  const user = await prisma.user.create({
    data: {
      email: identity.email,
      name: identity.name?.trim() || identity.email?.split("@")[0] || "صديق",
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
  if (!identity.emailVerified && user.email) {
    void sendVerify(user.id, user.email, user.name).catch(() => {});
  }

  return { userId: user.id, created: true };
}
