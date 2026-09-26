"use server";

import { recordCity } from "@/lib/city";
import { cityInput } from "@/lib/city-input";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  createSession,
  currentUser,
  destroySession,
  hashPassword,
  requireUser,
  verifyPassword,
} from "@/lib/auth";
import { assertRoomForBoth, circleIds } from "@/lib/circle";
import { STORY_HOURS, STORY_SECONDS } from "@/lib/stories";
import { canInteract, canSeeMoment } from "@/lib/visibility";
import { reverseGeocode } from "@/lib/places";
import { HEX_COLOR, PALETTE_KEYS } from "@/lib/theme";
import { consume, sendReset, sendVerify } from "@/lib/email-tokens";
import { readIdentity, upsertIdentity } from "@/lib/oauth";
import { mailReply, tellSupport } from "@/lib/support-mail";
import { deliverTo, openConversation, VOICE_SECONDS } from "@/lib/dm";
import { copyMedia, dropMedia, migrateToCloud, storeClip, storeUpload } from "@/lib/media";
import { cloudReady, probeBucket } from "@/lib/storage";
import { isSupportedMusicUrl, resolveTrack } from "@/lib/music-link";
import { guard } from "@/lib/moderation";
import { SUSPEND_HOURS } from "@/lib/suspend";
import { isPlusDays, PLUS_COINS, PLUS_LABEL } from "@/lib/plus";
import type { MomentKind, ReactionKind } from "@/generated/prisma/client";
import { requestSignup } from "@/lib/signup";

// ───────────────────────────── الدخول والخروج ─────────────────────────────

const credentials = z.object({
  email: z.string().trim().toLowerCase().email("بريد غير صالح"),
  password: z.string().min(1, "اكتب كلمة المرور"),
});

/**
 * طلبُ إنشاء حساب بالبريد.
 *
 * **ولا يُنشأ حسابٌ هنا** (`lib/signup.ts`): يُحفظ الطلبُ ويُرسَل
 * الرابط، ويُولَد `User` عند فتحه فيأخذ رقمَ عضويّته حينئذٍ — فلا تبقى
 * عضويّةٌ بلا صاحب إن لم يؤكّد (القاعدة ١٥).
 *
 * وكان بابُ التسجيل مفقوداً من الويب والجوّال معاً والخادمُ يحمله:
 * فمن لا يملك قوقل ولا آبل ولا سناب لا يدخل التطبيق بحال — وأوّلُ ما
 * يفعله مراجعُ المتجر أن يُنشئ حساباً.
 */
const newAccount = z.object({
  name: z.string().trim().min(2, "اكتب اسمك").max(40, "الاسم طويل"),
  email: z.string().trim().toLowerCase().email("بريد غير صالح"),
  password: z.string().min(8, "كلمة المرور ثمانية أحرف فأكثر"),
});

export async function signUp(
  _previous: { ok?: string; error?: string } | null,
  formData: FormData,
): Promise<{ ok?: string; error?: string }> {
  const parsed = newAccount.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  }
  return requestSignup(parsed.data);
}

export async function signIn(
  _previous: { error?: string } | null,
  formData: FormData,
): Promise<{ error?: string }> {
  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  // رسالة واحدة للحالتين حتى لا يكشف النموذج أي البُرد مسجَّلة.
  // ومن دخل بمزوّدٍ ولم يضع كلمةً بعد لا كلمةَ له تُطابَق — والرسالةُ
  // واحدةٌ في الحالين، فلا يُعرف من الشاشة أيُّ بريدٍ مسجّل ولا كيف دخل.
  const ok =
    user && user.passwordHash
      ? await verifyPassword(parsed.data.password, user.passwordHash)
      : false;
  if (!user || !ok) return { error: "البريد أو كلمة المرور غير صحيحة" };

  await createSession(user.id);
  redirect("/");
}

/**
 * «نسيت كلمة المرور»: رسالةٌ فيها رابطٌ لساعةٍ واحدة.
 *
 * **والجواب واحدٌ سواء وُجد الحساب أو لم يوجد**: لو قلنا «لا حساب بهذا
 * البريد» لصار البابُ وسيلةً لمعرفة من عندنا حسابٌ ومن ليس عنده. ومثلُه
 * حين تُمنع رسالةٌ ثانيةً في دقيقة، أو حين لا يكون البريدُ مربوطاً بعد.
 */
export async function requestReset(
  _prev: { ok?: string; error?: string } | null,
  formData: FormData,
): Promise<{ ok?: string; error?: string }> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const said = { ok: "إن كان هذا البريد مسجّلاً عندنا فقد أرسلنا إليه رابطاً. تحقّق من بريدك." };
  if (!email.includes("@")) return { error: "اكتب بريداً صحيحاً" };

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true },
  });
  // ومن لا بريدَ له (دخل بسناب) لا يصله شيء — ولا يُقال ذلك للسائل.
  if (user?.email) await sendReset(user.id, user.email, user.name);
  return said;
}

/**
 * ضبطُ كلمة المرور بالرابط.
 *
 * والرمزُ يُستهلك قبل الكتابة: رابطٌ يُفتح مرّتين لا يضبط كلمتين.
 * **وتُبطَل جلساتُه القائمة**: من نسي كلمته قد يكون فقد جهازه، وإعادةُ
 * الضبط بابُه الوحيد لإخراج من فيه.
 */
export async function resetPassword(
  _prev: { ok?: string; error?: string } | null,
  formData: FormData,
): Promise<{ ok?: string; error?: string }> {
  const token = String(formData.get("token") ?? "");
  const next = String(formData.get("next") ?? "");
  const again = String(formData.get("again") ?? "");

  if (next.length < 8) return { error: "كلمة المرور ٨ أحرف فأكثر" };
  if (next !== again) return { error: "الكلمتان غير متطابقتين" };

  const read = await consume(token, "RESET");
  if ("error" in read) return { error: read.error };

  await prisma.$transaction([
    prisma.user.update({
      where: { id: read.userId },
      data: {
        passwordHash: await hashPassword(next),
        // من وصلته الرسالة يملك البريد، فهذا تأكيدُه أيضاً.
        emailVerifiedAt: new Date(),
      },
    }),
    // الجلساتُ القائمة تذهب: قد يكون الجهازُ القديم في يدٍ أخرى.
    prisma.refreshToken.deleteMany({ where: { userId: read.userId } }),
  ]);

  return { ok: "تم ضبط كلمة المرور — تقدر تدخل بها الآن" };
}

/** إعادةُ إرسال رسالة التأكيد من الإعدادات. */
export async function resendVerify(): Promise<{ ok?: string; error?: string }> {
  const user = await requireUser();
  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { email: true, name: true, emailVerifiedAt: true },
  });
  if (!row) return { error: "لا يوجد هذا الحساب" };
  if (!row.email) return { error: "اربط بريدك أوّلاً" };
  if (row.emailVerifiedAt) return { ok: "بريدك مؤكَّد أصلاً" };

  const sent = await sendVerify(user.id, row.email, row.name);
  return sent
    ? { ok: "أرسلنا رابط التأكيد إلى بريدك" }
    : { error: "تعذّر الإرسال الآن — جرّب بعد دقيقة" };
}

/**
 * الدخول بمزوّد من الويب.
 *
 * الصفحةُ تأخذ رمزَ الهويّة من المزوّد، والخادمُ يتحقّق منه ثمّ يفتح
 * جلستَنا — ولا يُصدَّق ما يرسله المتصفّح كما جاء.
 */
export async function signInWithProvider(
  provider: "GOOGLE" | "APPLE",
  idToken: string,
): Promise<{ error?: string }> {
  try {
    const identity = await readIdentity(provider, idToken, null);
    const { userId } = await upsertIdentity(identity);
    await createSession(userId);
  } catch (problem) {
    return { error: problem instanceof Error ? problem.message : "تعذّر الدخول" };
  }
  redirect("/");
}

export async function signOut(): Promise<void> {
  await destroySession();
  redirect("/login");
}

/**
 * حذف الحساب من داخل التطبيق — شرط من شروط متجر آبل لكل تطبيق فيه
 * تسجيل دخول، ولا يكفي فيه إيقاف الحساب أو مراسلة الدعم.
 *
 * حذفٌ حقيقي لا تعطيل: صفّ المستخدم يذهب ومعه كل ما يشير إليه بالتتالي —
 * لحظاته وصوره وتفاعلاته وتعليقاته ومحادثاته وصداقاته. ولهذا يُطلب
 * كلمة المرور: جهازٌ مفتوح في يد غير صاحبه لا يجب أن يمحو عمر حساب
 * بضغطتين.
 */
export async function deleteAccount(
  _prev: string | null,
  formData: FormData,
): Promise<string | null> {
  const user = await requireUser();

  const password = String(formData.get("password") ?? "");
  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  /*
     كلمة مرور خاطئة تُردّ رسالةً في الشاشة لا استثناءً يكسرها: هذه آخر
     خطوة قبل فقد كل شيء، فلا يجوز أن تنتهي بصفحة خطأ غامضة.

     **ومن دخل بمزوّدٍ ولا كلمةَ له يكتب بريده** بدلها: لا بدّ من شيءٍ
     يعرفه هو ولا يعرفه من التقط جهازه المفتوح، وحذفٌ بضغطةٍ واحدة ليس
     حذفاً بل حادثة.
  */
  if (!row) return "كلمة المرور غير صحيحة";
  /*
     ومن لا كلمةَ له ولا بريد (دخل بسناب ولم يربط بريداً) يكتب **اسمه**
     كما هو: شيءٌ يعرفه هو، ولا بدّ من حاجزٍ قبل آخر خطوة.
  */
  const proof = (row.passwordHash ?? null)
    ? await verifyPassword(password, row.passwordHash as string)
    : password.trim().toLowerCase() === (user.email ?? user.name).toLowerCase();
  if (!proof) {
    return row.passwordHash
      ? "كلمة المرور غير صحيحة"
      : user.email
        ? "اكتب بريدك كما هو للتأكيد"
        : "اكتب اسمك كما هو للتأكيد";
  }

  /*
    ملفاته تُجمَع قبل حذفه: الصفوف تذهب بـ`Cascade`، وكائنات السحابة لا
    تذهب معها — فتبقى بكسلاته بعد ذهاب حسابه.
  */
  const files = await prisma.media.findMany({
    where: { ownerId: user.id },
    select: { id: true },
  });
  await dropMedia(files.map((row) => row.id));

  await prisma.user.delete({ where: { id: user.id } });
  await destroySession();
  redirect("/login?deleted=1");
}

// ───────────────────────────── اللحظات ─────────────────────────────

/** تدرّجات تقوم مقام رفع الصور في النموذج الأولي. */
const IMAGE_SPECS = [
  "linear-gradient(160deg,#f6b93b,#ff7a5a 55%,#8c3f4a)",
  "linear-gradient(160deg,#ffb27a,#c05a54 70%,#3b2a33)",
  "linear-gradient(160deg,#f7f5ef,#d09a72 45%,#5a4152)",
  "linear-gradient(160deg,#8fa7b8,#3f5a6b 60%,#0e1a24)",
  "linear-gradient(160deg,#ffd27a,#d1706a 55%,#2f3742)",
];

const randomImage = () => IMAGE_SPECS[Math.floor(Math.random() * IMAGE_SPECS.length)];

/**
 * الإشارة «مع فلان» تظهر فوراً بلا موافقة.
 * اللحظة تُنشر في صفحة كاتبها وحده ولا تدخل صفحة المُشار إليه، وهذا سلوك
 * Path نفسه. ولا يُشار إلا لمن هو داخل الدائرة.
 */
async function attachTags(momentId: string, authorId: string, userIds: string[]): Promise<void> {
  const wanted = [...new Set(userIds)].filter((id) => id && id !== authorId);
  if (wanted.length === 0) return;

  const allowed = new Set(await circleIds(authorId));
  const data = wanted.filter((id) => allowed.has(id)).map((userId) => ({ momentId, userId }));
  if (data.length === 0) return;

  await prisma.momentTag.createMany({ data, skipDuplicates: true });
}

/**
 * جمهور اللحظة من النموذج.
 *
 * `audience` إما `CIRCLE` أو معرّف تصنيف أو `PICKED` ومعها المختارون.
 * وحين لا يختار الناشر شيئاً يُطبَّق تصنيفه الافتراضي من الخصوصية —
 * «من يمكنه رؤية لحظاتي» — فالإعداد يعمل بلا أن يتذكّره أحد.
 */
async function readAudience(
  formData: FormData,
  user: { id: string },
): Promise<{
  audience: "CIRCLE" | "GROUP" | "PICKED";
  audienceGroupId: string | null;
  viewers: string[];
}> {
  const raw = String(formData.get("audience") ?? "").trim();
  const circle = new Set(await circleIds(user.id));

  if (raw === "PICKED") {
    const viewers = formData
      .getAll("viewer")
      .map(String)
      .filter((id) => circle.has(id));
    if (viewers.length === 0) throw new Error("اختر من يرى هذه اللحظة");
    return { audience: "PICKED", audienceGroupId: null, viewers };
  }

  if (raw && raw !== "CIRCLE" && raw !== "DEFAULT") {
    const group = await prisma.friendGroup.findFirst({
      where: { id: raw, ownerId: user.id },
      select: { id: true },
    });
    if (!group) throw new Error("التصنيف غير موجود");
    return { audience: "GROUP", audienceGroupId: group.id, viewers: [] };
  }

  if (raw === "CIRCLE") return { audience: "CIRCLE", audienceGroupId: null, viewers: [] };

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { viewGroupId: true },
  });
  return row?.viewGroupId
    ? { audience: "GROUP", audienceGroupId: row.viewGroupId, viewers: [] }
    : { audience: "CIRCLE", audienceGroupId: null, viewers: [] };
}

/** يحفظ المختارين بأعيانهم بعد إنشاء اللحظة. */
async function attachViewers(momentId: string, viewers: string[]): Promise<void> {
  if (viewers.length === 0) return;
  await prisma.momentViewer.createMany({
    data: viewers.map((userId) => ({ momentId, userId })),
    skipDuplicates: true,
  });
}

/** حدّ نصّ اللحظة — نفس حدّ الشاشة، فلا يقصّ الخادم ما سمحت به. */
const TEXT_MAX = 250;

/** النبذة سطرٌ يُقرأ تحت الاسم لا فقرة — والرقم نفسه في الشاشة. */
const BIO_MAX = 100;

/**
 * موقعٌ اختياريٌّ على لحظةٍ ليست لحظة مكان.
 *
 * نفس قواعد لحظة المكان: الإحداثيات من الجهاز، والاسم ما اختاره صاحبها من
 * الأماكن حوله وإلا أقرب عنوان — و«إظهار موقعي» مطفأً يُبقي المدينة وحدها.
 */
async function readPlace(
  formData: FormData,
  user: { id: string; city: string | null },
): Promise<{ lat: number | null; lng: number | null; placeName: string | null; placeCity: string | null } | Record<string, never>> {
  const parsed = placeInput.safeParse({ lat: formData.get("lat"), lng: formData.get("lng") });
  if (!parsed.success) return {};

  const { lat, lng } = parsed.data;
  const place = await reverseGeocode(lat, lng);
  const city = place.city ?? user.city;
  const picked = String(formData.get("place") ?? "").trim().slice(0, 80);

  const settings = await prisma.user.findUnique({
    where: { id: user.id },
    select: { shareLocation: true },
  });
  const precise = settings?.shareLocation !== false;

  return {
    lat: precise ? lat : null,
    lng: precise ? lng : null,
    placeName: precise ? (picked || place.name) : null,
    placeCity: city,
  };
}

/** لحظة صورة أو فكرة: نص، وإشارة اختيارية. */
export async function postSimple(formData: FormData): Promise<void> {
  const user = await requireUser();

  const kind = String(formData.get("kind") ?? "");
  if (kind !== "PHOTO" && kind !== "THOUGHT") throw new Error("نوع غير صالح");

  const text = String(formData.get("text") ?? "").trim().slice(0, TEXT_MAX);
  if (!text && kind === "THOUGHT") throw new Error("اكتب شيئاً");
  // الفلترة قبل الكتابة: ما يُمنع يقف عند صاحبه لا بعد أن يراه الناس.
  await guard(text);

  // الصورة المرفوعة تسبق التدرّج؛ التدرّج بديل حين لا توجد صورة.
  let mediaId: string | null = null;
  const picture = formData.get("image");
  if (kind === "PHOTO" && picture instanceof File && picture.size > 0) {
    const stored = await storeUpload(
      user.id,
      picture,
      Number(formData.get("imageWidth") ?? 0),
      Number(formData.get("imageHeight") ?? 0),
    );
    mediaId = stored.id;
  }

  const seen = await readAudience(formData, user);
  // الموقع اختياريٌّ هنا: اللحظة والصورة تحملان مكانهما كما يحمله المكان.
  const where = await readPlace(formData, user);

  const moment = await prisma.moment.create({
    data: {
      authorId: user.id,
      kind: kind as MomentKind,
      text: text || null,
      mediaId,
      imageSpec: kind === "PHOTO" && !mediaId ? randomImage() : null,
      ...where,
      audience: seen.audience,
      audienceGroupId: seen.audienceGroupId,
    },
  });

  await attachViewers(moment.id, seen.viewers);
  await attachTags(moment.id, user.id, formData.getAll("with").map(String));
  revalidatePath("/");
  redirect("/");
}

/** «نام» — بلا نص وبلا إشارة: النوم لا يكون «مع» أحد. */
export async function postSleep(): Promise<void> {
  const user = await requireUser();
  await prisma.moment.create({ data: { authorId: user.id, kind: "SLEEP" } });
  revalidatePath("/");
  redirect("/");
}

/**
 * «صحيت»: لحظةٌ بلا متن — ساعتها هي خبرها.
 *
 * لا نكتب الوقت نصّاً: `createdAt` يحمله، والعرض يقرأه منه. نصٌّ مكتوب
 * يتجمّد حين يتغيّر تنسيق الساعة أو منطقتها، والطابع لا يتجمّد.
 */
export async function postWake(): Promise<void> {
  const user = await requireUser();
  await prisma.moment.create({ data: { authorId: user.id, kind: "WAKE" } });
  revalidatePath("/");
  redirect("/");
}

const placeInput = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

/**
 * المكان يأتي من إذن الموقع في الجهاز، لا من إدخال يدوي.
 * الاسم يُشتق من الإحداثيات على الخادم؛ وإن تعذّر، تبقى الإحداثيات وحدها.
 */
export async function postPlace(formData: FormData): Promise<void> {
  const user = await requireUser();

  const parsed = placeInput.safeParse({
    lat: formData.get("lat"),
    lng: formData.get("lng"),
  });
  if (!parsed.success) throw new Error("تعذّر تحديد موقعك");

  const { lat, lng } = parsed.data;
  const place = await reverseGeocode(lat, lng);
  const city = place.city ?? user.city;
  // ما اختاره صاحبها من الأماكن حوله أصدق من أقرب عنوان: هو يعرف أين هو.
  const picked = String(formData.get("place") ?? "").trim().slice(0, 80);

  const settings = await prisma.user.findUnique({
    where: { id: user.id },
    select: { shareLocation: true },
  });
  // «إظهار موقعي» مطفأ: تُنشر المدينة وحدها بلا اسم المكان ولا إحداثياته.
  const precise = settings?.shareLocation !== false;
  const seen = await readAudience(formData, user);

  const moment = await prisma.moment.create({
    data: {
      authorId: user.id,
      kind: "PLACE",
      lat: precise ? lat : null,
      lng: precise ? lng : null,
      placeName: precise ? (picked || place.name) : (city ?? "مكان"),
      placeCity: city,
      text: String(formData.get("text") ?? "").trim().slice(0, 200) || null,
      audience: seen.audience,
      audienceGroupId: seen.audienceGroupId,
    },
  });

  await attachViewers(moment.id, seen.viewers);

  // الانتقال إلى مدينة أخرى حدثٌ في حياة الدائرة، فيُكتب سطراً مستقلاً.
  // يُشتقّ من التحديد نفسه: لا شاشة له ولا زر، وإلا صار عبئاً على الناشر.
  // بالمدينة المكتشفة لا المكتوبة، ومرّةً لكل وصول (`lib/city.ts`).
  await recordCity(user.id, place.city);

  await attachTags(moment.id, user.id, formData.getAll("with").map(String));
  revalidatePath("/");
  redirect("/");
}

/** نشر أغنية برابطها: يُقرأ عنوانها تلقائياً، ويبقى الرابط ليُفتح ويُسمع. */
export async function postMusicLink(formData: FormData): Promise<void> {
  const user = await requireUser();

  const url = String(formData.get("url") ?? "").trim();
  if (!isSupportedMusicUrl(url)) throw new Error("الرابط غير صالح");

  const track = await resolveTrack(url);
  await prisma.moment.create({
    data: {
      authorId: user.id,
      kind: "MUSIC",
      musicUrl: url,
      musicTitle: track.title ?? (String(formData.get("title") ?? "").trim() || null),
      musicArtist: track.artist,
      musicThumb: track.thumb,
    },
  });

  revalidatePath("/");
  redirect("/");
}

// ───────────────────────────── الصورة والغلاف ─────────────────────────────

/**
 * صورة العرض.
 *
 * تردّ نصَّ الخطأ ولا ترميه: رميُه في إجراءٍ يُستدعى من زرٍّ يُسقط الشاشة
 * كلها، فيرى صاحبها «فشل» بلا سبب — أو لا يرى شيئاً أصلاً.
 */
/** الصورة ومقاسها من النموذج — وسائط الإجراء لا تحمل ملفاً بنفسها. */
function picture(formData: FormData): { file: File; width: number; height: number } {
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) throw new Error("ما وصلت الصورة");
  return {
    file,
    width: Number(formData.get("width") ?? 0),
    height: Number(formData.get("height") ?? 0),
  };
}

export async function setAvatar(formData: FormData): Promise<string | void> {
  const user = await requireUser();
  try {
    const { file, width, height } = picture(formData);
    // صورة العرض المتحركة من مزايا آثار+ — والفحص هنا، فالعميل ليس قيداً.
    const media = await storeUpload(user.id, file, width, height, user.isPlus);
    await prisma.user.update({ where: { id: user.id }, data: { avatarMediaId: media.id } });
  } catch (problem) {
    return problem instanceof Error ? problem.message : "تعذّر حفظ الصورة";
  }
  revalidatePath("/me");
  revalidatePath("/");
}

export async function setCover(formData: FormData): Promise<string | void> {
  const user = await requireUser();
  try {
    const { file, width, height } = picture(formData);
    const media = await storeUpload(user.id, file, width, height);
    await prisma.user.update({
      where: { id: user.id },
      data: { coverMediaId: media.id, coverY: 50, coverX: 50, coverZoom: 100 },
    });
  } catch (problem) {
    return problem instanceof Error ? problem.message : "تعذّر حفظ الصورة";
  }
  revalidatePath("/me");
  revalidatePath("/");
}

/** ضبط الغلاف: نسبة الموضع العمودي التي وقف عندها السحب. */
/** نشر قصة: صورة تُعرض لأصدقائك يوماً ثم تذهب. */
export async function postStory(
  formData: FormData,
): Promise<{ ok?: string; error?: string }> {
  const user = await requireUser();
  try {
    const file = formData.get("image");
    if (!(file instanceof File) || file.size === 0) return { error: "ما وصل الملف" };

    const width = Number(formData.get("width") ?? 0);
    const height = Number(formData.get("height") ?? 0);
    const filter = String(formData.get("filter") ?? "").slice(0, 20) || null;

    // الفيديو له حدّه بالثواني، والصورة لا مدّة لها.
    const video = file.type.startsWith("video/");
    const seconds = video ? Math.round(Number(formData.get("seconds") ?? 0)) : null;
    if (video && (!Number.isFinite(seconds) || (seconds ?? 0) < 1)) {
      return { error: "تعذّرت قراءة مدّة الفيديو" };
    }
    if (video && (seconds ?? 0) > STORY_SECONDS + 1) {
      return { error: `الحدّ ${STORY_SECONDS} ثانية` };
    }

    const media = video
      ? await storeClip(user.id, file, "video", width, height)
      : await storeUpload(user.id, file, width, height);

    await prisma.story.create({
      data: {
        authorId: user.id,
        mediaId: media.id,
        filter,
        seconds,
        expiresAt: new Date(Date.now() + STORY_HOURS * 60 * 60 * 1000),
      },
    });
  } catch (problem) {
    return { error: problem instanceof Error ? problem.message : "تعذّر النشر" };
  }

  revalidatePath("/circle");
  revalidatePath("/");
  return { ok: "نُشرت" };
}

/** إيصال مشاهدة القصة — منه تُطفأ حلقتها. */
export async function seeStory(storyId: string): Promise<void> {
  const user = await requireUser();
  await prisma.storyView.upsert({
    where: { storyId_userId: { storyId, userId: user.id } },
    create: { storyId, userId: user.id },
    update: {},
  });
}

export async function deleteStory(storyId: string): Promise<void> {
  const user = await requireUser();
  await prisma.story.deleteMany({ where: { id: storyId, authorId: user.id } });
  revalidatePath("/circle");
}

export async function setCoverPosition(y: number): Promise<void> {
  const user = await requireUser();
  const value = Math.round(Math.min(100, Math.max(0, Number(y) || 0)));
  await prisma.user.update({ where: { id: user.id }, data: { coverY: value } });
  revalidatePath("/me");
  revalidatePath("/");
}

export async function clearCover(): Promise<void> {
  const user = await requireUser();
  await prisma.user.update({ where: { id: user.id }, data: { coverMediaId: null } });
  revalidatePath("/me");
  revalidatePath("/");
}

// ───────────────────────────── لوحة المشرف ─────────────────────────────

/**
 * كل إجراء مشرف يتحقق من الصلاحية بنفسه — إخفاء الرابط ليس حماية.
 *
 * المالك (`role = ADMIN`) يملك كل شيء. وغيره يُمنح مدىً: «المتجر» يفتح
 * أصناف المتجر وتصنيفاته وحدها، و«اللوحة» يفتحها كاملةً — عدا منح
 * الصلاحيات نفسها، فتلك للمالك وحده وإلا منح المشرفُ نفسَه ما شاء.
 */
async function requireAdmin(area: "store" | "panel" = "panel") {
  const user = await requireUser();
  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true, adminScope: true },
  });
  if (!row) throw new Error("هذه الصفحة للمشرفين");
  const allowed =
    row.role === "ADMIN" ||
    row.adminScope === "ALL" ||
    (area === "store" && row.adminScope === "STORE");
  if (!allowed) throw new Error("هذه الصفحة للمشرفين");
  return user;
}

/** منح الصلاحيات وسحبها: للمالك وحده. */
async function requireOwner() {
  const user = await requireUser();
  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true },
  });
  if (row?.role !== "ADMIN") throw new Error("هذا للمالك وحده");
  return user;
}

/** يقرأ ألوان الثيم من النموذج، ويردّ `null` إن لم تُطلب أو نقصت. */
function readPalette(formData: FormData): string | null {
  if (formData.get("hasPalette") !== "on") return null;
  const out: Record<string, string> = {};
  for (const key of PALETTE_KEYS) {
    const value = String(formData.get(`palette.${key}`) ?? "").trim();
    if (!HEX_COLOR.test(value)) return null;
    out[key] = value.toLowerCase();
  }
  return JSON.stringify(out);
}

/** نتيجة نموذج في اللوحة: رسالة تُعرض في الشاشة بدل استثناء يكسرها. */
export type AdminResult = { ok?: string; error?: string } | null;

const storeItemInput = z.object({
  kind: z.enum(["FRAME", "BACKGROUND", "THEME", "CHARM", "BUNDLE"]),
  name: z.string().trim().min(1, "اكتب الاسم").max(40),
  priceCoins: z.coerce.number().int().min(0).max(1_000_000),
  spec: z.string().trim().min(1, "اكتب تدرّج CSS").max(1000),
  plusOnly: z.coerce.boolean(),
  earnedAfterDays: z.coerce.number().int().min(0).max(3650).optional(),
  /** التصنيف اختياري: صنفٌ بلا تصنيف يظهر في «المميز» وحده. */
  categoryId: z.string().trim().optional(),
  limited: z.coerce.boolean(),
  hidden: z.coerce.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
});

const categoryInput = z.object({
  name: z.string().trim().min(1, "اكتب اسم التصنيف").max(30),
  slug: z
    .string()
    .trim()
    .min(2, "اكتب معرّفاً إنجليزياً")
    .max(24)
    .regex(/^[a-z0-9-]+$/, "المعرّف حروف إنجليزية صغيرة وأرقام وشرطة"),
  sortOrder: z.coerce.number().int().min(0).max(999).optional(),
});

// ───────────────────────── تصنيفات المتجر (اللوحة) ─────────────────────────

// ───────────────────────────── الوسوم ─────────────────────────────


const tagInput = z.object({
  name: z.string().trim().min(1, "اكتب اسم الوسم").max(20),
  bg: z.string().trim().regex(HEX_COLOR, "لون الخلفية بصيغة #rrggbb"),
  fg: z.string().trim().regex(HEX_COLOR, "لون النص بصيغة #rrggbb"),
  autoForPlus: z.coerce.boolean(),
});

function readTag(formData: FormData) {
  return tagInput.safeParse({
    name: formData.get("name"),
    // منتقي اللون يعطي حروفاً كبيرة أحياناً، والقاعدة لا تفرّق — لكن
    // الفحص يفرّق، فتُوحَّد قبله.
    bg: String(formData.get("bg") ?? "").toLowerCase(),
    fg: String(formData.get("fg") ?? "").toLowerCase(),
    autoForPlus: formData.get("autoForPlus") === "on",
  });
}

/** وسم واحد فقط يُمنح تلقائياً للمشتركين، وإلا تنازع وسمان على الاسم نفسه. */
async function keepSingleAuto(tagId: string, autoForPlus: boolean) {
  if (!autoForPlus) return;
  await prisma.tag.updateMany({
    where: { id: { not: tagId }, autoForPlus: true },
    data: { autoForPlus: false },
  });
}

function revalidateTags() {
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/me");
  revalidatePath("/circle");
}

/**
 * الإشراف: المالك، أو مشرفٌ مُنح `canModerate`.
 *
 * ويُقرأ من الصفّ في كل إجراء لا من الجلسة: هذا الباب يقرأ لحظات الناس
 * ويحذفها، فلا يكفي أن تكون الصفحة مخفيّة (القاعدة ١٣).
 */
async function requireModerator() {
  const user = await requireUser();
  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true, canModerate: true },
  });
  if (row?.role !== "ADMIN" && !row?.canModerate) throw new Error("هذا للمشرفين");
  return user;
}

/**
 * حذفُ لحظةٍ بيد مشرف — لا بيد صاحبها.
 *
 * البلاغ يصل على منشور، فلا بدّ من بابٍ يدخله المشرف ليتأكّد ثم يحذف.
 * وما يذهب معها يذهب: التفاعلات والتعليقات بـ`Cascade` (القاعدة ٦١)،
 * وصورتها بيدها لأنّ علاقتها `SetNull` (القاعدة ٨٤).
 *
 * وكلُّ حذفٍ يُختم في `ModerationLog`: سلطةٌ بلا أثرٍ مكتوب لا يُسأل عنها
 * أحد. والإجراء يردّ رسالةً ولا يرمي (القاعدة ٣١ و٩٠).
 */
export async function removeMomentAsAdmin(
  momentId: string,
  _prev: AdminResult,
): Promise<AdminResult> {
  const admin = await requireModerator();

  const moment = await prisma.moment.findUnique({
    where: { id: momentId },
    select: { id: true, authorId: true, text: true, mediaId: true },
  });
  if (!moment) return { error: "اللحظة غير موجودة" };

  await prisma.moderationLog.create({
    data: {
      adminId: admin.id,
      action: "MOMENT_REMOVED",
      targetId: moment.id,
      ownerId: moment.authorId,
      snippet: moment.text?.slice(0, 200) ?? null,
    },
  });

  await prisma.moment.delete({ where: { id: moment.id } });
  if (moment.mediaId) await dropMedia([moment.mediaId]);

  revalidatePath(`/admin/u/${moment.authorId}`);
  revalidatePath("/admin");
  return { ok: "حُذفت اللحظة" };
}

// ───────────────────────────── الدعم الفني ─────────────────────────────

/**
 * الدعم داخل التطبيق لا بريدٌ خارجه.
 *
 * الرسالة تُحفظ في القاعدة ويقرؤها المشرف في اللوحة ويردّ عليها، ويقرأ
 * صاحبها الردّ في مكانه — بريدٌ في صفحة «تواصل معنا» يعني رسالةً تخرج من
 * التطبيق فلا يعرف أحد أوصلت أم لا.
 */
export async function openTicket(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  const user = await requireUser();
  const body = String(formData.get("body") ?? "").trim().slice(0, 1200);
  if (body.length < 5) return { error: "اكتب رسالتك" };

  // رسالةٌ مفتوحة واحدة تكفي: تكرارها يُغرق اللوحة ولا يُسرّع الردّ.
  const open = await prisma.supportTicket.count({ where: { userId: user.id, closed: false } });
  if (open >= 3) return { error: "عندك رسائل مفتوحة — انتظر الردّ عليها" };

  await prisma.supportTicket.create({ data: { userId: user.id, body } });
  // خبرٌ إلى صندوق الدعم: لوحةٌ لا يفتحها أحدٌ تترك سؤالاً أسبوعاً.
  void tellSupport({ from: `${user.name} (#${user.memberNo})`, body });
  revalidatePath("/settings/support");
  revalidatePath("/admin");
  return { ok: "وصلتنا رسالتك — نردّ عليك هنا" };
}

// ───────────────────────────── الدائرة ─────────────────────────────

/**
 * قبول الصداقة ينشئ لحظة «أضاف فلاناً» لكلا الطرفين — فالإضافة حدث في
 * حياة الدائرة يستحق أن يُرى، لا تغييراً صامتاً في جدول.
 */
export async function acceptFriend(friendshipId: string): Promise<void> {
  const user = await requireUser();

  const friendship = await prisma.friendship.findUnique({
    where: { id: friendshipId },
    select: { id: true, requesterId: true, addresseeId: true, status: true },
  });
  if (!friendship || friendship.addresseeId !== user.id) throw new Error("غير مصرح");
  if (friendship.status === "ACCEPTED") return;

  await assertRoomForBoth(friendship.requesterId, friendship.addresseeId);

  const other = await prisma.user.findUnique({
    where: { id: friendship.requesterId },
    select: { name: true },
  });

  await prisma.$transaction([
    prisma.friendship.update({ where: { id: friendshipId }, data: { status: "ACCEPTED" } }),
    prisma.moment.create({
      data: {
        authorId: user.id,
        kind: "FRIEND_ADDED",
        text: other?.name ?? null,
        tags: { create: { userId: friendship.requesterId } },
      },
    }),
    prisma.moment.create({
      data: {
        authorId: friendship.requesterId,
        kind: "FRIEND_ADDED",
        text: user.name,
        tags: { create: { userId: user.id } },
      },
    }),
  ]);

  revalidatePath("/");
  revalidatePath("/circle");
}

/** تُرفض الطلبات بالحذف: لا حالة «مرفوض» تُبقي أثراً لمن رفض من. */
export async function ignoreFriend(friendshipId: string): Promise<void> {
  const user = await requireUser();
  const friendship = await prisma.friendship.findUnique({
    where: { id: friendshipId },
    select: { addresseeId: true, status: true },
  });
  if (!friendship || friendship.addresseeId !== user.id) throw new Error("غير مصرح");
  if (friendship.status === "ACCEPTED") throw new Error("الصداقة مقبولة");

  await prisma.friendship.delete({ where: { id: friendshipId } });
  revalidatePath("/circle");
}

/**
 * طلب صداقة يُرسل من المقترحين وحدهم — ومن يجمعك به صديق مشترك.
 * لا بحث بالبريد ولا اكتشاف عام: من لا يعرفه أحد من دائرتك لا يظهر لك
 * ولا يصلك منه طلب.
 */
/**
 * إخراج صديق من الدائرة.
 * حذفٌ للصفّ لا حالة «سابق»: الدائرة سجلّ من فيها الآن، لا أرشيف من مرّ.
 */
export async function removeFriend(friendId: string): Promise<void> {
  const user = await requireUser();
  await prisma.friendship.deleteMany({
    where: {
      OR: [
        { requesterId: user.id, addresseeId: friendId },
        { requesterId: friendId, addresseeId: user.id },
      ],
    },
  });
  revalidatePath("/circle");
  revalidatePath("/");
}

export async function requestFriend(targetId: string): Promise<void> {
  const user = await requireUser();
  if (targetId === user.id) throw new Error("لا يمكنك إضافة نفسك");

  /*
    ولا يُشترط صديقٌ مشترك: من فتح بطاقةً يرسل طلباً، وصاحبُها يقبل أو
    يدع — الحارسُ هو القبول لا الوصول (القاعدة ٢٠).
  */
  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true },
  });
  if (!target) throw new Error("لا يوجد هذا الحساب");

  await assertRoomForBoth(user.id, targetId);
  await prisma.friendship.upsert({
    where: { requesterId_addresseeId: { requesterId: user.id, addresseeId: targetId } },
    create: { requesterId: user.id, addresseeId: targetId },
    update: {},
  });

  revalidatePath("/circle");
  revalidatePath(`/u/${targetId}`);
}

// ───────────────────────────── التصنيفات والخصوصية ─────────────────────────────

/**
 * التصنيف يملكه صاحبه وحده: تصنيفك لشخصٍ «عائلة» لا يراه هو ولا غيره،
 * وهو الفرق بين تنظيمٍ لنفسك وتسميةٍ تُلصق بالناس.
 */
export async function createGroup(formData: FormData): Promise<void> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim().slice(0, 20);
  if (!name) throw new Error("اكتب اسم التصنيف");

  const last = await prisma.friendGroup.findFirst({
    where: { ownerId: user.id },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  await prisma.friendGroup.upsert({
    where: { ownerId_name: { ownerId: user.id, name } },
    create: { ownerId: user.id, name, sortOrder: (last?.sortOrder ?? 0) + 1 },
    update: {},
  });
  revalidatePath("/circle");
  revalidatePath("/settings/privacy");
}

export async function deleteGroup(groupId: string): Promise<void> {
  const user = await requireUser();
  await prisma.friendGroup.deleteMany({ where: { id: groupId, ownerId: user.id } });
  revalidatePath("/circle");
  revalidatePath("/settings/privacy");
}

/** نقل صديق إلى تصنيف، أو إخراجه منها كلها بقيمة فارغة. */
export async function setFriendGroup(friendId: string, formData: FormData): Promise<void> {
  const user = await requireUser();

  const circle = await circleIds(user.id);
  if (!circle.includes(friendId)) throw new Error("ليس من أصدقائك");

  const groupId = String(formData.get("groupId") ?? "");
  const mine = await prisma.friendGroup.findMany({
    where: { ownerId: user.id },
    select: { id: true },
  });
  const ids = mine.map((group) => group.id);

  await prisma.groupMember.deleteMany({ where: { userId: friendId, groupId: { in: ids } } });
  if (groupId && ids.includes(groupId)) {
    await prisma.groupMember.create({ data: { groupId, userId: friendId } });
  }

  revalidatePath("/circle");
}

export async function savePrivacy(formData: FormData): Promise<void> {
  const user = await requireUser();

  const groups = await prisma.friendGroup.findMany({
    where: { ownerId: user.id },
    select: { id: true },
  });
  const ids = new Set(groups.map((group) => group.id));
  const pick = (name: string) => {
    const value = String(formData.get(name) ?? "");
    return value && ids.has(value) ? value : null;
  };

  await prisma.user.update({
    where: { id: user.id },
    data: {
      viewGroupId: pick("viewGroupId"),
      interactGroupId: pick("interactGroupId"),
      shareLocation: formData.get("shareLocation") === "on",
      // وإشعارُ الإشارة انتقل إلى «التنبيهات» — فلا يُكتب من هنا بحال:
      // نموذجٌ لا يحمل الحقل كان سيطفئه في كل حفظٍ للخصوصية.
    },
  });

  revalidatePath("/settings");
  revalidatePath("/");
}

/**
 * تفضيلات التنبيهات.
 *
 * حقلٌ لكل نوع، فيقرأ المرسلُ ما يخصّه وحده. **وتسري على تنبيهات
 * الجهاز** لا على تبويب الإشعارات: التبويب سجلُّ ما جرى، وإطفاءُ نوعٍ
 * يعني «لا توقظني» لا «امحُ الخبر» — ومن أطفأ التفاعلات ثم فتح
 * التطبيق يريد أن يرى من تفاعل.
 *
 * والوضع الهادئ دقائقُ من منتصف الليل: «١٠:٣٠ مساءً» وقتٌ يختاره
 * الناس، والساعةُ وحدها لا تكفيه. وفراغُ أحد الطرفين إلغاءٌ للوضع كلّه
 * — بدايةٌ بلا نهاية صمتٌ إلى الأبد.
 */
export async function saveNotifications(formData: FormData): Promise<void> {
  const user = await requireUser();

  const on = (name: string) => formData.get(name) === "on";
  /** «٢٢:٣٠» ← ١٣٥٠ دقيقة. وما ليس وقتاً يردّ فراغاً. */
  const minutes = (name: string): number | null => {
    const raw = String(formData.get(name) ?? "");
    const match = /^(\d{1,2}):(\d{2})$/.exec(raw);
    if (!match) return null;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour > 23 || minute > 59) return null;
    return hour * 60 + minute;
  };

  const quiet = on("quiet");
  const from = quiet ? minutes("quietFrom") : null;
  const to = quiet ? minutes("quietTo") : null;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      notifyDm: on("notifyDm"),
      notifyFriend: on("notifyFriend"),
      notifyOnTag: on("notifyOnTag"),
      notifyReaction: on("notifyReaction"),
      notifyComment: on("notifyComment"),
      notifyStoreNew: on("notifyStoreNew"),
      notifyStoreDeals: on("notifyStoreDeals"),
      // الطرفان معاً أو لا وضعَ هادئ.
      quietFrom: from !== null && to !== null ? from : null,
      quietTo: from !== null && to !== null ? to : null,
    },
  });

  revalidatePath("/settings");
}

/**
 * تغيير كلمة المرور.
 *
 * القديمةُ شرط: جهازٌ مفتوحٌ في يد غيرك لا يقفل الحساب على صاحبه
 * بضغطتين. والجديدة تُكتب مرّتين، فخطأٌ في حرفٍ واحد يُقفل الحساب على
 * من كتبه.
 *
 * ولا تُبطَل الجلسات القائمة: من غيّر كلمته من جهازه لا يُخرَج منه.
 */
export async function changePassword(
  _prev: AdminResult,
  formData: FormData,
): Promise<AdminResult> {
  const user = await requireUser();

  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const again = String(formData.get("again") ?? "");

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!row) return { error: "لا يوجد هذا الحساب" };
  /*
     ومن دخل بمزوّدٍ ولا كلمةَ له **يضعها بلا قديمة**: لا قديمةَ تُطلب،
     والجلسةُ نفسها دليلُ أنّه هو. وبها يصير له بابان: المزوّد والبريد.
  */
  if (row.passwordHash && !(await verifyPassword(current, row.passwordHash))) {
    return { error: "كلمة المرور الحالية غير صحيحة" };
  }
  if (next.length < 8) return { error: "كلمة المرور الجديدة ٨ أحرف فأكثر" };
  if (next !== again) return { error: "الكلمتان الجديدتان غير متطابقتين" };
  if (row.passwordHash && next === current) return { error: "الجديدة هي نفسها الحالية" };

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(next) },
  });

  return { ok: "تم تغيير كلمة المرور" };
}

/** الحظر: لا يرى أحدهما الآخر ولا يتفاعل معه، والصداقة تُفكّ إن وُجدت. */
export async function blockUser(targetId: string): Promise<void> {
  const user = await requireUser();
  if (targetId === user.id) throw new Error("لا يمكنك حظر نفسك");

  await prisma.$transaction([
    prisma.block.upsert({
      where: { blockerId_blockedId: { blockerId: user.id, blockedId: targetId } },
      create: { blockerId: user.id, blockedId: targetId },
      update: {},
    }),
    prisma.friendship.deleteMany({
      where: {
        OR: [
          { requesterId: user.id, addresseeId: targetId },
          { requesterId: targetId, addresseeId: user.id },
        ],
      },
    }),
  ]);

  revalidatePath("/");
  revalidatePath("/circle");
  revalidatePath("/settings/blocked");
}

export async function unblockUser(targetId: string): Promise<void> {
  const user = await requireUser();
  await prisma.block.deleteMany({ where: { blockerId: user.id, blockedId: targetId } });
  revalidatePath("/settings/blocked");
}

/** الملف الشخصي: الاسم والمعرّف والنبذة والمدينة. */
export async function saveProfile(
  _prev: AdminResult,
  formData: FormData,
): Promise<AdminResult> {
  const user = await requireUser();

  const name = String(formData.get("name") ?? "").trim().slice(0, 40);
  if (!name) return { error: "الاسم مطلوب" };

  const rawHandle = String(formData.get("handle") ?? "").trim().replace(/^@/, "").toLowerCase();
  // المعرّف حروف لاتينية وأرقام وشرطة سفلية: يُكتب في الروابط ويُنطق.
  if (rawHandle && !/^[a-z0-9_]{3,20}$/.test(rawHandle)) {
    return { error: "المعرّف حروف إنجليزية وأرقام و_ من ٣ إلى ٢٠" };
  }

  if (rawHandle) {
    const taken = await prisma.user.findFirst({
      where: { handle: rawHandle, id: { not: user.id } },
      select: { id: true },
    });
    if (taken) return { error: "المعرّف محجوز" };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      name,
      handle: rawHandle || null,
      bio: String(formData.get("bio") ?? "").trim().slice(0, BIO_MAX) || null,
      ...cityInput(String(formData.get("city") ?? ""), user.city),
    },
  });

  // لا إعادة توجيه: التحرير يجري في نافذةٍ فوق التبويب، فتُغلق وحدها.
  revalidatePath("/me");
  revalidatePath("/");
  return { ok: "حُفظ" };
}

// ───────────────────────────── التفاعل ─────────────────────────────

export async function react(momentId: string, kind: string, emoji?: string): Promise<void> {
  const user = await requireUser();
  if (!(await canSee(user.id, momentId))) throw new Error("غير مصرح");
  await assertCanInteract(user.id, momentId);

  // الإيموجي الحر ميزة اشتراك؛ الوجوه الخمسة مفتوحة للجميع دائماً.
  if (kind === "CUSTOM" && !user.isPlus) throw new Error("الإيموجي الحر لمشتركي آثار+");

  // وجه النوم للحظات النوم وحدها — والفحص هنا لا في إخفاء الزر.
  if (kind === "SLEEPY") {
    const moment = await prisma.moment.findUnique({
      where: { id: momentId },
      select: { kind: true },
    });
    if (moment?.kind !== "SLEEP") throw new Error("وجه النوم للحظات النوم");
  }

  const existing = await prisma.reaction.findUnique({
    where: { momentId_userId: { momentId, userId: user.id } },
  });

  // الضغط على نفس التفاعل يلغيه — تفاعل واحد لكل شخص لكل لحظة.
  if (existing && existing.kind === kind && (existing.emoji ?? undefined) === emoji) {
    await prisma.reaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.reaction.upsert({
      where: { momentId_userId: { momentId, userId: user.id } },
      create: {
        momentId,
        userId: user.id,
        kind: kind as ReactionKind,
        emoji: kind === "CUSTOM" ? (emoji ?? null) : null,
      },
      update: {
        kind: kind as ReactionKind,
        emoji: kind === "CUSTOM" ? (emoji ?? null) : null,
      },
    });
  }

  revalidatePath("/");
  revalidatePath(`/m/${momentId}`);
}

/**
 * حذف لحظة: لصاحبها وحده.
 *
 * التفاعلات والتعليقات والمشاهدات تذهب معها بحكم `onDelete: Cascade`،
 * فلا تبقى في القاعدة يتيمةٌ تشير إلى لحظةٍ لم تعد موجودة.
 */
export async function deleteMoment(momentId: string): Promise<void> {
  const user = await requireUser();

  const moment = await prisma.moment.findUnique({
    where: { id: momentId },
    select: { authorId: true, mediaId: true },
  });
  if (!moment) return;
  if (moment.authorId !== user.id) throw new Error("لا تُحذف لحظة غيرك");

  // التفاعلات والتعليقات والمشاهدات والإشارات تذهب بـ`Cascade`.
  await prisma.moment.delete({ where: { id: momentId } });

  /*
    وصورتها تذهب بيدنا: علاقة الصورة `SetNull`، فحذف اللحظة وحده كان
    يترك بكسلاتها في القاعدة إلى الأبد. «تُحذف» تعني ألّا يبقى منها شيء
    لا عند الخادم ولا في القاعدة.
  */
  if (moment.mediaId) await dropMedia([moment.mediaId]);

  revalidatePath("/");
  revalidatePath("/me");
}

export async function markSeen(momentId: string): Promise<void> {
  const user = await requireUser();
  if (!(await canSee(user.id, momentId))) return;

  await prisma.view.upsert({
    where: { momentId_userId: { momentId, userId: user.id } },
    create: { momentId, userId: user.id },
    update: {},
  });
}

export async function addComment(momentId: string, formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!(await canSee(user.id, momentId))) throw new Error("غير مصرح");
  await assertCanInteract(user.id, momentId);

  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;
  await guard(body);

  await prisma.comment.create({ data: { momentId, userId: user.id, body: body.slice(0, 500) } });
  revalidatePath("/");
  revalidatePath(`/m/${momentId}`);
}

/** اللحظة مرئية لصاحبها ولمن شمله جمهورها من دائرته — `lib/visibility`. */
async function canSee(userId: string, momentId: string): Promise<boolean> {
  return canSeeMoment(userId, momentId);
}

/** التفاعل والتعليق يمرّان بحدّ صاحب اللحظة: «من يمكنه التفاعل معك». */
async function assertCanInteract(userId: string, momentId: string) {
  const moment = await prisma.moment.findUnique({
    where: { id: momentId },
    select: { authorId: true },
  });
  if (!moment) throw new Error("اللحظة غير موجودة");
  if (!(await canInteract(userId, moment.authorId))) {
    throw new Error("صاحب اللحظة حصر التفاعل في تصنيف من أصدقائه");
  }
}

// ───────────────────────────── المحادثات الخاصة ─────────────────────────────

export async function startConversation(otherId: string): Promise<void> {
  const user = await requireUser();

  // الخاص للدائرة وحدها: قبل القبول لا محادثة، وإخفاء الزر ليس حماية.
  const circle = await circleIds(user.id);
  if (!circle.includes(otherId)) throw new Error("المحادثة بعد قبول الإضافة");

  const id = await openConversation(user.id, otherId);
  redirect(`/messages/${id}`);
}

/** يتحقق أنّ المحادثة لي ثم يردّ معرّفها — كل إرسالٍ يمرّ عليه. */
async function myConversation(conversationId: string, userId: string): Promise<void> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { aId: true, bId: true },
  });
  if (!conversation) throw new Error("المحادثة غير موجودة");
  if (conversation.aId !== userId && conversation.bId !== userId) throw new Error("غير مصرح");
}

/** يرفع طابع المحادثة فتصعد إلى أعلى القائمة. */
function touchConversation(conversationId: string) {
  return prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });
}

/**
 * رسالة صوتية.
 *
 * المدّة تُقاس في المتصفح وتُرسل، ويُعاد فحصها هنا: الحدّ عشرون ثانية
 * وللمشترك مئة وعشرون — والتسجيل الأطول يُردّ برسالة لا يُقصّ صامتاً.
 */
export async function sendVoice(
  conversationId: string,
  formData: FormData,
): Promise<{ ok?: string; error?: string }> {
  const user = await requireUser();
  try {
    await myConversation(conversationId, user.id);

    const clip = formData.get("clip");
    if (!(clip instanceof File) || clip.size === 0) return { error: "ما وصل التسجيل" };

    const seconds = Math.round(Number(formData.get("seconds") ?? 0));
    const cap = user.isPlus ? VOICE_SECONDS.plus : VOICE_SECONDS.free;
    if (!Number.isFinite(seconds) || seconds < 1) return { error: "التسجيل قصير جداً" };
    if (seconds > cap + 1) {
      return {
        error: user.isPlus
          ? `الحدّ ${cap} ثانية`
          : `الحدّ ${cap} ثانية — ومع آثار+ ${VOICE_SECONDS.plus}`,
      };
    }

    const media = await storeClip(user.id, clip, "audio");
    await prisma.$transaction([
      prisma.message.create({
        data: {
          conversationId,
          senderId: user.id,
          body: "",
          kind: "VOICE",
          mediaId: media.id,
          seconds,
        },
      }),
      touchConversation(conversationId),
    ]);
  } catch (problem) {
    return { error: problem instanceof Error ? problem.message : "تعذّر الإرسال" };
  }

  revalidatePath(`/messages/${conversationId}`);
  revalidatePath("/messages");
  return { ok: "أُرسل" };
}

/** صورة في المحادثة — مضغوطةً في المتصفح قبل أن تصل. */
export async function sendPhoto(
  conversationId: string,
  formData: FormData,
): Promise<{ ok?: string; error?: string }> {
  const user = await requireUser();
  try {
    await myConversation(conversationId, user.id);
    const { file, width, height } = picture(formData);
    const media = await storeUpload(user.id, file, width, height);
    await prisma.$transaction([
      prisma.message.create({
        data: {
          conversationId,
          senderId: user.id,
          body: "",
          kind: "PHOTO",
          mediaId: media.id,
        },
      }),
      touchConversation(conversationId),
    ]);
  } catch (problem) {
    return { error: problem instanceof Error ? problem.message : "تعذّر الإرسال" };
  }

  revalidatePath(`/messages/${conversationId}`);
  revalidatePath("/messages");
  return { ok: "أُرسلت" };
}

export async function sendMessage(conversationId: string, formData: FormData): Promise<void> {
  const user = await requireUser();

  await myConversation(conversationId, user.id);

  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;
  await guard(body);

  await prisma.$transaction([
    prisma.message.create({
      data: { conversationId, senderId: user.id, body: body.slice(0, 2000) },
    }),
    touchConversation(conversationId),
  ]);

  revalidatePath(`/messages/${conversationId}`);
  revalidatePath("/messages");
}

/** حذف محادثة: يحذفها للطرفين — لا نصف حذف يبقي نسخة عند الآخر بلا علمه. */
export async function deleteConversation(conversationId: string): Promise<void> {
  const user = await requireUser();

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { aId: true, bId: true },
  });
  if (!conversation) return;
  if (conversation.aId !== user.id && conversation.bId !== user.id) throw new Error("غير مصرح");

  await prisma.conversation.delete({ where: { id: conversationId } });
  revalidatePath("/messages");
}

export async function markConversationRead(conversationId: string): Promise<void> {
  const user = await requireUser();
  const now = new Date();
  await prisma.message.updateMany({
    where: { conversationId, senderId: { not: user.id }, readAt: null },
    // القراءة تستلزم التسليم، فنكتبهما معاً ولا نترك رسالةً «مقروءة غير واصلة».
    data: { readAt: now, deliveredAt: now },
  });
}

/**
 * التسليم: يُكتب حين يفتح المستلم شاشة المحادثات — وصلت جهازه وإن لم يقرأها.
 * لا خادم دائم بيننا، فحضوره على الشاشة هو أصدق دليلٍ على الوصول.
 */
export async function markDelivered(): Promise<void> {
  const user = await currentUser();
  if (!user) return;
  await deliverTo(user.id);
}

/** تعديل رسالة: لصاحبها وحده، ويبقى أثر التعديل ظاهراً للطرفين. */
export async function editMessage(
  messageId: string,
  formData: FormData,
): Promise<void> {
  const user = await requireUser();

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { senderId: true, conversationId: true, body: true },
  });
  if (!message) throw new Error("الرسالة غير موجودة");
  if (message.senderId !== user.id) throw new Error("لا تُعدَّل رسالة غيرك");

  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;
  if (body === message.body) return;

  await prisma.message.update({
    where: { id: messageId },
    data: { body: body.slice(0, 2000), editedAt: new Date() },
  });

  revalidatePath(`/messages/${message.conversationId}`);
  revalidatePath("/messages");
}

// ───────────────────────────── المتجر والاشتراك ─────────────────────────────

const PLUS_DISCOUNT = 0.2;

/**
 * ما تحمله الحزمة من أصناف — فارغةٌ لما ليس حزمة.
 *
 * والمخفيُّ منها يُتجاوَز: صنفٌ أُنزل من المتجر لا يُملَّك بشراء حزمةٍ
 * قديمة تحمله.
 */
async function bundleContents(bundleId: string) {
  const rows = await prisma.bundleItem.findMany({
    where: { bundleId, item: { hidden: false } },
    select: { item: { select: { id: true, coverMediaId: true } } },
  });
  return rows.map((row) => row.item);
}

/**
 * غلافُ الثيم يُلبَس عند شرائه.
 *
 * الثيم مزاجٌ كامل — ألوانُه وصورتُه — وغلافٌ لا يشبهه يكسره. فمن
 * اشتراه وجد غلافه معه، **وله أن يغيّره بعدها**: نسخةٌ يملكها، لا
 * قفلٌ عليه.
 *
 * والنسخة لأنّ `User.coverMediaId` فريد: إشارةٌ إلى ملفّ الصنف نفسه
 * تصطدم عند ثاني مشترٍ وتنتزعه من المتجر (`copyMedia`).
 *
 * وخارج المعاملة عمداً: نسخُ البايتات قد يمرّ بالسحابة، وشراءٌ يُلغى
 * لأنّ صورةً لم تُنسخ خسارةٌ لا مقابل لها — فالفشل يُبتلع ويبقى
 * الصنف مملوكاً.
 */
async function wearItemCover(coverMediaId: string | null, userId: string): Promise<void> {
  if (!coverMediaId) return;
  try {
    const copy = await copyMedia(coverMediaId, userId);
    if (!copy) return;
    const old = await prisma.user.findUnique({
      where: { id: userId },
      select: { coverMediaId: true },
    });
    await prisma.user.update({
      where: { id: userId },
      data: { coverMediaId: copy.id, coverY: 50, coverX: 50, coverZoom: 100 },
    });
    // غلافُه السابق يذهب هو وبكسلاته: صفٌّ لا يشير إليه شيء (القاعدة ١٠٤).
    if (old?.coverMediaId) await dropMedia([old.coverMediaId]);
  } catch {
    // غلافٌ لم يُلبَس لا يُبطل شراءً تمّ.
  }
}

/**
 * الإهداء: تشتري الصنف بمالك فيملكه صاحبك.
 *
 * الشرط أن يكون في دائرتك — لا هدايا من غريب، فالهدية بابُ إزعاجٍ إن
 * فُتح للجميع. ولا يُهدى ما يُكتسب بالوقت (يُنال بالبقاء لا بالمال)، ولا
 * ما يملكه أصلاً، ولا صنفُ «آثار+» لمن ليس مشتركاً — يبقى في صندوقه لا
 * يلبسه. والخصم والتمليك في معاملة واحدة.
 */
export async function giftItem(
  itemId: string,
  toUserId: string,
): Promise<{ ok?: string; error?: string }> {
  const user = await requireUser();
  if (toUserId === user.id) return { error: "الإهداء لصاحبك لا لنفسك" };

  const circle = await circleIds(user.id);
  if (!circle.includes(toUserId)) return { error: "الإهداء للأصدقاء فقط" };

  const [item, friend] = await Promise.all([
    prisma.storeItem.findUnique({ where: { id: itemId } }),
    prisma.user.findUnique({
      where: { id: toUserId },
      select: { name: true, isPlus: true },
    }),
  ]);
  if (!item || !friend || item.hidden) return { error: "الصنف غير موجود" };
  if (item.earnedAfterDays !== null) return { error: "هذا الصنف يُكتسب بالوقت، لا يُهدى" };
  if (item.plusOnly && !friend.isPlus) return { error: `${friend.name} ليس مشتركاً في آثار+` };

  if ((await prisma.storeItemPlan.count({ where: { itemId } })) > 0) {
    return { error: "هذا الصنف بمدّة — أهدِه من التطبيق حيث تُختار المدّة" };
  }
  const owned = await prisma.purchase.findUnique({
    where: { userId_itemId: { userId: toUserId, itemId } },
  });
  if (owned && (!owned.expiresAt || owned.expiresAt > new Date())) {
    return { error: `${friend.name} يملكه أصلاً` };
  }
  if (owned) await prisma.purchase.delete({ where: { id: owned.id } });

  // الخصم خصمُ المُهدي: هو الدافع، فله سعره هو.
  const price = user.isPlus
    ? Math.round(item.priceCoins * (1 - PLUS_DISCOUNT))
    : item.priceCoins;
  if (user.coins < price) return { error: "رصيدك لا يكفي" };

  // وحزمةٌ تُهدى تُملّك المُهدى إليه ما بداخلها كذلك.
  const giftInside = await bundleContents(itemId);
  const hasAlready = new Set(
    giftInside.length
      ? (
          await prisma.purchase.findMany({
            where: { userId: toUserId, itemId: { in: giftInside.map((one) => one.id) } },
            select: { itemId: true },
          })
        ).map((row) => row.itemId)
      : [],
  );

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { coins: { decrement: price } },
    }),
    prisma.purchase.create({
      data: { userId: toUserId, itemId, paidCoins: price, giftedById: user.id },
    }),
    ...giftInside
      .filter((one) => !hasAlready.has(one.id))
      .map((one) =>
        prisma.purchase.create({
          data: { userId: toUserId, itemId: one.id, paidCoins: 0, giftedById: user.id },
        }),
      ),
  ]);

  /*
    الهدية حدثٌ بين اثنين، فتُكتب سطراً في مخطط كلٍّ منهما: «أهديت فلاناً
    كذا» عند المُهدي، و«وصلتك هدية من فلان» عند صاحبها — كما تُكتب الصداقة
    سطراً عند الطرفين. والصنف في `text`، والطرف الآخر إشارةٌ (`MomentTag`)
    فيبقى اسمه حيّاً لو تغيّر.
  */
  const [sent, got] = await prisma.$transaction([
    prisma.moment.create({ data: { authorId: user.id, kind: "GIFT_SENT", text: item.name } }),
    prisma.moment.create({ data: { authorId: toUserId, kind: "GIFT_GOT", text: item.name } }),
  ]);
  await prisma.momentTag.createMany({
    data: [
      { momentId: sent.id, userId: toUserId },
      { momentId: got.id, userId: user.id },
    ],
    skipDuplicates: true,
  });

  revalidatePath(`/u/${toUserId}`);
  revalidatePath("/store");
  revalidatePath("/me");
  revalidatePath("/");
  return { ok: `أُهديت ${item.name} إلى ${friend.name}` };
}

/**
 * الشراءُ نفسه — **غير مُصدَّر**.
 *
 * كان إجراءَ خادمٍ تناديه شبكةُ اللوحة القديمة، وقد ذهبت. وما بقي له
 * منادٍ إلا `buyNow` في هذا الملفّ — وإبقاؤه مُصدَّراً يترك باب شراءٍ
 * حيّاً بـPOST لا شاشةَ تحرسه ولا أحد ينظر إليه.
 */
async function buyItem(itemId: string): Promise<void> {
  const user = await requireUser();

  const item = await prisma.storeItem.findUnique({ where: { id: itemId } });
  if (!item) throw new Error("الصنف غير موجود");
  /*
    والمخفيّ لا يُشترى ولو عُرف معرّفه: إجراءُ الخادم يُستدعى بـPOST
    مباشرةً، فإخفاؤه من الشاشة ليس منعاً. و«غير موجود» لا «مخفيّ» —
    وجودُه ليس ممّا يُخبَر به.
  */
  if (item.hidden) throw new Error("الصنف غير موجود");
  if (item.plusOnly && !user.isPlus) throw new Error("هذا الصنف لمشتركي آثار+");

  if (item.earnedAfterDays !== null) {
    const days = Math.floor((Date.now() - user.createdAt.getTime()) / 86_400_000);
    if (days < item.earnedAfterDays) throw new Error("هذا الصنف يُكتسب بالوقت، لا يُشترى");
  }

  // الصنفُ بمُدَدٍ يُشترى من التطبيق: هناك تُختار المدّة وسعرُها.
  if ((await prisma.storeItemPlan.count({ where: { itemId } })) > 0) {
    throw new Error("هذا الصنف بمدّة — اختر مدّته واشترِه من التطبيق");
  }

  const price = user.isPlus
    ? Math.round(item.priceCoins * (1 - PLUS_DISCOUNT))
    : item.priceCoins;

  const owned = await prisma.purchase.findUnique({
    where: { userId_itemId: { userId: user.id, itemId } },
  });
  if (owned && (!owned.expiresAt || owned.expiresAt > new Date())) return;
  if (owned) await prisma.purchase.delete({ where: { id: owned.id } });

  if (user.coins < price) throw new Error("رصيدك لا يكفي");

  /*
    الحزمة صنفٌ لا يُلبَس: شراؤها يملّك ما بداخلها.

    وما يملكه المشتري منها أصلاً يُتجاوَز بلا خصمٍ ثانٍ — والسعر سعرُ
    الحزمة كما هو: من اشتراها وهو يملك نصفها اشترى النصف الآخر بسعرها،
    وهذا ما تقوله بطاقتُها قبل الضغط.
  */
  const inside = await bundleContents(itemId);
  const already = inside.length
    ? new Set(
        (
          await prisma.purchase.findMany({
            where: { userId: user.id, itemId: { in: inside.map((one) => one.id) } },
            select: { itemId: true },
          })
        ).map((row) => row.itemId),
      )
    : new Set<string>();

  // الخصم والشراء في معاملة واحدة حتى لا ينقص الرصيد بلا صنف والعكس.
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { coins: { decrement: price } },
    }),
    prisma.purchase.create({ data: { userId: user.id, itemId, paidCoins: price } }),
    // وما بداخلها بثمنٍ صفر: ثمنُه دُفع في الحزمة، والصفّ ملكيّةٌ لا فاتورة.
    ...inside
      .filter((one) => !already.has(one.id))
      .map((one) =>
        prisma.purchase.create({ data: { userId: user.id, itemId: one.id, paidCoins: 0 } }),
      ),
  ]);

  await wearItemCover(item.coverMediaId, user.id);
  // وغلافُ ثيمٍ داخل الحزمة يُلبَس كما لو اشتُري وحده.
  for (const one of inside) {
    if (!already.has(one.id)) await wearItemCover(one.coverMediaId, user.id);
  }

  revalidatePath("/store");
  revalidatePath("/me");
  revalidatePath("/");
}
/**
 * شراءٌ من نافذةٍ لا من صفحة المتجر: يردّ الرسالة ولا يرميها.
 *
 * الرمي في `buyItem` لا يناسب نافذةً صغيرة فوق ملف صديقك: فيها تُقرأ
 * النتيجة في مكانها لا في شاشةِ خطأٍ عامّة (القاعدة ٩٠).
 */
export async function buyNow(itemId: string): Promise<{ ok?: string; error?: string }> {
  try {
    await buyItem(itemId);
    return { ok: "صار لك — البسه من إكسسواراتك" };
  } catch (problem) {
    return { error: problem instanceof Error ? problem.message : "تعذّر الشراء" };
  }
}

export async function equip(itemId: string): Promise<void> {
  const user = await requireUser();

  const purchase = await prisma.purchase.findUnique({
    where: { userId_itemId: { userId: user.id, itemId } },
    include: { item: { select: { kind: true } } },
  });
  if (!purchase) throw new Error("لا تملك هذا الصنف");

  const field =
    purchase.item.kind === "FRAME"
      ? { frameId: itemId }
      : purchase.item.kind === "CHARM"
        ? { charmId: itemId }
        : { backgroundId: itemId };

  await prisma.user.update({ where: { id: user.id }, data: field });

  revalidatePath("/me");
  revalidatePath("/store");
  revalidatePath("/");
}

export async function unequip(kind: "FRAME" | "BACKGROUND" | "CHARM"): Promise<void> {
  const user = await requireUser();
  await prisma.user.update({
    where: { id: user.id },
    data:
      kind === "FRAME"
        ? { frameId: null }
        : kind === "CHARM"
          ? { charmId: null }
          : { backgroundId: null },
  });
  revalidatePath("/me");
  revalidatePath("/store");
  revalidatePath("/");
}

/**
 * اشتراك تجريبي: يفعّل «آثار+» ويودع رصيد المتجر الشهري مباشرة.
 * الدفع الحقيقي يمر عبر IAP لآبل وGoogle Play — لا يمكن تنفيذه على الويب.
 */
export async function subscribe(plan: "MONTHLY" | "YEARLY"): Promise<void> {
  const user = await requireUser();

  const days = plan === "YEARLY" ? 365 : 30;
  await prisma.user.update({
    where: { id: user.id },
    data: {
      isPlus: true,
      plusUntil: new Date(Date.now() + days * 86_400_000),
      coins: { increment: 3000 },
    },
  });

  revalidatePath("/subscribe");
  revalidatePath("/me");
  revalidatePath("/store");
  redirect("/me");
}

export async function cancelPlus(): Promise<void> {
  const user = await requireUser();
  await prisma.user.update({
    where: { id: user.id },
    // انتهاءٌ الآن يُكمله كنسُ الخادم (`endPlus`) — انظر `revokePlus` في اللوحة.
    data: { plusUntil: new Date(Date.now() - 1000) },
  });
  revalidatePath("/me");
  revalidatePath("/subscribe");
}

// ───────────────────────────── تغيير البريد ─────────────────────────────

/**
 * البريد يُصغَّر دائماً.
 *
 * الدخول يبحث عن البريد مُصغَّراً (`credentials` أعلاه)، فلو حُفظ
 * «Ali@Athar.sa» كما كُتب لما وجده البحث أبداً — يُحفظ الحساب ولا يُدخَل
 * إليه. والتصغير هنا وفي الدخول واحد، لا تصادفاً بل لأنّه مكتوبٌ مرّتين
 * بنفس المخطّط.
 */
const emailInput = z.object({
  email: z.string().trim().toLowerCase().email("بريد غير صالح").max(120),
});

/**
 * يفحص بريداً جديداً لحسابٍ بعينه.
 *
 * فحصٌ واحد للطريقين — صاحبُ الحساب من الخصوصية، والمالكُ من اللوحة —
 * فلا يفترق ما يُقبل هنا عمّا يُقبل هناك.
 *
 * والحجز يُفحص قبل الكتابة وتُمسك الكتابة أيضاً: بين الفحص والكتابة
 * لحظةٌ يسع فيها طلبٌ آخر أن يأخذ البريد، وقيدُ الفرادة في القاعدة هو
 * الحَكَم الأخير لا الفحص.
 */
async function readNewEmail(
  userId: string,
  formData: FormData,
): Promise<{ email: string } | { error: string }> {
  const parsed = emailInput.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "بريد غير صالح" };

  const email = parsed.data.email;
  const row = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!row) return { error: "لا يوجد هذا الحساب" };
  if (row.email === email) return { error: "هذا بريده الحالي" };

  const taken = await prisma.user.findFirst({
    where: { email, id: { not: userId } },
    select: { id: true },
  });
  if (taken) return { error: "هذا البريد مستعمل في حسابٍ آخر" };

  return { email };
}

/** يكتب البريد، ويترجم اصطدام قيد الفرادة إلى رسالةٍ لا صفحة خطأ. */
async function writeEmail(userId: string, email: string): Promise<AdminResult> {
  // بريدٌ جديد بريدٌ غيرُ مؤكَّد، ورسالتُه تخرج معه — كنسخة الخادم.
  let name: string;
  try {
    ({ name } = await prisma.user.update({
      where: { id: userId },
      data: { email, emailVerifiedAt: null },
      select: { name: true },
    }));
  } catch {
    return { error: "هذا البريد مستعمل في حسابٍ آخر" };
  }
  const sent = await sendVerify(userId, email, name).catch(() => false);
  return {
    ok: sent
      ? `صار البريد ${email} — أرسلنا إليه رابط التأكيد`
      : `صار البريد ${email} — أكّده من «أرسل رابط التأكيد»`,
  };
}

/**
 * تغيير البريد من صفحة الخصوصية — بكلمة المرور.
 *
 * البريد هو اسم الدخول، فتغييرُه تغييرُ مفتاحِ الباب. وجهازٌ مفتوحٌ في
 * يد غيرك لا يجب أن ينقل حسابك إلى عنوانه بضغطتين — ولهذا تُطلب كلمة
 * المرور كما تُطلب عند الحذف.
 *
 * ولا يُرسَل إلى العنوان الجديد ما يؤكّده: لا بريد صادر في المنظومة
 * بعد. فالتأكيد بالرابط يأتي يوم يُربط مزوّدُ بريد، ويُكتب حينها عمودٌ
 * «مؤكَّد» — وحتى ذلك اليوم كلمةُ المرور هي الحارس.
 */
export async function changeEmail(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  const user = await requireUser();

  const password = String(formData.get("password") ?? "");
  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  /*
     ومن دخل بمزوّدٍ ولا كلمةَ له: الجلسةُ دليلُه، وبريدُه اليومَ من
     المزوّد نفسه — فتغييرُه هنا لا يُغلق عليه باب الدخول بمزوّده.
  */
  if (!row) return { error: "لا يوجد هذا الحساب" };
  if (row.passwordHash && !(await verifyPassword(password, row.passwordHash))) {
    return { error: "كلمة المرور غير صحيحة" };
  }

  const checked = await readNewEmail(user.id, formData);
  if ("error" in checked) return checked;

  const result = await writeEmail(user.id, checked.email);
  revalidatePath("/settings");
  revalidatePath("/me");
  return result;
}

// ───────────────────────── الإيقاف المؤقّت ─────────────────────────


