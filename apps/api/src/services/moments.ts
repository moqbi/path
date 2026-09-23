import { prisma } from "@athar/db";
import type { MomentInput } from "@athar/shared";
import { badRequest, forbidden, notFound } from "../lib/errors";
import { reverseGeocode } from "../lib/places";
import { isSupportedMusicUrl, resolveTrack } from "../lib/music-link";
import { guard } from "../lib/moderation";
import { canInteract, canSeeMoment, circleIds } from "./visibility";
import { dropMedia } from "./media";
import { push } from "./push";

/** تدرّجات تقوم مقام الصورة حين تُنشر لحظة صورة بلا ملف. */
const IMAGE_SPECS = [
  "linear-gradient(160deg,#f6b93b,#ff7a5a 55%,#8c3f4a)",
  "linear-gradient(160deg,#ffb27a,#c05a54 70%,#3b2a33)",
  "linear-gradient(160deg,#f7f5ef,#d09a72 45%,#5a4152)",
  "linear-gradient(160deg,#8fa7b8,#3f5a6b 60%,#0e1a24)",
  "linear-gradient(160deg,#ffd27a,#d1706a 55%,#2f3742)",
];

const randomImage = () => IMAGE_SPECS[Math.floor(Math.random() * IMAGE_SPECS.length)];

/**
 * جمهور اللحظة.
 *
 * `CIRCLE` أو تصنيفٌ يملكه الناشر أو أشخاصٌ بأعيانهم من دائرته. وحين لا
 * يُذكر جمهورٌ يُطبَّق تصنيفه الافتراضي من الخصوصية — «من يمكنه رؤية
 * لحظاتي» — فالإعداد يعمل بلا أن يتذكّره أحد.
 *
 * المختارون يُصفّون بالدائرة هنا لا في الشاشة: معرّفٌ يُدسّ في الطلب لا
 * يجعل غريباً جمهوراً.
 */
async function readAudience(userId: string, input: MomentInput) {
  if (input.audience === "PICKED") {
    const circle = new Set(await circleIds(userId));
    const viewers = (input.viewers ?? []).filter((id) => circle.has(id));
    if (viewers.length === 0) throw badRequest("اختر من يرى هذه اللحظة");
    return { audience: "PICKED" as const, audienceGroupId: null, viewers };
  }

  if (input.audience === "GROUP") {
    if (!input.audienceGroupId) throw badRequest("اختر التصنيف");
    const group = await prisma.friendGroup.findFirst({
      where: { id: input.audienceGroupId, ownerId: userId },
      select: { id: true },
    });
    if (!group) throw notFound("التصنيف غير موجود");
    return { audience: "GROUP" as const, audienceGroupId: group.id, viewers: [] };
  }

  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { viewGroupId: true },
  });
  return row?.viewGroupId
    ? { audience: "GROUP" as const, audienceGroupId: row.viewGroupId, viewers: [] }
    : { audience: "CIRCLE" as const, audienceGroupId: null, viewers: [] };
}

/** المختارون يُحفظون بأعيانهم بعد إنشاء اللحظة. */
async function attachViewers(momentId: string, viewers: string[]) {
  if (viewers.length === 0) return;
  await prisma.momentViewer.createMany({
    data: viewers.map((userId) => ({ momentId, userId })),
    skipDuplicates: true,
  });
}

/**
 * الإشارة «مع فلان» تظهر فوراً بلا موافقة.
 *
 * واللحظة تبقى في صفحة كاتبها وحده ولا تدخل صفحة المُشار إليه — سلوك
 * Path نفسه. ولا يُشار إلا لمن هو داخل الدائرة.
 */
async function attachTags(momentId: string, authorId: string, userIds: string[]) {
  const wanted = [...new Set(userIds)].filter((id) => id && id !== authorId);
  if (wanted.length === 0) return;

  const allowed = new Set(await circleIds(authorId));
  const data = wanted.filter((id) => allowed.has(id)).map((userId) => ({ momentId, userId }));
  if (data.length === 0) return;

  await prisma.momentTag.createMany({ data, skipDuplicates: true });

  // والإشارة تصل صاحبَها تنبيهاً: هي الخبرُ الذي لا يراه في خطّه
  // (اللحظة تبقى في صفحة كاتبها وحده).
  const who = await prisma.user.findUnique({ where: { id: authorId }, select: { name: true } });
  for (const row of data) {
    void push({
      userId: row.userId,
      kind: "TAG",
      title: who?.name ?? "صديقك",
      body: "أشار إليك في لحظة",
      path: `/m/${momentId}`,
    });
  }
}

/**
 * الموقع على أي لحظة.
 *
 * الإحداثيات من الجهاز، والاسم ما اختاره صاحبها وإلا أقرب عنوان.
 * و«إظهار موقعي» مطفأً يُبقي المدينة وحدها: لا نقطة ولا اسم مكان.
 */
async function readPlace(
  userId: string,
  input: MomentInput,
  fallbackCity: string | null,
): Promise<{
  lat: number | null;
  lng: number | null;
  placeName: string | null;
  placeCity: string | null;
}> {
  if (input.lat === undefined || input.lng === undefined) {
    return { lat: null, lng: null, placeName: null, placeCity: null };
  }

  const place = await reverseGeocode(input.lat, input.lng);
  const city = place.city ?? fallbackCity;

  const settings = await prisma.user.findUnique({
    where: { id: userId },
    select: { shareLocation: true },
  });
  const precise = settings?.shareLocation !== false;

  return {
    lat: precise ? input.lat : null,
    lng: precise ? input.lng : null,
    placeName: precise ? (input.place?.trim() || place.name) : null,
    placeCity: city,
  };
}

/** الملف المرفوع لصاحبه وحده، وغير موصولٍ بلحظةٍ سابقة. */
async function ownMedia(userId: string, mediaId: string) {
  // معتمدٌ لا مرفوعٌ فقط: ما لم تُفحص بايتاته لا يُربط بلحظة.
  const media = await prisma.media.findFirst({
    where: { id: mediaId, ownerId: userId, ready: true },
    select: { id: true },
  });
  if (!media) throw notFound("الملف غير موجود");
  return media.id;
}

/**
 * نشر لحظة.
 *
 * `PLACE` وحدها تشترط إحداثيات؛ وما عداها يقبلها زائدةً. والمدينة إن
 * تغيّرت كُتبت سطراً مستقلاً: الانتقال حدثٌ في حياة الدائرة، ويُشتقّ من
 * التحديد نفسه فلا شاشة له ولا زر.
 */
export async function createMoment(userId: string, input: MomentInput) {
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, city: true },
  });
  if (!me) throw notFound("لا يوجد هذا الحساب");

  const text = input.text?.trim() || null;
  if (!text && input.kind === "THOUGHT") throw badRequest("اكتب شيئاً");
  // الفلترة قبل الكتابة: ما يُمنع يقف عند صاحبه لا بعد أن يراه الناس.
  await guard(text);
  if (input.kind === "PLACE" && (input.lat === undefined || input.lng === undefined)) {
    throw badRequest("تعذّر تحديد موقعك");
  }

  /*
    الأغنية رابطٌ يُلصق لا حسابٌ يُربط.

    العنوان والفنان والصورة تُقرأ من oEmbed — واجهةٌ عامّة بلا مفاتيح ولا
    OAuth — والفشل لا يمنع النشر: يبقى الرابط وحده قابلاً للفتح.
  */
  const musicUrl = input.kind === "MUSIC" ? (input.musicUrl?.trim() ?? "") : "";
  if (input.kind === "MUSIC") {
    if (!musicUrl) throw badRequest("الصق رابط الأغنية");
    if (!isSupportedMusicUrl(musicUrl)) {
      throw badRequest("الرابط من يوتيوب أو ساوندكلاود أو سبوتيفاي");
    }
  }
  const track = musicUrl ? await resolveTrack(musicUrl) : null;

  const mediaId = input.mediaId ? await ownMedia(userId, input.mediaId) : null;
  const seen = await readAudience(userId, input);
  const where = await readPlace(userId, input, me.city);

  // لحظة المكان لا تُنشر بلا اسم: المدينة تقوم مقامه حين يُطفأ الموقع.
  const placeName =
    input.kind === "PLACE" ? (where.placeName ?? where.placeCity ?? "مكان") : where.placeName;

  const moment = await prisma.moment.create({
    data: {
      authorId: userId,
      kind: input.kind,
      text,
      mediaId,
      imageSpec: input.kind === "PHOTO" && !mediaId ? randomImage() : null,
      lat: where.lat,
      lng: where.lng,
      placeName,
      placeCity: where.placeCity,
      audience: seen.audience,
      audienceGroupId: seen.audienceGroupId,
      musicUrl: musicUrl || null,
      musicTitle: track?.title ?? null,
      musicArtist: track?.artist ?? null,
      musicThumb: track?.thumb ?? null,
    },
    select: { id: true },
  });

  await attachViewers(moment.id, seen.viewers);
  await attachTags(moment.id, userId, input.with ?? []);

  await markCity(userId, where.placeCity, me.city);

  return { id: moment.id };
}

/**
 * «وصل إلى الرياض»: مدينةٌ تغيّرت تُكتب لحظةً بنفسها.
 *
 * والمدينةُ تُحفظ مع اللحظة لا تُحسب مرّتين: من لم تتغيّر مدينتُه لا
 * يُكتب له شيء، ومن تغيّرت كُتبت مرّةً واحدة — الصفُّ والحدث في معاملةٍ
 * واحدة فلا تبقى لحظةٌ بلا مدينةٍ محفوظة ولا مدينةٌ بلا لحظة.
 */
async function markCity(userId: string, city: string | null, was: string | null) {
  if (!city || city === was) return false;
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { city } }),
    prisma.moment.create({ data: { authorId: userId, kind: "CITY", text: city } }),
  ]);
  return true;
}

/**
 * فتحُ التطبيق في مدينةٍ أخرى يكتب لحظةَ الوصول.
 *
 * وكان لا يُكتب إلا مع نشر لحظةٍ فيها موقع — فمن سافر ولم ينشر شيئاً
 * لم تعرف دائرتُه أنّه سافر، **وهذا ما طلبه المالك**: اللحظةُ تُرسل
 * أوّل ما يُفتح التطبيق في مدينةٍ ثانية.
 *
 * والإذنُ لا يُطلب من أجلها (القاعدة ٦٨): الجهاز يرسل إحداثياته إن
 * كان الإذنُ ممنوحاً أصلاً، وإلّا لم يُنادَ هذا الباب.
 * و«إظهار موقعي» لا يمنعها: المدينةُ تبقى في كل حال (القاعدة ٦٨)،
 * وهي وحدها ما يُحفظ هنا — لا نقطةَ ولا اسمَ مكان.
 */
export async function checkInCity(userId: string, lat: number, lng: number) {
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { city: true } });
  if (!me) throw notFound("لا حساب");

  const place = await reverseGeocode(lat, lng);
  const wrote = await markCity(userId, place.city, me.city);
  return { city: place.city, wrote };
}

/**
 * «نمت» و«صحيت»: لحظةٌ بلا متن — ساعتها هي خبرها.
 *
 * لا يُكتب الوقت نصّاً: `createdAt` يحمله والعرض يقرأه منه. نصٌّ مكتوب
 * يتجمّد حين يتغيّر تنسيق الساعة أو منطقتها، والطابع لا يتجمّد.
 */
export async function postMark(userId: string, kind: "SLEEP" | "WAKE") {
  const moment = await prisma.moment.create({
    data: { authorId: userId, kind },
    select: { id: true },
  });
  return { id: moment.id };
}

/**
 * حذف لحظة: لصاحبها وحده.
 *
 * التفاعلات والتعليقات والمشاهدات والإشارات تذهب بـ`Cascade`. وصورتها
 * تذهب بيدنا: علاقة الصورة `SetNull`، فحذف اللحظة وحده كان يترك
 * بكسلاتها إلى الأبد. «تُحذف» تعني ألّا يبقى منها شيء — لا في القاعدة
 * ولا في السحابة.
 */
export async function deleteMoment(userId: string, momentId: string) {
  const moment = await prisma.moment.findUnique({
    where: { id: momentId },
    select: { authorId: true, mediaId: true },
  });
  if (!moment) throw notFound("اللحظة غير موجودة");

  // «لا تُحذف لحظة غيرك» تُقال لمن يراها. ومن لا يراها أصلاً يُردّ
  // بـ«غير موجودة»: وإلا صار الحذف باباً يُعرف منه أنّ اللحظة موجودة.
  if (moment.authorId !== userId) {
    if (!(await canSeeMoment(userId, momentId))) throw notFound("اللحظة غير موجودة");
    throw forbidden("لا تُحذف لحظة غيرك");
  }

  await prisma.moment.delete({ where: { id: momentId } });
  if (moment.mediaId) await dropMedia([moment.mediaId]);

  return { ok: true };
}

/** التفاعل والتعليق يمرّان بحدّ صاحب اللحظة: «من يمكنه التفاعل معك». */
async function assertCanInteract(userId: string, momentId: string) {
  if (!(await canSeeMoment(userId, momentId))) throw notFound("اللحظة غير موجودة");

  const moment = await prisma.moment.findUnique({
    where: { id: momentId },
    select: { authorId: true, kind: true },
  });
  if (!moment) throw notFound("اللحظة غير موجودة");
  if (!(await canInteract(userId, moment.authorId))) {
    throw forbidden("صاحب اللحظة حصر التفاعل في تصنيف من أصدقائه");
  }
  return moment;
}

/**
 * تفاعلٌ واحد لكل شخصٍ لكل لحظة، والضغط على نفسه يلغيه.
 *
 * الإيموجي الحر لمشتركي آثار+، ووجه النوم للحظات النوم وحدها — والفحصان
 * هنا لا في إخفاء الزر: ما لا يُفحص على الخادم ليس ممنوعاً.
 */
export async function react(
  userId: string,
  momentId: string,
  input: { kind: string; emoji?: string },
) {
  const moment = await assertCanInteract(userId, momentId);

  if (input.kind === "CUSTOM") {
    const me = await prisma.user.findUnique({
      where: { id: userId },
      select: { isPlus: true },
    });
    if (!me?.isPlus) throw forbidden("الإيموجي الحر لمشتركي آثار+");
    if (!input.emoji) throw badRequest("اختر رمزاً");
  }

  if (input.kind === "SLEEPY" && moment.kind !== "SLEEP") {
    throw badRequest("وجه النوم للحظات النوم");
  }

  const emoji = input.kind === "CUSTOM" ? (input.emoji ?? null) : null;
  const existing = await prisma.reaction.findUnique({
    where: { momentId_userId: { momentId, userId } },
    select: { id: true, kind: true, emoji: true },
  });

  if (existing && existing.kind === input.kind && existing.emoji === emoji) {
    await prisma.reaction.delete({ where: { id: existing.id } });
    return { reacted: false };
  }

  await prisma.reaction.upsert({
    where: { momentId_userId: { momentId, userId } },
    create: { momentId, userId, kind: input.kind as never, emoji },
    update: { kind: input.kind as never, emoji },
  });

  // ولا يُنبَّه أحدٌ على تفاعله بنفسه.
  if (moment.authorId !== userId) {
    const who = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    void push({
      userId: moment.authorId,
      kind: "REACTION",
      title: who?.name ?? "صديقك",
      body: "تفاعل مع لحظتك",
      path: `/m/${momentId}`,
    });
  }

  return { reacted: true };
}

/** تعليق. */
export async function addComment(userId: string, momentId: string, body: string) {
  await guard(body);
  const moment = await assertCanInteract(userId, momentId);

  const comment = await prisma.comment.create({
    data: { momentId, userId, body: body.trim().slice(0, 500) },
    select: {
      id: true,
      body: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          name: true,
          isPlus: true,
          avatarMediaId: true,
          tag: { select: { name: true, bg: true, fg: true } },
        },
      },
    },
  });

  if (moment.authorId !== userId) {
    void push({
      userId: moment.authorId,
      kind: "COMMENT",
      title: comment.user.name,
      body: comment.body.slice(0, 120),
      path: `/m/${momentId}`,
    });
  }

  return comment;
}

/** حذف تعليق: لكاتبه ولصاحب اللحظة. */
export async function deleteComment(userId: string, commentId: string) {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { userId: true, moment: { select: { authorId: true } } },
  });
  if (!comment) throw notFound("التعليق غير موجود");
  if (comment.userId !== userId && comment.moment.authorId !== userId) {
    throw forbidden("لا تُحذف تعليق غيرك");
  }

  await prisma.comment.delete({ where: { id: commentId } });
  return { ok: true };
}

/** «شافها»: مرّةً واحدة لكل شخص، وبصمتٍ إن لم يكن يراها. */
export async function markSeen(userId: string, momentId: string) {
  if (!(await canSeeMoment(userId, momentId))) return { ok: true };

  await prisma.view.upsert({
    where: { momentId_userId: { momentId, userId } },
    create: { momentId, userId },
    update: {},
  });
  return { ok: true };
}
