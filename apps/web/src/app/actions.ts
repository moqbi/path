"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession, destroySession, requireUser, verifyPassword } from "@/lib/auth";
import { HEX_COLOR, PALETTE_KEYS } from "@/lib/theme";
import { dropMedia, migrateToCloud, storeUpload } from "@/lib/media";
import { cloudReady, probeBucket } from "@/lib/storage";
import { forgetWords } from "@/lib/moderation";

/*
  إجراءات اللوحة، منقولةٌ كما هي من `src/app/actions.ts` في الويب الحالي:
  الوسوم والحسابات والمتجر والصلاحيات والملفات والدعم وتغيير البريد —
  ومعها ما تحتاجه اللوحة وحدها من الدخول. وما بقي هناك من إجراءات
  التطبيق (اللحظات والدائرة والمحادثات) لا مكان له هنا: اللوحة لا تنشر
  لحظة.

  والويب الحالي يبقى يعمل حتى Sprint 10، فالنسختان تتعايشان على قاعدةٍ
  واحدة — لا مخطّطَ ثانٍ ولا هجرةَ ثانية.
*/

// ───────────────────────────── الدخول والخروج ─────────────────────────────

const credentials = z.object({
  email: z.string().trim().toLowerCase().email("بريد غير صالح"),
  password: z.string().min(1, "اكتب كلمة المرور"),
});

/** دخول اللوحة. الجلسة نفسها والكوكي نفسه — لا باب ثانٍ للمشرف. */
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
  redirect("/admin");
}

export async function signOut(): Promise<void> {
  await destroySession();
  redirect("/login");
}

/** يقرأ صورةً وصلت في `FormData` — ملفاً لا نصّاً، فالوسيط له سقف. */
function picture(formData: FormData): { file: File; width: number; height: number } {
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) throw new Error("ما وصلت الصورة");
  return {
    file,
    width: Number(formData.get("width") ?? 0),
    height: Number(formData.get("height") ?? 0),
  };
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
  kind: z.enum(["FRAME", "BACKGROUND", "THEME", "CHARM"]),
  name: z.string().trim().min(1, "اكتب الاسم").max(40),
  priceCoins: z.coerce.number().int().min(0).max(1_000_000),
  spec: z.string().trim().min(1, "اكتب تدرّج CSS").max(1000),
  plusOnly: z.coerce.boolean(),
  earnedAfterDays: z.coerce.number().int().min(0).max(3650).optional(),
  /** التصنيف اختياري: صنفٌ بلا تصنيف يظهر في «المميز» وحده. */
  categoryId: z.string().trim().optional(),
  limited: z.coerce.boolean(),
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

export async function createStoreItem(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  await requireAdmin("store");

  const parsed = storeItemInput.safeParse({
    kind: formData.get("kind"),
    name: formData.get("name"),
    // الحقل الفارغ يعني صفراً لا `NaN` — وإلا انكسر الحفظ بلا سبب مفهوم.
    priceCoins: formData.get("priceCoins") || 0,
    spec: formData.get("spec"),
    plusOnly: formData.get("plusOnly") === "on",
    earnedAfterDays: formData.get("earnedAfterDays") || undefined,
    categoryId: formData.get("categoryId") || undefined,
    limited: formData.get("limited") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };

  const { kind, name, priceCoins, spec, plusOnly, earnedAfterDays, categoryId, limited } =
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
      priceCoins,
      spec,
      plusOnly,
      earnedAfterDays: earnedAfterDays && earnedAfterDays > 0 ? earnedAfterDays : null,
      categoryId: categoryId || null,
      limited,
      palette: readPalette(formData),
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
  await requireAdmin("store");

  const parsed = storeItemInput.safeParse({
    kind: formData.get("kind"),
    name: formData.get("name"),
    priceCoins: formData.get("priceCoins") || 0,
    spec: formData.get("spec"),
    plusOnly: formData.get("plusOnly") === "on",
    earnedAfterDays: formData.get("earnedAfterDays") || undefined,
    categoryId: formData.get("categoryId") || undefined,
    limited: formData.get("limited") === "on",
    sortOrder: formData.get("sortOrder") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };

  const {
    kind,
    name,
    priceCoins,
    spec,
    plusOnly,
    earnedAfterDays,
    categoryId,
    limited,
    sortOrder,
  } = parsed.data;
  await prisma.storeItem.update({
    where: { id: itemId },
    data: {
      kind,
      name,
      priceCoins,
      spec,
      plusOnly,
      earnedAfterDays: earnedAfterDays && earnedAfterDays > 0 ? earnedAfterDays : null,
      categoryId: categoryId || null,
      limited,
      palette: readPalette(formData),
      sortOrder: sortOrder ?? undefined,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/store");
  return { ok: "حُفظ" };
}

// ───────────────────────── تصنيفات المتجر (اللوحة) ─────────────────────────

export async function createCategory(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  await requireAdmin("store");

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
  await requireAdmin("store");

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
  await requireAdmin("store");
  await prisma.storeCategory.delete({ where: { id: categoryId } });
  revalidatePath("/admin");
  revalidatePath("/store");
}

// ───────────────────────── باقات النقاط (اللوحة) ─────────────────────────

/**
 * النقاط عملة المتجر، والباقات تُشترى بمالٍ حقيقي.
 *
 * و`sku` معرّف المنتج في App Store وGoogle Play: هو الرابط بين باقتنا
 * وما يشتريه الجهاز، وبه يصل حدثُ RevenueCat فنعرف كم نقاط نودع.
 * وباقةٌ بلا `sku` تبقى مسوّدةً لا تُعرض — فلا يُضغط زرٌّ لا يفتح شيئاً.
 */
const packInput = z.object({
  name: z.string().trim().min(1, "اكتب اسم الباقة").max(40),
  coins: z.coerce.number().int().min(1, "عدد النقاط أكبر من صفر").max(1_000_000),
  /// السعر يُكتب بالريال في اللوحة ويُخزَّن بالهللات: المشرف يفكّر
  /// بالريال، والقاعدة لا تحتمل كسراً عشرياً في المال.
  priceRiyals: z.coerce.number().min(0).max(100_000),
  sku: z.string().trim().max(120).optional(),
  sortOrder: z.coerce.number().int().min(0).max(999).optional(),
});

function readPack(formData: FormData) {
  return packInput.safeParse({
    name: formData.get("name"),
    coins: formData.get("coins"),
    priceRiyals: formData.get("priceHalalasRiyals"),
    sku: formData.get("sku") ?? undefined,
    sortOrder: formData.get("sortOrder") || undefined,
  });
}

export async function createCoinPack(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  await requireAdmin("store");

  const parsed = readPack(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };

  const { name, coins, priceRiyals, sku, sortOrder } = parsed.data;
  if (sku) {
    const taken = await prisma.coinPack.findFirst({ where: { sku }, select: { id: true } });
    if (taken) return { error: "معرّف المنتج مستعمل في باقةٍ أخرى" };
  }

  const last = await prisma.coinPack.findFirst({
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  await prisma.coinPack.create({
    data: {
      name,
      coins,
      priceHalalas: Math.round(priceRiyals * 100),
      sku: sku ?? "",
      sortOrder: sortOrder ?? (last?.sortOrder ?? 0) + 1,
    },
  });

  revalidatePath("/admin");
  return { ok: `أُضيفت باقة «${name}»` };
}

export async function updateCoinPack(
  packId: string,
  _prev: AdminResult,
  formData: FormData,
): Promise<AdminResult> {
  await requireAdmin("store");

  const parsed = readPack(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };

  const { name, coins, priceRiyals, sku, sortOrder } = parsed.data;
  if (sku) {
    const taken = await prisma.coinPack.findFirst({ where: { sku }, select: { id: true } });
    if (taken && taken.id !== packId) return { error: "معرّف المنتج مستعمل في باقةٍ أخرى" };
  }

  await prisma.coinPack.update({
    where: { id: packId },
    data: {
      name,
      coins,
      priceHalalas: Math.round(priceRiyals * 100),
      sku: sku ?? "",
      sortOrder: sortOrder ?? undefined,
      hidden: formData.get("hidden") === "on",
    },
  });

  revalidatePath("/admin");
  return { ok: "حُفظ" };
}

/**
 * حذف الباقة لا يمسّ ما شُحن بها: صفوف `CoinTopUp` تبقى وتُفرَّغ علاقتها
 * (`SetNull`) — فالرصيد المشحون لا يُسحب من أحدٍ بحذف باقةٍ من العرض.
 */
export async function deleteCoinPack(packId: string): Promise<void> {
  await requireAdmin("store");
  await prisma.coinPack.delete({ where: { id: packId } });
  revalidatePath("/admin");
}

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
  await requireAdmin("store");
  await prisma.storeItem.delete({ where: { id: itemId } });
  revalidatePath("/admin");
  revalidatePath("/store");
}

export async function grantCredit(userId: string, riyals: number): Promise<void> {
  await requireAdmin();
  await prisma.user.update({
    where: { id: userId },
    data: { coins: { increment: Math.round(riyals * 100) } },
  });
  revalidatePath("/admin");
}

/**
 * منح صلاحية اللوحة وسحبها — للمالك وحده.
 *
 * لا يُمنح دور `ADMIN` لأحد: المالك واحد، وما يُمنح مدىً يُسحب بضغطة،
 * ولا يستطيع الممنوح أن يرفع نفسه ولا أن يمنح غيره.
 */
export async function setAdminScope(userId: string, formData: FormData): Promise<void> {
  const owner = await requireOwner();
  const raw = String(formData.get("scope") ?? "NONE");
  const scope = raw === "ALL" || raw === "STORE" ? raw : "NONE";
  /*
    والإشراف على المحتوى صلاحيةٌ ثانية في النموذج نفسه، لا نموذجٌ ثانٍ:
    المالك يقرّر الدرجتين لشخصٍ واحد في نظرةٍ واحدة. وهي **مستقلّة** عن
    المدى: من يدير المتجر لا يحتاج أن يقرأ لحظات الناس، ومن يراجع
    البلاغات لا يحتاج مفاتيح المتجر.
  */
  const moderate = formData.get("moderate") === "on";
  // المالك لا يُنقص نفسه من حيث لا يدري.
  if (userId === owner.id) return;
  await prisma.user.update({
    where: { id: userId },
    data: { adminScope: scope, canModerate: moderate },
  });
  revalidatePath("/admin");
}

// ─────────────────────── الإشراف على المحتوى ───────────────────────

/**
 * الإشراف: المالك، أو مشرفٌ مُنح `canModerate`.
 *
 * ويُقرأ من الصفّ في كل إجراء لا من الجلسة: هذه الأبواب تقرأ لحظات الناس
 * وتحذفها، فلا يكفي أن تكون الصفحة مخفيّة (القاعدة ١٣).
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
 * وصورتها بيدها لأنّ علاقتها `SetNull` (القاعدة ٨٤ و١٠٤).
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
  revalidatePath("/settings/support");
  revalidatePath("/admin");
  return { ok: "وصلتنا رسالتك — نردّ عليك هنا" };
}

export async function replyTicket(
  ticketId: string,
  _prev: AdminResult,
  formData: FormData,
): Promise<AdminResult> {
  await requireAdmin();
  const reply = String(formData.get("reply") ?? "").trim().slice(0, 1200);
  if (reply.length < 2) return { error: "اكتب الردّ" };

  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { reply, repliedAt: new Date() },
  });
  revalidatePath("/admin");
  revalidatePath("/settings/support");
  return { ok: "أُرسل الردّ" };
}

export async function closeTicket(ticketId: string): Promise<void> {
  await requireAdmin();
  await prisma.supportTicket.update({ where: { id: ticketId }, data: { closed: true } });
  revalidatePath("/admin");
  revalidatePath("/settings/support");
}

export async function setItemImage(itemId: string, formData: FormData): Promise<void> {
  const admin = await requireAdmin("store");
  const { file, width, height } = picture(formData);
  const media = await storeUpload(admin.id, file, width, height);
  await prisma.storeItem.update({ where: { id: itemId }, data: { mediaId: media.id } });
  revalidatePath("/admin");
  revalidatePath("/store");
  revalidatePath("/");
}

export async function clearItemImage(itemId: string): Promise<void> {
  await requireAdmin("store");
  await prisma.storeItem.update({ where: { id: itemId }, data: { mediaId: null } });
  revalidatePath("/admin");
  revalidatePath("/store");
}

/**
 * حال التخزين.
 *
 * رقمان لا رأي: كم ملفاً في السحابة وكم بقي في القاعدة. ومن لا يرى
 * الأرقام لا يعرف أنّ النقل جرى أصلاً.
 */
export async function storageState(): Promise<{
  cloud: boolean;
  bucket: string | null;
  inCloud: number;
  inDb: number;
  dbBytes: number;
}> {
  await requireOwner();

  const [inCloud, inDb, sum] = await Promise.all([
    prisma.media.count({ where: { key: { not: null } } }),
    prisma.media.count({ where: { key: null, bytes: { not: null } } }),
    prisma.$queryRaw<{ total: bigint | null }[]>`
      SELECT SUM(OCTET_LENGTH("bytes"))::bigint AS total FROM "Media" WHERE "bytes" IS NOT NULL
    `,
  ]);

  return {
    cloud: cloudReady(),
    bucket: process.env.R2_BUCKET ?? null,
    inCloud,
    inDb,
    dbBytes: Number(sum[0]?.total ?? 0),
  };
}

/**
 * ينقل دفعةً من الملفات إلى السحابة بطلب المالك.
 *
 * النقل يجري وحده مع الكنس، وهذا الزرّ للمن لا يريد الانتظار. والدفعة
 * محدودة كي لا يتجاوز الطلب مهلته على خادمٍ مجانيّ.
 */
export async function moveMediaToCloud(
  _prev: AdminResult,
  _formData: FormData,
): Promise<AdminResult> {
  await requireOwner();
  if (!cloudReady()) return { error: "مفاتيح R2 غير مضبوطة" };

  try {
    const moved = await migrateToCloud(60);
    revalidatePath("/admin");
    return { ok: moved > 0 ? `نُقل ${moved}` : "لا شيء ينتظر النقل" };
  } catch (problem) {
    return { error: problem instanceof Error ? problem.message : "تعذّر النقل" };
  }
}

/**
 * يفحص الدلو فعلاً — كتابةٌ وقراءةٌ وحذف — ويردّ ما قاله.
 *
 * «مربوطة» في الشاشة تقرأ المتغيّرات لا الدلو، فقد تكون المفاتيح
 * مكتوبةً والرفع يسقط. وهذا الزرّ يقول أيّهما.
 */
export async function testStorage(_prev: AdminResult, _formData: FormData): Promise<AdminResult> {
  await requireOwner();
  const verdict = await probeBucket();
  return verdict.ok ? { ok: `الدلو يعمل · ${verdict.detail}` } : { error: verdict.detail };
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
  try {
    await prisma.user.update({ where: { id: userId }, data: { email } });
    return { ok: `صار البريد ${email}` };
  } catch {
    return { error: "هذا البريد مستعمل في حسابٍ آخر" };
  }
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
  if (!row || !(await verifyPassword(password, row.passwordHash))) {
    return { error: "كلمة المرور غير صحيحة" };
  }

  const checked = await readNewEmail(user.id, formData);
  if ("error" in checked) return checked;

  const result = await writeEmail(user.id, checked.email);
  revalidatePath("/settings/privacy");
  revalidatePath("/me");
  return result;
}

/**
 * تغيير بريد حسابٍ من اللوحة — للمالك وحده.
 *
 * وليست هذه صرامةً زائدة: من يغيّر بريد حسابٍ يملك الحساب: ينقله إلى
 * عنوانٍ يقرأه هو. فلو مُنحت للوحة كاملةً لصار كلُّ مشرفٍ قادراً على
 * أخذ حساب المالك نفسه. تُمنح الصلاحيات من هنا، ولا تُمنح هذه.
 */
export async function setUserEmail(
  userId: string,
  _prev: AdminResult,
  formData: FormData,
): Promise<AdminResult> {
  await requireOwner();

  const checked = await readNewEmail(userId, formData);
  if ("error" in checked) return checked;

  const result = await writeEmail(userId, checked.email);
  revalidatePath("/admin");
  return result;
}

// ───────────────────────── البلاغات والكلمات الممنوعة ─────────────────────────

/**
 * البلاغ يُحسم يدوياً: يُبقى أو يُحذف.
 *
 * الفلترة الآلية تقرأ الكلمات وحدها، والبلاغ يقرأه إنسان — ولهذا لا
 * يُحذف شيء بمجرّد وصول بلاغ. و«حُذف» يمسح اللحظة أو القصة أو الرسالة
 * ويُبقي صفَّ البلاغ سجلّاً: من بلّغ، ومتى، وعلى ماذا — وإلا صار تكرار
 * المخالفة من نفس الحساب غير مرئي.
 */
export async function decideReport(
  reportId: string,
  formData: FormData,
): Promise<void> {
  const admin = await requireAdmin();
  const state = formData.get("state") === "REMOVED" ? "REMOVED" : "KEPT";

  const report = await prisma.report.findUnique({ where: { id: reportId } });
  if (!report) return;

  if (state === "REMOVED") {
    // المعرّف بلا مفتاحٍ أجنبي، فالحذف بـ`deleteMany`: ما ذهب قبلُ لا يرمي.
    if (report.target === "MOMENT") {
      await prisma.moment.deleteMany({ where: { id: report.targetId } });
    } else if (report.target === "STORY") {
      await prisma.story.deleteMany({ where: { id: report.targetId } });
    } else if (report.target === "MESSAGE") {
      await prisma.message.deleteMany({ where: { id: report.targetId } });
    }
  }

  await prisma.report.update({
    where: { id: reportId },
    data: { state, handledAt: new Date(), handledBy: admin.id },
  });
  revalidatePath("/admin");
}

const wordInput = z.object({
  word: z.string().trim().min(2, "اكتب الكلمة").max(40),
  note: z.string().trim().max(120).optional(),
});

/**
 * الكلمة الممنوعة تُمنع بها الكتابة كلها.
 *
 * والقائمة تُقرأ من القاعدة بذاكرةٍ قصيرة (`lib/moderation.ts`)، فإضافتها
 * هنا تسري خلال دقيقة — و`forgetWords()` تُسقط الذاكرة فوراً فلا ينتظر
 * المشرف ليرى أثر ما كتب.
 */
export async function addBannedWord(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  await requireAdmin();
  const parsed = wordInput.safeParse({
    word: formData.get("word"),
    note: formData.get("note"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "كلمة غير صالحة" };

  const word = parsed.data.word.toLowerCase();
  const exists = await prisma.bannedWord.findUnique({ where: { word } });
  if (exists) return { error: "الكلمة موجودة" };

  await prisma.bannedWord.create({
    data: {
      word,
      hard: formData.get("hard") === "on",
      note: parsed.data.note || null,
    },
  });
  forgetWords();
  revalidatePath("/admin");
  return { ok: `أُضيفت «${word}»` };
}

export async function dropBannedWord(wordId: string): Promise<void> {
  await requireAdmin();
  await prisma.bannedWord.deleteMany({ where: { id: wordId } });
  forgetWords();
  revalidatePath("/admin");
}

// ───────────────────────── الصفحات العامة ─────────────────────────

const publicMessage = z.object({
  name: z.string().trim().min(2, "اكتب اسمك").max(60),
  email: z.string().trim().toLowerCase().email("بريد غير صالح").max(120),
  body: z.string().trim().min(10, "اكتب رسالتك").max(1200),
});

/**
 * رسالةٌ من الموقع بلا حساب — وسيلةُ التواصل المنشورة التي يطلبها
 * المتجران.
 *
 * وتُحفظ في القاعدة كرسائل الدعم لا تُرسل بريداً: رسالةٌ تخرج من النظام
 * لا يعرف أحدٌ أوصلت أم لا. والردّ يذهب إلى بريد صاحبها لأنّه بلا حساب
 * يقرأ فيه.
 */
export async function openPublicTicket(
  _prev: AdminResult,
  formData: FormData,
): Promise<AdminResult> {
  const parsed = publicMessage.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    body: formData.get("body"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "بيانات ناقصة" };

  // ثلاثُ رسائل مفتوحة من بريدٍ واحد تكفي: تكرارها يُغرق اللوحة ولا يُسرّع الردّ.
  const open = await prisma.supportTicket.count({
    where: { email: parsed.data.email, closed: false },
  });
  if (open >= 3) return { error: "عندك رسائل لم يُردّ عليها بعد — انتظر الردّ" };

  await prisma.supportTicket.create({
    data: { name: parsed.data.name, email: parsed.data.email, body: parsed.data.body },
  });
  revalidatePath("/admin");
  return { ok: "وصلتنا رسالتك — نردّ على بريدك" };
}

/**
 * حذف الحساب من الموقع — شرط جوجل بلاي: طريقٌ إلى الحذف من خارج التطبيق
 * أيضاً، يبلغه من حذف التطبيق من جهازه.
 *
 * والبريد وكلمة المرور شرطٌ هنا كما في التطبيق: هذه آخر خطوة قبل فقد كل
 * شيء، فلا تُفتح بضغطةٍ من جهازٍ مفتوح. والخطأ يُردّ رسالةً في الشاشة لا
 * استثناءً يكسرها.
 */
export async function deleteAccountFromWeb(
  _prev: AdminResult,
  formData: FormData,
): Promise<AdminResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (formData.get("sure") !== "on") return { error: "أكّد أنّك تريد الحذف" };

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  });
  // رسالةٌ واحدة للحالتين حتى لا يكشف النموذج أيّ البُرد مسجَّلة.
  const ok = user ? await verifyPassword(password, user.passwordHash) : false;
  if (!user || !ok) return { error: "البريد أو كلمة المرور غير صحيحة" };

  // ملفاته تُجمَع قبل حذفه: الصفوف تذهب بـ`Cascade`، وكائنات السحابة لا
  // تذهب معها — فتبقى بكسلاته بعد ذهاب حسابه.
  const files = await prisma.media.findMany({
    where: { ownerId: user.id },
    select: { id: true },
  });
  await dropMedia(files.map((row) => row.id));
  await prisma.user.delete({ where: { id: user.id } });

  return { ok: "حُذف حسابك وكل ما فيه." };
}
