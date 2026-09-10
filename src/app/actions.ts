"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  createSession,
  currentUser,
  destroySession,
  requireUser,
  verifyPassword,
} from "@/lib/auth";
import { assertRoomForBoth, circleIds, mutualCount } from "@/lib/circle";
import { canInteract, canSeeMoment } from "@/lib/visibility";
import { reverseGeocode } from "@/lib/places";
import { deliverTo, openConversation } from "@/lib/dm";
import { storeDataUrl } from "@/lib/media";
import { isSupportedMusicUrl, resolveTrack } from "@/lib/music-link";
import type { MomentKind, ReactionKind } from "@/generated/prisma/client";

// ───────────────────────────── الدخول والخروج ─────────────────────────────

const credentials = z.object({
  email: z.string().trim().toLowerCase().email("بريد غير صالح"),
  password: z.string().min(1, "اكتب كلمة المرور"),
});

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
  const ok = user ? await verifyPassword(parsed.data.password, user.passwordHash) : false;
  if (!user || !ok) return { error: "البريد أو كلمة المرور غير صحيحة" };

  await createSession(user.id);
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
  // كلمة مرور خاطئة تُردّ رسالةً في الشاشة لا استثناءً يكسرها: هذه آخر
  // خطوة قبل فقد كل شيء، فلا يجوز أن تنتهي بصفحة خطأ غامضة.
  if (!row || !(await verifyPassword(password, row.passwordHash))) {
    return "كلمة المرور غير صحيحة";
  }

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

/** لحظة صورة أو فكرة: نص، وإشارة اختيارية. */
export async function postSimple(formData: FormData): Promise<void> {
  const user = await requireUser();

  const kind = String(formData.get("kind") ?? "");
  if (kind !== "PHOTO" && kind !== "THOUGHT") throw new Error("نوع غير صالح");

  const text = String(formData.get("text") ?? "").trim().slice(0, 400);
  if (!text && kind === "THOUGHT") throw new Error("اكتب شيئاً");

  // الصورة المرفوعة تسبق التدرّج؛ التدرّج بديل حين لا توجد صورة.
  let mediaId: string | null = null;
  const picture = String(formData.get("image") ?? "");
  if (kind === "PHOTO" && picture.startsWith("data:")) {
    const stored = await storeDataUrl(
      user.id,
      picture,
      Number(formData.get("imageWidth") ?? 0),
      Number(formData.get("imageHeight") ?? 0),
    );
    mediaId = stored.id;
  }

  const seen = await readAudience(formData, user);

  const moment = await prisma.moment.create({
    data: {
      authorId: user.id,
      kind: kind as MomentKind,
      text: text || null,
      mediaId,
      imageSpec: kind === "PHOTO" && !mediaId ? randomImage() : null,
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
      placeName: precise ? place.name : (city ?? "مكان"),
      placeCity: city,
      text: String(formData.get("text") ?? "").trim().slice(0, 200) || null,
      audience: seen.audience,
      audienceGroupId: seen.audienceGroupId,
    },
  });

  await attachViewers(moment.id, seen.viewers);

  // الانتقال إلى مدينة أخرى حدثٌ في حياة الدائرة، فيُكتب سطراً مستقلاً.
  // يُشتقّ من التحديد نفسه: لا شاشة له ولا زر، وإلا صار عبئاً على الناشر.
  if (city && city !== user.city) {
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { city } }),
      prisma.moment.create({ data: { authorId: user.id, kind: "CITY", text: city } }),
    ]);
  }

  await attachTags(moment.id, user.id, formData.getAll("with").map(String));
  revalidatePath("/");
  redirect("/");
}

/**
 * الأغنية تُنشر من الحساب المربوط، لا بكتابة الاسم والفنان.
 * بلا ربط لا يوجد ما يُنشر، فيُوجَّه المستخدم إلى شاشة الربط.
 */
export async function postNowPlaying(): Promise<void> {
  const user = await requireUser();

  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: { musicProvider: true, musicAccessToken: true },
  });
  if (!account?.musicProvider) redirect("/music");

  const track = await currentTrack(user.id);
  if (!track) redirect("/music?empty=1");

  await prisma.moment.create({
    data: {
      authorId: user.id,
      kind: "MUSIC",
      musicTitle: track.title,
      musicArtist: track.artist,
    },
  });

  revalidatePath("/");
  redirect("/");
}

/**
 * ما يُسمع الآن من المزوّد المربوط.
 *
 * سبوتيفاي تتطلب SPOTIFY_CLIENT_ID و SPOTIFY_CLIENT_SECRET؛ بدونهما الربط
 * معطّل ولا يُدّعى خلافه. وأنغامي لا تفتح واجهتها إلا لشركاء معتمدين، فلا
 * تُنفَّذ هنا حتى يتوفر اعتماد حقيقي.
 */
async function currentTrack(
  userId: string,
): Promise<{ title: string; artist: string } | null> {
  const account = await prisma.user.findUnique({
    where: { id: userId },
    select: { musicProvider: true, musicAccessToken: true },
  });
  if (account?.musicProvider !== "SPOTIFY" || !account.musicAccessToken) return null;

  try {
    const response = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
      headers: { Authorization: `Bearer ${account.musicAccessToken}` },
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    if (response.status === 204 || !response.ok) return null;

    const data = (await response.json()) as {
      item?: { name?: string; artists?: { name?: string }[] };
    };
    const title = data.item?.name;
    const artist = data.item?.artists?.map((a) => a.name).filter(Boolean).join("، ");
    if (!title) return null;

    return { title, artist: artist || "" };
  } catch {
    return null;
  }
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

export async function disconnectMusic(): Promise<void> {
  const user = await requireUser();
  await prisma.user.update({
    where: { id: user.id },
    data: {
      musicProvider: null,
      musicAccountName: null,
      musicAccessToken: null,
      musicRefreshToken: null,
      musicTokenExpires: null,
    },
  });
  revalidatePath("/music");
}

// ───────────────────────────── الصورة والغلاف ─────────────────────────────

export async function setAvatar(dataUrl: string, width: number, height: number): Promise<void> {
  const user = await requireUser();
  const media = await storeDataUrl(user.id, dataUrl, width, height);
  await prisma.user.update({ where: { id: user.id }, data: { avatarMediaId: media.id } });
  revalidatePath("/me");
  revalidatePath("/");
}

export async function setCover(dataUrl: string, width: number, height: number): Promise<void> {
  const user = await requireUser();
  const media = await storeDataUrl(user.id, dataUrl, width, height);
  await prisma.user.update({ where: { id: user.id }, data: { coverMediaId: media.id } });
  revalidatePath("/me");
  revalidatePath("/");
}

/** ضبط الغلاف: نسبة الموضع العمودي التي وقف عندها السحب. */
/** نشر قصة: صورة تُعرض لأصدقائك يوماً ثم تذهب. */
export async function postStory(dataUrl: string, width: number, height: number): Promise<void> {
  const user = await requireUser();
  const media = await storeDataUrl(user.id, dataUrl, width, height);

  await prisma.story.create({
    data: {
      authorId: user.id,
      mediaId: media.id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  revalidatePath("/circle");
  revalidatePath("/");
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

/** كل إجراء مشرف يتحقق من الدور بنفسه — إخفاء الرابط ليس حماية. */
async function requireAdmin() {
  const user = await requireUser();
  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true },
  });
  if (row?.role !== "ADMIN") throw new Error("هذه الصفحة للمشرفين");
  return user;
}

/** نتيجة نموذج في اللوحة: رسالة تُعرض في الشاشة بدل استثناء يكسرها. */
export type AdminResult = { ok?: string; error?: string } | null;

const storeItemInput = z.object({
  kind: z.enum(["FRAME", "BACKGROUND", "THEME", "CHARM"]),
  name: z.string().trim().min(1, "اكتب الاسم").max(40),
  priceRiyals: z.coerce.number().min(0).max(9999),
  spec: z.string().trim().min(1, "اكتب تدرّج CSS").max(1000),
  plusOnly: z.coerce.boolean(),
  earnedAfterDays: z.coerce.number().int().min(0).max(3650).optional(),
  /** التصنيف اختياري: صنفٌ بلا تصنيف يظهر في «المميز» وحده. */
  categoryId: z.string().trim().optional(),
  limited: z.coerce.boolean(),
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

export async function createStoreItem(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  await requireAdmin();

  const parsed = storeItemInput.safeParse({
    kind: formData.get("kind"),
    name: formData.get("name"),
    // الحقل الفارغ يعني صفراً لا `NaN` — وإلا انكسر الحفظ بلا سبب مفهوم.
    priceRiyals: formData.get("priceRiyals") || 0,
    spec: formData.get("spec"),
    plusOnly: formData.get("plusOnly") === "on",
    earnedAfterDays: formData.get("earnedAfterDays") || undefined,
    categoryId: formData.get("categoryId") || undefined,
    limited: formData.get("limited") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };

  const { kind, name, priceRiyals, spec, plusOnly, earnedAfterDays, categoryId, limited } =
    parsed.data;
  const last = await prisma.storeItem.findFirst({
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  await prisma.storeItem.create({
    data: {
      kind,
      name,
      // الأسعار تُدخَل بالريال وتُخزَّن بالهللات، فلا تدخل كسور عشرية القاعدة.
      priceHalalas: Math.round(priceRiyals * 100),
      spec,
      plusOnly,
      earnedAfterDays: earnedAfterDays && earnedAfterDays > 0 ? earnedAfterDays : null,
      categoryId: categoryId || null,
      limited,
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/store");
  return { ok: `أُضيف «${name}»` };
}

export async function updateStoreItem(
  itemId: string,
  _prev: AdminResult,
  formData: FormData,
): Promise<AdminResult> {
  await requireAdmin();

  const parsed = storeItemInput.safeParse({
    kind: formData.get("kind"),
    name: formData.get("name"),
    priceRiyals: formData.get("priceRiyals") || 0,
    spec: formData.get("spec"),
    plusOnly: formData.get("plusOnly") === "on",
    earnedAfterDays: formData.get("earnedAfterDays") || undefined,
    categoryId: formData.get("categoryId") || undefined,
    limited: formData.get("limited") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };

  const { kind, name, priceRiyals, spec, plusOnly, earnedAfterDays, categoryId, limited } =
    parsed.data;
  await prisma.storeItem.update({
    where: { id: itemId },
    data: {
      kind,
      name,
      priceHalalas: Math.round(priceRiyals * 100),
      spec,
      plusOnly,
      earnedAfterDays: earnedAfterDays && earnedAfterDays > 0 ? earnedAfterDays : null,
      categoryId: categoryId || null,
      limited,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/store");
  return { ok: "حُفظ" };
}

// ───────────────────────── تصنيفات المتجر (اللوحة) ─────────────────────────

export async function createCategory(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  await requireAdmin();

  const parsed = categoryInput.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    sortOrder: formData.get("sortOrder") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };

  const { name, slug, sortOrder } = parsed.data;
  const taken = await prisma.storeCategory.findUnique({ where: { slug } });
  if (taken) return { error: "المعرّف مستعمل" };

  const last = await prisma.storeCategory.findFirst({
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  await prisma.storeCategory.create({
    data: { name, slug, sortOrder: sortOrder ?? (last?.sortOrder ?? 0) + 1 },
  });

  revalidatePath("/admin");
  revalidatePath("/store");
  return { ok: `أُضيف تصنيف «${name}»` };
}

export async function updateCategory(
  categoryId: string,
  _prev: AdminResult,
  formData: FormData,
): Promise<AdminResult> {
  await requireAdmin();

  const parsed = categoryInput.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    sortOrder: formData.get("sortOrder") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };

  const { name, slug, sortOrder } = parsed.data;
  const taken = await prisma.storeCategory.findUnique({ where: { slug } });
  if (taken && taken.id !== categoryId) return { error: "المعرّف مستعمل" };

  await prisma.storeCategory.update({
    where: { id: categoryId },
    data: {
      name,
      slug,
      sortOrder: sortOrder ?? undefined,
      active: formData.get("active") === "on",
    },
  });

  revalidatePath("/admin");
  revalidatePath("/store");
  return { ok: "حُفظ" };
}

/** حذف تصنيف لا يحذف أصنافه: تعود بلا تصنيف، ولا يضيع ما اشتراه أحد. */
export async function deleteCategory(categoryId: string): Promise<void> {
  await requireAdmin();
  await prisma.storeCategory.delete({ where: { id: categoryId } });
  revalidatePath("/admin");
  revalidatePath("/store");
}

// ───────────────────────────── الوسوم ─────────────────────────────

const HEX = /^#[0-9a-fA-F]{6}$/;

const tagInput = z.object({
  name: z.string().trim().min(1, "اكتب اسم الوسم").max(20),
  bg: z.string().trim().regex(HEX, "لون الخلفية بصيغة #rrggbb"),
  fg: z.string().trim().regex(HEX, "لون النص بصيغة #rrggbb"),
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

export async function createTag(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  await requireAdmin();
  const parsed = readTag(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };

  const data = parsed.data;
  const last = await prisma.tag.findFirst({ orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  const tag = await prisma.tag.create({ data: { ...data, sortOrder: (last?.sortOrder ?? 0) + 1 } });
  await keepSingleAuto(tag.id, data.autoForPlus);
  revalidateTags();
  return { ok: `أُضيف وسم «${data.name}»` };
}

export async function updateTag(
  tagId: string,
  _prev: AdminResult,
  formData: FormData,
): Promise<AdminResult> {
  await requireAdmin();
  const parsed = readTag(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };

  await prisma.tag.update({ where: { id: tagId }, data: parsed.data });
  await keepSingleAuto(tagId, parsed.data.autoForPlus);
  revalidateTags();
  return { ok: "حُفظ" };
}

export async function deleteTag(tagId: string): Promise<void> {
  await requireAdmin();
  // الحاملون يفقدون الوسم لا حساباتهم — العلاقة `SetNull`.
  await prisma.tag.delete({ where: { id: tagId } });
  revalidateTags();
}

/** منح الوسم لحساب، أو نزعه بقيمة فارغة. */
export async function setUserTag(userId: string, formData: FormData): Promise<void> {
  await requireAdmin();
  const raw = String(formData.get("tagId") ?? "");
  const tagId = raw.length > 0 ? raw : null;
  if (tagId) {
    const exists = await prisma.tag.findUnique({ where: { id: tagId }, select: { id: true } });
    if (!exists) throw new Error("الوسم غير موجود");
  }
  await prisma.user.update({ where: { id: userId }, data: { tagId } });
  revalidateTags();
}

function revalidateTags() {
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/me");
  revalidatePath("/circle");
}

export async function deleteStoreItem(itemId: string): Promise<void> {
  await requireAdmin();
  await prisma.storeItem.delete({ where: { id: itemId } });
  revalidatePath("/admin");
  revalidatePath("/store");
}

export async function grantCredit(userId: string, riyals: number): Promise<void> {
  await requireAdmin();
  await prisma.user.update({
    where: { id: userId },
    data: { storeCredit: { increment: Math.round(riyals * 100) } },
  });
  revalidatePath("/admin");
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
      data: { authorId: user.id, kind: "FRIEND_ADDED", text: other?.name ?? null },
    }),
    prisma.moment.create({
      data: { authorId: friendship.requesterId, kind: "FRIEND_ADDED", text: user.name },
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

  const mutual = await mutualCount(user.id, targetId);
  if (mutual === 0) throw new Error("ما بينكما صديق مشترك");

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
      notifyOnTag: formData.get("notifyOnTag") === "on",
    },
  });

  revalidatePath("/settings/privacy");
  revalidatePath("/");
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
  _prev: string | null,
  formData: FormData,
): Promise<string | null> {
  const user = await requireUser();

  const name = String(formData.get("name") ?? "").trim().slice(0, 40);
  if (!name) return "الاسم مطلوب";

  const rawHandle = String(formData.get("handle") ?? "").trim().replace(/^@/, "").toLowerCase();
  // المعرّف حروف لاتينية وأرقام وشرطة سفلية: يُكتب في الروابط ويُنطق.
  if (rawHandle && !/^[a-z0-9_]{3,20}$/.test(rawHandle)) {
    return "المعرّف حروف إنجليزية وأرقام و_ من ٣ إلى ٢٠";
  }

  if (rawHandle) {
    const taken = await prisma.user.findFirst({
      where: { handle: rawHandle, id: { not: user.id } },
      select: { id: true },
    });
    if (taken) return "المعرّف محجوز";
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      name,
      handle: rawHandle || null,
      bio: String(formData.get("bio") ?? "").trim().slice(0, 160) || null,
      city: String(formData.get("city") ?? "").trim().slice(0, 40) || null,
    },
  });

  revalidatePath("/me");
  revalidatePath("/");
  redirect("/me");
}

// ───────────────────────────── التفاعل ─────────────────────────────

export async function react(momentId: string, kind: string, emoji?: string): Promise<void> {
  const user = await requireUser();
  if (!(await canSee(user.id, momentId))) throw new Error("غير مصرح");
  await assertCanInteract(user.id, momentId);

  // الإيموجي الحر ميزة اشتراك؛ الوجوه الخمسة مفتوحة للجميع دائماً.
  if (kind === "CUSTOM" && !user.isPlus) throw new Error("الإيموجي الحر لمشتركي أثر+");

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

export async function sendMessage(conversationId: string, formData: FormData): Promise<void> {
  const user = await requireUser();

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { aId: true, bId: true },
  });
  if (!conversation) throw new Error("المحادثة غير موجودة");
  if (conversation.aId !== user.id && conversation.bId !== user.id) throw new Error("غير مصرح");

  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;

  await prisma.$transaction([
    prisma.message.create({
      data: { conversationId, senderId: user.id, body: body.slice(0, 2000) },
    }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    }),
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

export async function buyItem(itemId: string): Promise<void> {
  const user = await requireUser();

  const item = await prisma.storeItem.findUnique({ where: { id: itemId } });
  if (!item) throw new Error("الصنف غير موجود");
  if (item.plusOnly && !user.isPlus) throw new Error("هذا الصنف لمشتركي أثر+");

  if (item.earnedAfterDays !== null) {
    const days = Math.floor((Date.now() - user.createdAt.getTime()) / 86_400_000);
    if (days < item.earnedAfterDays) throw new Error("هذا الصنف يُكتسب بالوقت، لا يُشترى");
  }

  const price = user.isPlus
    ? Math.round(item.priceHalalas * (1 - PLUS_DISCOUNT))
    : item.priceHalalas;

  const owned = await prisma.purchase.findUnique({
    where: { userId_itemId: { userId: user.id, itemId } },
  });
  if (owned) return;

  if (user.storeCredit < price) throw new Error("رصيدك لا يكفي");

  // الخصم والشراء في معاملة واحدة حتى لا ينقص الرصيد بلا صنف والعكس.
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { storeCredit: { decrement: price } },
    }),
    prisma.purchase.create({ data: { userId: user.id, itemId, paidHalalas: price } }),
  ]);

  revalidatePath("/store");
  revalidatePath("/me");
}

/**
 * الإهداء: تشتري الصنف بمالك فيملكه صاحبك.
 *
 * الشرط أن يكون في دائرتك — لا هدايا من غريب، فالهدية بابُ إزعاجٍ إن
 * فُتح للجميع. ولا يُهدى ما يُكتسب بالوقت (يُنال بالبقاء لا بالمال)، ولا
 * ما يملكه أصلاً، ولا صنفُ «أثر+» لمن ليس مشتركاً — يبقى في صندوقه لا
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
  if (!item || !friend) return { error: "الصنف غير موجود" };
  if (item.earnedAfterDays !== null) return { error: "هذا الصنف يُكتسب بالوقت، لا يُهدى" };
  if (item.plusOnly && !friend.isPlus) return { error: `${friend.name} ليس مشتركاً في أثر+` };

  const owned = await prisma.purchase.findUnique({
    where: { userId_itemId: { userId: toUserId, itemId } },
  });
  if (owned) return { error: `${friend.name} يملكه أصلاً` };

  // الخصم خصمُ المُهدي: هو الدافع، فله سعره هو.
  const price = user.isPlus
    ? Math.round(item.priceHalalas * (1 - PLUS_DISCOUNT))
    : item.priceHalalas;
  if (user.storeCredit < price) return { error: "رصيدك لا يكفي" };

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { storeCredit: { decrement: price } },
    }),
    prisma.purchase.create({
      data: { userId: toUserId, itemId, paidHalalas: price, giftedById: user.id },
    }),
  ]);

  revalidatePath(`/u/${toUserId}`);
  revalidatePath("/store");
  revalidatePath("/me");
  return { ok: `أُهديت ${item.name} إلى ${friend.name}` };
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
 * صورة صنف المتجر: الثيم صورةٌ تملأ خلفية التطبيق، والتميمة شعارٌ صغير.
 * ترفعها اللوحة كما تُرفع صورة الغلاف — تُخزَّن في القاعدة وتُقدَّم من
 * `/api/media`، فلا استضافة خارجية ولا رابطٌ ينكسر.
 */
export async function setItemImage(
  itemId: string,
  dataUrl: string,
  width: number,
  height: number,
): Promise<void> {
  const admin = await requireAdmin();
  const media = await storeDataUrl(admin.id, dataUrl, width, height);
  await prisma.storeItem.update({ where: { id: itemId }, data: { mediaId: media.id } });
  revalidatePath("/admin");
  revalidatePath("/store");
  revalidatePath("/");
}

export async function clearItemImage(itemId: string): Promise<void> {
  await requireAdmin();
  await prisma.storeItem.update({ where: { id: itemId }, data: { mediaId: null } });
  revalidatePath("/admin");
  revalidatePath("/store");
}

/**
 * اشتراك تجريبي: يفعّل «أثر+» ويودع رصيد المتجر الشهري مباشرة.
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
      storeCredit: { increment: 3000 },
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
    data: { isPlus: false, plusUntil: null },
  });
  revalidatePath("/me");
  revalidatePath("/subscribe");
}
