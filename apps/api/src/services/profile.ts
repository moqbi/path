import { prisma } from "@athar/db";
import { BIO_MAX } from "@athar/shared";
import { badRequest, forbidden, notFound } from "../lib/errors";
import { dropMedia } from "./media";

/** الحساب كما يقرؤه صاحبه: كل ما تعرضه شاشة «الملف الشخصي» وتحريرها. */
export async function me(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      memberNo: true,
      name: true,
      handle: true,
      email: true,
      bio: true,
      city: true,
      role: true,
      adminScope: true,
      canModerate: true,
      suspendedUntil: true,
      suspendedReason: true,
      isPlus: true,
      plusUntil: true,
      coins: true,
      createdAt: true,
      avatarMediaId: true,
      coverMediaId: true,
      coverY: true,
      shareLocation: true,
      notifyOnTag: true,
      viewGroupId: true,
      interactGroupId: true,
      frame: { select: { id: true, name: true, kind: true, spec: true, mediaId: true, priceCoins: true, plusOnly: true } },
      charm: { select: { id: true, name: true, kind: true, spec: true, mediaId: true, priceCoins: true, plusOnly: true } },
      background: { select: { id: true, spec: true, mediaId: true, palette: true } },
      tag: { select: { name: true, bg: true, fg: true } },
    },
  });
  if (!user) throw notFound("لا يوجد هذا الحساب");
  /*
    والمالك مشرفٌ بدوره لا بحقله: لو أُرسل الحقل خاماً لاحتاج كلُّ شاشةٍ
    أن تجمع الدور إليه بنفسها — ونسيانُ ذلك في شاشةٍ واحدة يُخفي البابَ
    عن المالك بلا سبب ظاهر.
  */
  return { ...user, canModerate: user.role === "ADMIN" || user.canModerate };
}

/**
 * أرقام «أنا» الأربعة.
 *
 * ما نشرتَ، ومن معك، وما أهديت، وما أُهدي إليك. والهدايا تُعدّ من
 * `Purchase.giftedById` — لا عمودَ عدّادٍ يُكتب ويُنسى فيكذب بعد شهر.
 */
export async function stats(userId: string) {
  const { circleIds } = await import("./visibility");

  const [moments, friends, sent, got] = await Promise.all([
    prisma.moment.count({ where: { authorId: userId } }),
    circleIds(userId).then((ids) => ids.length),
    prisma.purchase.count({ where: { giftedById: userId } }),
    prisma.purchase.count({ where: { userId, giftedById: { not: null } } }),
  ]);

  return { moments, friends, sent, got };
}

/**
 * الملف الشخصي: الاسم والمعرّف والنبذة والمدينة.
 *
 * المعرّف حروف لاتينية وأرقام وشرطة سفلية: يُكتب في الروابط ويُنطق.
 * وحجزه يُفحص على الخادم لا في الشاشة — والسباق بين طلبين يُمسك بقيد
 * الفرادة في القاعدة لا بالفحص وحده.
 */
export async function saveProfile(
  userId: string,
  input: { name: string; handle?: string; bio?: string; city?: string },
) {
  const name = input.name.trim().slice(0, 40);
  if (!name) throw badRequest("الاسم مطلوب");

  const handle = (input.handle ?? "").trim().replace(/^@/, "").toLowerCase();
  if (handle && !/^[a-z0-9_]{3,20}$/.test(handle)) {
    throw badRequest("المعرّف حروف إنجليزية وأرقام و_ من ٣ إلى ٢٠");
  }

  if (handle) {
    const taken = await prisma.user.findFirst({
      where: { handle, id: { not: userId } },
      select: { id: true },
    });
    if (taken) throw badRequest("المعرّف محجوز");
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      name,
      handle: handle || null,
      bio: (input.bio ?? "").trim().slice(0, BIO_MAX) || null,
      city: (input.city ?? "").trim().slice(0, 40) || null,
    },
    select: { id: true, name: true, handle: true, bio: true, city: true },
  });
  return user;
}

/**
 * الخصوصية.
 *
 * التصنيفان يُفحصان بالملكية: معرّفٌ يُدسّ في الطلب لا يجعل تصنيف غيرك
 * جمهوراً لك. وما ليس ملكاً يُطرح إلى «الدائرة كلها» لا يُرفض الطلب —
 * الإعداد لا يُترك في حالةٍ بينية.
 */
export async function savePrivacy(
  userId: string,
  input: {
    viewGroupId?: string | null;
    interactGroupId?: string | null;
    shareLocation: boolean;
    notifyOnTag: boolean;
  },
) {
  const groups = await prisma.friendGroup.findMany({
    where: { ownerId: userId },
    select: { id: true },
  });
  const ids = new Set(groups.map((group) => group.id));
  const pick = (value?: string | null) => (value && ids.has(value) ? value : null);

  await prisma.user.update({
    where: { id: userId },
    data: {
      viewGroupId: pick(input.viewGroupId),
      interactGroupId: pick(input.interactGroupId),
      shareLocation: input.shareLocation,
      notifyOnTag: input.notifyOnTag,
    },
  });
  return { ok: true };
}

/** موضع الغلاف رأسياً بالنسبة المئوية — ما يراه صاحبه حين يسحبه. */
export async function setCoverPosition(userId: string, y: number) {
  const value = Math.round(Math.min(100, Math.max(0, Number(y) || 0)));
  await prisma.user.update({ where: { id: userId }, data: { coverY: value } });
  return { coverY: value };
}

/** إزالة الغلاف — وبكسلاته معه، فلا يبقى ملفٌّ لا يشير إليه شيء. */
export async function clearCover(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { coverMediaId: true },
  });
  await prisma.user.update({ where: { id: userId }, data: { coverMediaId: null } });
  if (user?.coverMediaId) await dropMedia([user.coverMediaId]);
  return { ok: true };
}

/**
 * تغيير البريد — بكلمة المرور.
 *
 * البريد اسمُ الدخول، فتغييرُه تغييرُ مفتاحِ الباب: توكنٌ مسروقٌ لا يجب
 * أن ينقل الحساب إلى عنوان سارقه. ولهذا تُطلب كلمة المرور ولا يكفي أن
 * يكون الطلب موقّعاً.
 *
 * ويُصغَّر البريد كما يُصغَّر عند الدخول: لولا ذلك لحُفظ عنوانٌ لا يجده
 * البحث، فيبقى الحساب بلا بابٍ يُدخَل منه.
 */
export async function changeEmail(
  userId: string,
  input: { email: string; password: string },
) {
  const { verifyPassword } = await import("./auth");

  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, passwordHash: true },
  });
  if (!row) throw notFound("لا يوجد هذا الحساب");
  if (!(await verifyPassword(input.password, row.passwordHash))) {
    throw forbidden("كلمة المرور غير صحيحة");
  }

  const email = input.email.trim().toLowerCase();
  if (email === row.email) throw badRequest("هذا بريدك الحالي");

  const taken = await prisma.user.findFirst({
    where: { email, id: { not: userId } },
    select: { id: true },
  });
  if (taken) throw badRequest("هذا البريد مستعمل في حسابٍ آخر");

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { email },
      select: { id: true, email: true },
    });
    return user;
  } catch {
    // بين الفحص والكتابة لحظةٌ يسع فيها طلبٌ آخر أن يأخذه؛ والقيد هو الحَكَم.
    throw badRequest("هذا البريد مستعمل في حسابٍ آخر");
  }
}

/**
 * صورة العرض والغلاف.
 *
 * الملف يُرفع بالرابط المؤقّت ويُعتمد قبل هذا، فما يصل هنا مفحوصُ
 * البايتات. والقديم يذهب حين يحلّ الجديد: صورةٌ لا يشير إليها شيء تبقى
 * في الدلو إلى الأبد.
 */
export async function setPicture(
  userId: string,
  which: "avatar" | "cover",
  mediaId: string,
) {
  const media = await prisma.media.findFirst({
    where: { id: mediaId, ownerId: userId, ready: true },
    select: { id: true, mime: true },
  });
  if (!media) throw notFound("الملف غير موجود");
  if (!media.mime.startsWith("image/")) throw badRequest("يُقبل ملفُّ صورة");

  const before = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarMediaId: true, coverMediaId: true },
  });

  await prisma.user.update({
    where: { id: userId },
    data: which === "avatar" ? { avatarMediaId: media.id } : { coverMediaId: media.id },
  });

  const old = which === "avatar" ? before?.avatarMediaId : before?.coverMediaId;
  if (old && old !== media.id) await dropMedia([old]);

  return { mediaId: media.id };
}

/**
 * حذف الحساب.
 *
 * كلمة المرور شرط: هذه آخر خطوة قبل فقد كل شيء. وملفاته تُجمَع قبل
 * حذفه — الصفوف تذهب بـ`Cascade` وكائنات السحابة لا تذهب معها، فتبقى
 * بكسلاته بعد ذهاب حسابه.
 */
export async function deleteAccount(userId: string, password: string) {
  const { verifyPassword } = await import("./auth");

  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!row || !(await verifyPassword(password, row.passwordHash))) {
    throw forbidden("كلمة المرور غير صحيحة");
  }

  const files = await prisma.media.findMany({ where: { ownerId: userId }, select: { id: true } });
  await dropMedia(files.map((file) => file.id));
  await prisma.user.delete({ where: { id: userId } });

  return { ok: true };
}

// ───────────────────────────── الدعم ─────────────────────────────

/** رسائلي إلى الدعم وردودها. */
export async function tickets(userId: string) {
  const rows = await prisma.supportTicket.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { id: true, body: true, reply: true, repliedAt: true, closed: true, createdAt: true },
  });
  return { tickets: rows };
}

/** فتح رسالة — وثلاثٌ مفتوحة تكفي: تكرارها يُغرق اللوحة ولا يُسرّع الردّ. */
export async function openTicket(userId: string, body: string) {
  const text = body.trim().slice(0, 1200);
  if (text.length < 5) throw badRequest("اكتب رسالتك");

  const open = await prisma.supportTicket.count({ where: { userId, closed: false } });
  if (open >= 3) throw badRequest("عندك رسائل مفتوحة — انتظر الردّ عليها");

  await prisma.supportTicket.create({ data: { userId, body: text } });
  return { ok: "وصلتنا رسالتك — نردّ عليك هنا" };
}
