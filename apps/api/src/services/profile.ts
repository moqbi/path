import { prisma } from "@athar/db";
import { BIO_MAX, type NotifyInput } from "@athar/shared";
import { badRequest, forbidden, notFound } from "../lib/errors";
import { dropMedia } from "./media";
import { announceAvatar } from "./avatar-moment";
import { endPlus, lapsedNow } from "./plus";
import { cityInput } from "./city-input";
import { tellSupport } from "./support-mail";
import { readTicketFiles, saveTicketFiles } from "./ticket-files";

/** الحساب كما يقرؤه صاحبه: كل ما تعرضه شاشة «الملف الشخصي» وتحريرها. */
export async function me(userId: string) {
  /*
     اشتراكٌ تجاوز موعده يُنهى هنا قبل أن يُقرأ: الكنسُ يجري كل بضع دقائق،
     ومن انتهى اشتراكه وفتح التطبيق يرى ذلك في الحال لا بعد الكنس.
  */
  // والمشترك من المتجر ينتظر حدثَ الانتهاء لا موعدَه (`lapsedNow`، القاعدة ١٩٦).
  if ((await lapsedNow([userId])).length > 0) await endPlus(userId);

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
      plusEndedAt: true,
      coins: true,
      createdAt: true,
      avatarMediaId: true,
      coverMediaId: true,
      coverY: true,
      coverX: true,
      coverZoom: true,
      emailVerifiedAt: true,
      // وجودُها وحده يُرسَل لا هي: الشاشة تسأل «أضبطُها أم أغيّرها؟».
      passwordHash: true,
      shareLocation: true,
      notifyOnTag: true,
      notifyDm: true,
      notifyFriend: true,
      notifyReaction: true,
      notifyComment: true,
      notifyStoreNew: true,
      notifyStoreDeals: true,
      notifyMemories: true,
      quietFrom: true,
      quietTo: true,
      viewGroupId: true,
      interactGroupId: true,
      frame: { select: { id: true, name: true, kind: true, spec: true, mediaId: true, frameHole: true, priceCoins: true, plusOnly: true } },
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
  const { passwordHash, ...rest } = user;
  return {
    ...rest,
    hasPassword: Boolean(passwordHash),
    canModerate: user.role === "ADMIN" || user.canModerate,
    // إنشاءُ المجموعات وإدارتُها (القاعدة ٢١٥).
    canGroups: user.role === "ADMIN" || user.adminScope === "ALL",
  };
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

  const current = await prisma.user.findUnique({ where: { id: userId }, select: { city: true } });
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      name,
      handle: handle || null,
      bio: (input.bio ?? "").trim().slice(0, BIO_MAX) || null,
      // ما كتبه بيده يبقى (`cityLocked`)، ولا يكتب فوقه التحديد التلقائيّ.
      ...(input.city === undefined ? {} : cityInput(input.city, current?.city ?? null)),
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
    notifyOnTag?: boolean;
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
      // ولا يُكتب إلا إن أُرسل: نسخةٌ جديدة من التطبيق تتركه لشاشة
      // التنبيهات، فكتابتُه افتراضاً تطفئه في كل حفظٍ للخصوصية.
      ...(input.notifyOnTag === undefined ? {} : { notifyOnTag: input.notifyOnTag }),
    },
  });
  return { ok: true };
}

/**
 * تفضيلات التنبيهات — نسخةُ الويب (`saveNotifications` في `actions.ts`).
 *
 * والوضع الهادئ طرفاه معاً أو لا وضع: بدايةٌ بلا نهاية صمتٌ إلى الأبد.
 */
export async function saveNotifications(userId: string, input: NotifyInput) {
  const from = input.quietFrom ?? null;
  const to = input.quietTo ?? null;
  const quiet = from !== null && to !== null;

  await prisma.user.update({
    where: { id: userId },
    data: {
      notifyDm: input.notifyDm,
      notifyFriend: input.notifyFriend,
      notifyOnTag: input.notifyOnTag,
      notifyReaction: input.notifyReaction,
      notifyComment: input.notifyComment,
      notifyStoreNew: input.notifyStoreNew,
      notifyStoreDeals: input.notifyStoreDeals,
      notifyMemories: input.notifyMemories,
      quietFrom: quiet ? from : null,
      quietTo: quiet ? to : null,
    },
  });
  return { ok: true };
}

/**
 * تغيير كلمة المرور.
 *
 * القديمةُ شرط: جهازٌ مفتوحٌ في يد غيرك لا يقفل الحساب على صاحبه.
 * ولا تُبطَل الجلسات: من غيّرها من جهازه لا يُخرَج منه.
 */
export async function changePassword(
  userId: string,
  input: { current: string; next: string },
) {
  const { verifyPassword, hashPassword } = await import("./auth");

  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!row) throw notFound("لا يوجد هذا الحساب");
  /*
     ومن دخل بمزوّدٍ ولا كلمةَ له **يضعها بلا قديمة**: الجلسةُ نفسها
     دليلُ أنّه هو، وبها يصير له بابان — المزوّد والبريد.
  */
  if (row.passwordHash && !(await verifyPassword(input.current, row.passwordHash))) {
    throw forbidden("كلمة المرور الحالية غير صحيحة");
  }
  if (row.passwordHash && input.current === input.next) {
    throw badRequest("الجديدة هي نفسها الحالية");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(input.next) },
  });
  return { ok: true };
}

const clamp = (value: number, low: number, high: number) =>
  Math.round(Math.min(high, Math.max(low, Number(value) || low)));

/**
 * موضع الغلاف وقُربه — ما يراه صاحبه حين يسحبه ويكبّره.
 *
 * وما لم يُرسَل لا يُمسّ: الويب يضبط الرأسيّ وحده، فلا يعيد حفظُه ما ضبطه
 * الجوّال أفقياً أو قرّبه.
 */
export async function setCoverPosition(
  userId: string,
  input: { y: number; x?: number; zoom?: number },
) {
  const data = {
    coverY: clamp(input.y, 0, 100),
    ...(input.x === undefined ? {} : { coverX: clamp(input.x, 0, 100) }),
    ...(input.zoom === undefined ? {} : { coverZoom: clamp(input.zoom, 100, 300) }),
  };
  await prisma.user.update({ where: { id: userId }, data });
  return data;
}

/** إزالة الغلاف — وبكسلاته معه، فلا يبقى ملفٌّ لا يشير إليه شيء. */
export async function clearCover(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { coverMediaId: true },
  });
  await prisma.user.update({ where: { id: userId }, data: { coverMediaId: null, coverItemId: null } });
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
  // ومن لا كلمةَ له: الجلسةُ دليلُه، وبابُ مزوّده يبقى مفتوحاً بعد التغيير.
  if (row.passwordHash && !(await verifyPassword(input.password, row.passwordHash))) {
    throw forbidden("كلمة المرور غير صحيحة");
  }

  const email = input.email.trim().toLowerCase();
  if (email === row.email) throw badRequest("هذا بريدك الحالي");

  const taken = await prisma.user.findFirst({
    where: { email, id: { not: userId } },
    select: { id: true },
  });
  if (taken) throw badRequest("هذا البريد مستعمل في حسابٍ آخر");

  /*
    **بريدٌ جديد بريدٌ غيرُ مؤكَّد**: التأكيدُ كان للعنوان القديم، ونقلُه
    إلى الجديد يجعل عنواناً لم يُفتح قطّ «مؤكَّداً» — وهو بابُ الاستعادة
    يوم تُنسى الكلمة (القاعدة ١١٩ب). ورسالةُ التأكيد تخرج معه في الحال:
    كان الربطُ لا يرسل شيئاً، فمن ربط بريده من حساب سناب بقي بلا رسالة.
  */
  let user: { id: string; email: string | null; name: string };
  try {
    user = await prisma.user.update({
      where: { id: userId },
      data: { email, emailVerifiedAt: null },
      select: { id: true, email: true, name: true },
    });
  } catch {
    // بين الفحص والكتابة لحظةٌ يسع فيها طلبٌ آخر أن يأخذه؛ والقيد هو الحَكَم.
    throw badRequest("هذا البريد مستعمل في حسابٍ آخر");
  }

  const { sendVerify } = await import("./email-tokens");
  const sent = await sendVerify(user.id, email, user.name).catch(() => false);
  return { id: user.id, email: user.email, sent };
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
    // غلافٌ جديد يبدأ من الوسط وبلا تكبير: الموضعُ المحفوظ كان لصورةٍ أخرى.
    data:
      which === "avatar"
        ? { avatarMediaId: media.id }
        : { coverMediaId: media.id, coverItemId: null, coverY: 50, coverX: 50, coverZoom: 100 },
  });

  const old = which === "avatar" ? before?.avatarMediaId : before?.coverMediaId;
  if (old && old !== media.id) await dropMedia([old]);

  // «غيّر صورته» لدائرته (القاعدة ٢١٤) — لا يُنتظر: سطرُ حدثٍ لا يؤخّر الشاشة.
  if (which === "avatar" && old !== media.id) void announceAvatar(userId);

  return { mediaId: media.id };
}

/**
 * حذف الحساب.
 *
 * كلمة المرور شرط: هذه آخر خطوة قبل فقد كل شيء. وملفاته تُجمَع قبل
 * حذفه — الصفوف تذهب بـ`Cascade` وكائنات السحابة لا تذهب معها، فتبقى
 * بكسلاته بعد ذهاب حسابه.
 */
export async function deleteAccount(
  userId: string,
  input: { password?: string; apple?: { idToken: string; code: string } },
) {
  const { verifyPassword } = await import("./auth");

  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true, passwordHash: true },
  });
  if (!row) throw notFound("لا يوجد هذا الحساب");

  /*
     ثلاثة أبوابٍ للتأكيد، وكلّها شيءٌ يملكه صاحبُ الحساب لا من التقط
     جهازه المفتوح:
     ١. **آبل من جديد** — لمن رُبط حسابُه بها: وجهُه أو بصمتُه على نافذة
        النظام، ومعها رمزُ تفويضٍ يُلغى به الربطُ عند آبل (شرطُ 5.1.1(v)).
        وكان هذا الحسابُ يُسأل «كلمة المرور» وهو بلا كلمة، فلا يُحذف.
     ٢. كلمة المرور لمن له كلمة.
     ٣. البريدُ — أو الاسمُ لمن لا بريدَ له — لمن لا كلمةَ له.
  */
  let confirmed = false;
  let appleClient: string | null = null;
  if (input.apple) {
    const { readIdentity } = await import("./oauth");
    const identity = await readIdentity("APPLE", input.apple.idToken, null);
    const linked = await prisma.authIdentity.findFirst({
      where: { userId, provider: "APPLE", subject: identity.subject },
      select: { id: true },
    });
    if (!linked) throw forbidden("حساب آبل هذا غير مربوط بحسابك");
    confirmed = true;
    appleClient = identity.audience ?? null;
  } else if (row.passwordHash) {
    confirmed = await verifyPassword(input.password ?? "", row.passwordHash);
  } else {
    const answer = (row.email ?? row.name).toLowerCase();
    confirmed = (input.password ?? "").trim().toLowerCase() === answer;
  }
  if (!confirmed) {
    throw forbidden(
      row.passwordHash
        ? "كلمة المرور غير صحيحة"
        : row.email
          ? "اكتب بريدك كما هو للتأكيد"
          : "اكتب اسمك كما هو للتأكيد",
    );
  }

  // الإلغاءُ قبل الحذف ولا يوقفه: فشلُه سطرٌ في السجلّ لا حسابٌ عالق.
  if (input.apple && appleClient) {
    const { revokeApple } = await import("./apple-revoke");
    await revokeApple(input.apple.code, appleClient);
  }

  const files = await prisma.media.findMany({ where: { ownerId: userId }, select: { id: true } });
  await dropMedia(files.map((file) => file.id));
  await prisma.user.delete({ where: { id: userId } });

  return { ok: true };
}

// ───────────────────────────── الدعم ─────────────────────────────

/**
 * سببُ التواصل قائمةٌ مغلقة كالموقع (القاعدة ١٨٠ب): اقتراح أو شكوى أو بلاغ،
 * و`beta` لطلب الانضمام إلى فريق التجربة. قيمةٌ خارجها تُردّ لا تُكتب.
 */
export const TICKET_TOPICS = ["suggestion", "complaint", "report"] as const;
const TOPIC_LABEL: Record<string, string> = {
  suggestion: "اقتراح",
  complaint: "شكوى",
  report: "بلاغ",
  beta: "فريق التجربة",
};

/** رسائلي إلى الدعم وردودها. */
export async function tickets(userId: string) {
  const rows = await prisma.supportTicket.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      body: true,
      topic: true,
      reply: true,
      repliedAt: true,
      closed: true,
      createdAt: true,
      _count: { select: { files: true } },
    },
  });
  return {
    tickets: rows.map(({ _count, ...row }) => ({ ...row, files: _count.files })),
  };
}

/**
 * فتح رسالة — وثلاثٌ مفتوحة تكفي: تكرارها يُغرق اللوحة ولا يُسرّع الردّ.
 * ومعها سببُها ومرفقاتُها (صورٌ حتى ثلاث بخمسة ميغا — القاعدة ١٧٩)، والمرفقاتُ
 * تُفحص قبل أن يُكتب شيء: رسالةٌ بلا مرفقاتها نصفُ رسالة.
 */
export async function openTicket(
  userId: string,
  body: string,
  topic: string | null = null,
  picked: File[] = [],
) {
  const text = body.trim().slice(0, 1200);
  if (text.length < 5) throw badRequest("اكتب رسالتك");
  if (topic !== null && !(TICKET_TOPICS as readonly string[]).includes(topic)) {
    throw badRequest("اختر سبب التواصل");
  }

  const open = await prisma.supportTicket.count({
    where: { userId, closed: false, NOT: { topic: "beta" } },
  });
  if (open >= 3) throw badRequest("عندك رسائل مفتوحة — انتظر الردّ عليها");

  const read = await readTicketFiles(picked);
  if ("error" in read) throw badRequest(read.error);

  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, memberNo: true, email: true },
  });
  const ticket = await prisma.supportTicket.create({ data: { userId, body: text, topic } });
  try {
    await saveTicketFiles(ticket.id, read.files);
  } catch {
    // مرفقٌ لم يُحفظ يمحو الرسالة كلَّها — لا نصفَ رسالة (القاعدة ١٧٩).
    await prisma.supportTicket.delete({ where: { id: ticket.id } });
    throw badRequest("تعذّر رفع المرفقات — حاول مرّةً أخرى");
  }

  // خبرٌ إلى صندوق الدعم: لوحةٌ لا يفتحها أحدٌ تترك سؤالاً أسبوعاً.
  void tellSupport({
    from: `${row?.name ?? "مستخدم"} (#${row?.memberNo ?? "?"})${topic ? ` — ${TOPIC_LABEL[topic]}` : ""}`,
    body: read.files.length ? `${text}\n\n[${read.files.length} مرفق — في اللوحة]` : text,
    replyTo: row?.email ?? null,
  });
  return { ok: "وصلتنا رسالتك — نردّ عليك هنا" };
}

/**
 * الانضمامُ إلى فريق التجربة من داخل التطبيق — نموذجُ الموقع نفسه (`/beta`):
 * بريدٌ وجهاز، والدعوةُ تُرسل بيدٍ من TestFlight وGoogle Play (القاعدة ١٨٠ب).
 * وطلبٌ واحدٌ مفتوح يكفي: إعادتُه لا تُسرّع الدعوة.
 */
export async function joinBeta(
  userId: string,
  input: { email: string; device: "iPhone" | "Android"; note?: string },
) {
  const pending = await prisma.supportTicket.count({
    where: { userId, topic: "beta", closed: false },
  });
  if (pending > 0) return { ok: "طلبك وصلنا — ننتظر دعوتك قريباً" };

  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, memberNo: true },
  });
  const note = input.note?.trim().slice(0, 600) ?? "";
  const body = `الجهاز: ${input.device}\nالبريد: ${input.email}${note ? `\n\n${note}` : ""}`;
  await prisma.supportTicket.create({
    data: { userId, topic: "beta", body, name: row?.name ?? null, email: input.email },
  });
  void tellSupport({
    from: `${row?.name ?? "مستخدم"} (#${row?.memberNo ?? "?"}) — فريق التجربة`,
    body,
    replyTo: input.email,
  });
  return { ok: "وصلنا طلبك — تصلك الدعوة على بريدك" };
}
