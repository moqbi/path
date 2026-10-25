import { prisma } from "@athar/db";
import { recordCity } from "./city";
import { POLL_DAYS_DEFAULT, type MomentInput } from "@athar/shared";
import { badRequest, forbidden, notFound } from "../lib/errors";
import { reverseGeocode } from "../lib/places";
import { isSupportedMusicUrl, resolveTrack } from "../lib/music-link";
import { guard } from "../lib/moderation";
import { canInteract, canSeeMoment, circleIds } from "./visibility";
import { dropMedia } from "./media";
import { push } from "./push";
import { canRunGroups } from "./groups";
import { assertSticker, STICKER_TEXT } from "./stickers";

/** تدرّجات تقوم مقام الصورة حين تُنشر لحظة صورة بلا ملف. */

/**
 * جمهور اللحظة.
 *
 * `CIRCLE` أو تصنيفٌ يملكه الناشر أو الدائرةُ ما عدا تصنيفاً منها أو
 * أشخاصٌ بأعيانهم من دائرته. وحين لا
 * يُذكر جمهورٌ يُطبَّق تصنيفه الافتراضي من الخصوصية — «من يمكنه رؤية
 * لحظاتي» — فالإعداد يعمل بلا أن يتذكّره أحد.
 *
 * المختارون يُصفّون بالدائرة هنا لا في الشاشة: معرّفٌ يُدسّ في الطلب لا
 * يجعل غريباً جمهوراً.
 */
export async function readAudience(userId: string, input: MomentInput) {
  if (input.audience === "PICKED") {
    const circle = new Set(await circleIds(userId));
    const viewers = (input.viewers ?? []).filter((id) => circle.has(id));
    if (viewers.length === 0) throw badRequest("اختر من يرى هذه اللحظة");
    return { audience: "PICKED" as const, audienceGroupId: null, viewers };
  }

  // تصنيفٌ يراها وحده، أو تصنيفٌ يُستثنى منها والدائرةُ كلُّها سواه (القاعدة ٢٥٥).
  if (input.audience === "GROUP" || input.audience === "EXCEPT") {
    if (!input.audienceGroupId) throw badRequest("اختر التصنيف");
    const group = await prisma.friendGroup.findFirst({
      where: { id: input.audienceGroupId, ownerId: userId },
      select: { id: true },
    });
    if (!group) throw notFound("التصنيف غير موجود");
    return { audience: input.audience, audienceGroupId: group.id, viewers: [] };
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
export async function attachViewers(momentId: string, viewers: string[]) {
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
      title: "إشارة جديدة",
      body: `${who?.name ?? "صديقك"} أشار إليك في لحظته`,
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
  // واسمُ المكان نصٌّ يرسله الجهاز وإن اختير من قائمة، فيُفحص معه.
  /*
    الاستطلاعُ للمشرف وحده وعلى الخاطرة وحدها (القاعدة ٢٨٩): السؤالُ نصُّها،
    والخياراتُ تمرّ بقائمة الكلمات معه.
  */
  const poll = input.poll?.map((option) => option.trim()).filter(Boolean) ?? [];
  if (poll.length) {
    if (input.kind !== "THOUGHT") throw badRequest("الاستطلاع على اللحظة النصية");
    if (!(await canRunGroups(userId))) throw forbidden("الاستطلاع للمشرف");
    if (poll.length < 2) throw badRequest("اكتب خيارين على الأقل");
    if (new Set(poll).size !== poll.length) throw badRequest("الخيارات مكرّرة");
  }
  await guard([text, input.place, ...poll].filter(Boolean).join("\n"));
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
  /*
    الصورُ بعد الأولى (القاعدة ٣٤٣): لصاحبها، معتمدةٌ، صورٌ لا مقاطع، بلا تكرار —
    وعلى لحظة صورةٍ لها أولى. والأولى تبقى `mediaId` فيقرؤها الجوّالُ القديم.
  */
  const extra = input.kind === "PHOTO" && mediaId ? [...new Set(input.photos ?? [])].filter((id) => id !== mediaId) : [];
  if (extra.length) {
    const found = await prisma.media.findMany({
      where: { id: { in: extra }, ownerId: userId, ready: true, mime: { startsWith: "image/" }, moment: null, momentPhoto: null },
      select: { id: true },
    });
    if (found.length !== extra.length) throw notFound("الملف غير موجود");
  }
  /*
    لحظةُ صورةٍ بلا صورة خاطرةٌ بنصّها — **بقرار المالك**: كانت تُلبَس تدرّجاً
    عشوائيّاً (`imageSpec`) فتنزل قالباً أصفر فارغاً فوق ما كتبه صاحبُها. وبلا
    صورةٍ ولا نصّ لا شيء يُنشر.
  */
  if (input.kind === "PHOTO" && !mediaId && !text) throw badRequest("اختر صورة أو اكتب شيئاً");
  const kind = input.kind === "PHOTO" && !mediaId ? "THOUGHT" : input.kind;
  const seen = await readAudience(userId, input);
  const where = await readPlace(userId, input, me.city);

  // لحظة المكان لا تُنشر بلا اسم: المدينة تقوم مقامه حين يُطفأ الموقع.
  const placeName =
    input.kind === "PLACE" ? (where.placeName ?? where.placeCity ?? "مكان") : where.placeName;

  const moment = await prisma.moment.create({
    data: {
      authorId: userId,
      kind,
      text,
      mediaId,
      photoX: mediaId ? (input.photoX ?? null) : null,
      photoY: mediaId ? (input.photoY ?? null) : null,
      photos: extra.length ? { create: extra.map((id, index) => ({ mediaId: id, position: index + 1 })) } : undefined,
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
      pollOptions: poll,
      // نسخةٌ قبل المدّة لا ترسلها، فتأخذ الافتراضيّ (القاعدة ٢٩٠).
      pollEndsAt: poll.length
        ? new Date(Date.now() + (input.pollDays ?? POLL_DAYS_DEFAULT) * 86_400_000)
        : null,
    },
    select: { id: true },
  });

  await attachViewers(moment.id, seen.viewers);
  await attachTags(moment.id, userId, input.with ?? []);

  await markCity(userId, where.placeCity);

  return { id: moment.id };
}

/**
 * «وصل إلى الرياض»: مدينةٌ تغيّرت تُكتب لحظةً بنفسها.
 *
 * والمدينةُ تُحفظ مع اللحظة لا تُحسب مرّتين: من لم تتغيّر مدينتُه لا
 * يُكتب له شيء، ومن تغيّرت كُتبت مرّةً واحدة — الصفُّ والحدث في معاملةٍ
 * واحدة فلا تبقى لحظةٌ بلا مدينةٍ محفوظة ولا مدينةٌ بلا لحظة.
 */
async function markCity(userId: string, city: string | null) {
  return recordCity(userId, city);
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
/** ما يقرؤه الجوّالُ من خرائط آبل ويرسله مع الإحداثيات (القاعدة ٢٨٦). */
type FromDevice = { airport?: string; city?: string; country?: string; countryCode?: string };

/** عربيٌّ؟ اسمٌ لاتينيّ من جهازٍ بلغةٍ أخرى يُقرأ مدينةً ثانية بجانب الاسم العربيّ المحفوظ. */
const arabic = (text?: string | null) => (text && /[\u0600-\u06FF]/.test(text) ? text : null);

export async function checkInCity(userId: string, lat: number, lng: number, device: FromDevice = {}) {
  const place = await reverseGeocode(lat, lng);
  /*
    المدينةُ والدولةُ والمطارُ من خرائط آبل على الجهاز (القاعدة ٢٨٦) — بلا مفتاحٍ
    ولا حصّة — ونوميناتيم احتياطٌ لما لم يرسله الجهاز. والمطارُ لا يُكتب إلا حين
    تتبدّل الدولة (`recordCity`)؛ وتبدّلُ المدينة يُكتب «وصل إلى جدة» كما كان.
  */
  /*
    آبل ونوميناتيم قد يكتبان المدينةَ نفسها بحرفين («جدة» و«جده»): إن قال
    نوميناتيم إنّها مدينةُ آخر قراءة بقيت كما حُفظت — وإلّا كُتب وصولٌ كاذب
    لكلّ أحدٍ ساعةَ يصله التحديث.
  */
  const before = await prisma.user.findUnique({ where: { id: userId }, select: { lastCity: true } });
  if (!before) throw notFound("لا حساب");
  const stored = before.lastCity?.split("، ")[0] ?? null;
  const city = stored && place.city === stored ? stored : (arabic(device.city) ?? place.city);
  const wrote = await recordCity(userId, {
    city,
    country: arabic(device.country) ?? place.country ?? null,
    countryCode: device.countryCode?.toLowerCase() ?? place.countryCode ?? null,
    airport: place.airport ?? device.airport ?? null,
  });
  return { city, wrote };
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
    select: { authorId: true, mediaId: true, photos: { select: { mediaId: true } } },
  });
  if (!moment) throw notFound("اللحظة غير موجودة");

  // «لا تُحذف لحظة غيرك» تُقال لمن يراها. ومن لا يراها أصلاً يُردّ
  // بـ«غير موجودة»: وإلا صار الحذف باباً يُعرف منه أنّ اللحظة موجودة.
  if (moment.authorId !== userId) {
    if (!(await canSeeMoment(userId, momentId))) throw notFound("اللحظة غير موجودة");
    throw forbidden("لا تُحذف لحظة غيرك");
  }

  await prisma.moment.delete({ where: { id: momentId } });
  // والصورُ بعد الأولى معها (القاعدة ٣٤٣).
  await dropMedia([moment.mediaId, ...moment.photos.map((photo) => photo.mediaId)].filter((id): id is string => Boolean(id)));

  return { ok: true };
}

/** أنواعٌ لها متنٌ يكتبه صاحبُها — وما سواها أسطرُ أحداثٍ لا نصَّ فيها يُعدَّل. */
const EDITABLE = new Set(["THOUGHT", "PHOTO"]);

/**
 * تعديلُ نصّ اللحظة (القاعدة ٣١٩): لصاحبها وحده، والكلماتُ الممنوعة تُفحص كالنشر،
 * و«عُدّلت» يبقى ظاهراً — لا نُخفي أنّ الكلام تغيّر (كالقاعدة ٣٥). ولا يُعدَّل سؤالُ
 * استطلاعٍ صُوّت عليه، ولا ملخّصُ سنة: النصّان أرقامٌ وسؤالٌ لا كلام.
 */
export async function editMoment(userId: string, momentId: string, text: string) {
  const moment = await prisma.moment.findUnique({
    where: { id: momentId },
    select: { authorId: true, kind: true, recapYear: true, pollOptions: true },
  });
  if (!moment) throw notFound("اللحظة غير موجودة");
  if (moment.authorId !== userId) {
    if (!(await canSeeMoment(userId, momentId))) throw notFound("اللحظة غير موجودة");
    throw forbidden("لا تُعدَّل لحظة غيرك");
  }
  if (!EDITABLE.has(moment.kind) || moment.recapYear || moment.pollOptions.length > 0) {
    throw badRequest("هذه اللحظة لا تُعدَّل");
  }
  const clean = text.trim();
  if (moment.kind === "THOUGHT" && !clean) throw badRequest("اكتب شيئاً");
  if (clean) await guard(clean);

  const saved = await prisma.moment.update({
    where: { id: momentId },
    data: { text: clean || null, editedAt: new Date() },
    select: { id: true, text: true, editedAt: true },
  });
  return { moment: saved };
}

/** التفاعل والتعليق يمرّان بحدّ صاحب اللحظة: «من يمكنه التفاعل معك». */
async function assertCanInteract(userId: string, momentId: string) {
  if (!(await canSeeMoment(userId, momentId))) throw notFound("اللحظة غير موجودة");

  const moment = await prisma.moment.findUnique({
    where: { id: momentId },
    select: { authorId: true, kind: true, commentsLocked: true },
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
      title: "تفاعل جديد على لحظتك",
      body: `${who?.name ?? "صديقك"} تفاعل مع لحظتك`,
      path: `/m/${momentId}`,
    });
  }

  return { reacted: true };
}

/**
 * نتيجةُ الاستطلاع كما يراها القارئ (القاعدة ٢٨٩).
 *
 * الأعدادُ بعد التصويت أو لصاحبه وحده: من يرى النسبَ قبل أن يختار يتبع
 * الأغلبيّة. والرؤيةُ شرطُها شرطُ اللحظة — «غير موجودة» لمن لا يراها.
 */
export async function pollState(userId: string, momentId: string) {
  if (!(await canSeeMoment(userId, momentId))) throw notFound("اللحظة غير موجودة");
  const moment = await prisma.moment.findUnique({
    where: { id: momentId },
    select: { authorId: true, pollOptions: true, pollEndsAt: true },
  });
  if (!moment || moment.pollOptions.length === 0) throw notFound("لا استطلاع هنا");
  const closed = pollClosed(moment.pollEndsAt);

  const [mine, groups] = await Promise.all([
    prisma.pollVote.findUnique({
      where: { momentId_userId: { momentId, userId } },
      select: { choice: true },
    }),
    prisma.pollVote.groupBy({ by: ["choice"], where: { momentId }, _count: { _all: true } }),
  ]);

  const counts = moment.pollOptions.map(
    (_, index) => groups.find((row) => row.choice === index)?._count._all ?? 0,
  );
  // وبعد انتهائه النتيجةُ للجميع (القاعدة ٢٩٠).
  const reveal = closed || mine !== null || moment.authorId === userId;
  return {
    options: moment.pollOptions,
    endsAt: moment.pollEndsAt,
    closed,
    mine: mine?.choice ?? null,
    counts: reveal ? counts : null,
    total: reveal ? counts.reduce((sum, n) => sum + n, 0) : null,
  };
}

/** انتهى؟ — `null` استطلاعٌ قبل المدّة لم تُصلحه الهجرة، فيبقى مفتوحاً. */
const pollClosed = (endsAt: Date | null) => endsAt !== null && endsAt.getTime() <= Date.now();

/** صوتٌ واحد لكلّ شخص، والضغطُ على خيارٍ آخر يبدّله. ولا يصوّت صاحبُه. */
export async function votePoll(userId: string, momentId: string, choice: number) {
  const moment = await assertCanInteract(userId, momentId);
  if (moment.authorId === userId) throw badRequest("لا تصوّت على استطلاعك");
  const row = await prisma.moment.findUnique({
    where: { id: momentId },
    select: { pollOptions: true, pollEndsAt: true },
  });
  if (!row || choice >= row.pollOptions.length) throw badRequest("الخيار غير موجود");
  // المنتهي لا يُصوَّت فيه ولا يُبدَّل صوتُه (القاعدة ٢٩٠).
  if (pollClosed(row.pollEndsAt)) throw badRequest("انتهى الاستطلاع");

  await prisma.pollVote.upsert({
    where: { momentId_userId: { momentId, userId } },
    create: { momentId, userId, choice },
    update: { choice },
  });
  return pollState(userId, momentId);
}

/** تعليق. */
export async function addComment(userId: string, momentId: string, body: string, stickerId?: string) {
  // الملصقُ يحلّ محلّ النصّ، و«ملصق» نصُّه لما لا يرسمه (القاعدة ٢٩١).
  // اللحظةُ أوّلاً: من لا يراها يُقال له «غير موجودة» قبل أيّ سؤالٍ عن الملصق.
  const moment = await assertCanInteract(userId, momentId);
  // القفلُ بيد صاحبها، ولا يُقفل عليه هو: يردّ على ما سبق القفل.
  if (moment.commentsLocked && moment.authorId !== userId) {
    throw forbidden("أقفل صاحبُ اللحظة التعليقات");
  }
  const sticker = stickerId ? await assertSticker(userId, stickerId) : null;
  if (sticker) body = STICKER_TEXT;
  await guard(body);

  const comment = await prisma.comment.create({
    data: { momentId, userId, body: body.trim().slice(0, 500), stickerId: sticker },
    select: {
      id: true,
      body: true,
      sticker: { select: { mediaId: true } },
      createdAt: true,
      user: {
        select: {
          id: true,
          name: true,
          isPlus: true,
          avatarMediaId: true,
          tag: { select: { name: true, bg: true, fg: true } },
          // الإطارُ والتشارم مع صورة المعلّق كما في كلّ مكانٍ تظهر فيه صورته.
          frame: { select: { spec: true, mediaId: true, frameHole: true } },
          charm: { select: { spec: true, mediaId: true } },
        },
      },
    },
  });

  if (moment.authorId !== userId) {
    void push({
      userId: moment.authorId,
      kind: "COMMENT",
      title: `تعليق جديد على لحظتك من ${comment.user.name}`,
      body: comment.body.slice(0, 120),
      path: `/m/${momentId}`,
    });
  }

  return comment;
}

/**
 * تعديلُ تعليق (القاعدة ٣١٩): لكاتبه وحده — صاحبُ اللحظة يحذف ولا يُعدّل كلامَ غيره.
 * والملصقُ لا يُعدَّل (القاعدة ٢٩١)، والكلماتُ تُفحص كالكتابة الأولى.
 */
export async function editComment(userId: string, commentId: string, body: string) {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { userId: true, stickerId: true, momentId: true },
  });
  if (!comment) throw notFound("التعليق غير موجود");
  if (comment.userId !== userId) {
    if (!(await canSeeMoment(userId, comment.momentId))) throw notFound("التعليق غير موجود");
    throw forbidden("لا يُعدَّل تعليق غيرك");
  }
  if (comment.stickerId) throw badRequest("الملصق لا يُعدَّل");
  await guard(body);

  const saved = await prisma.comment.update({
    where: { id: commentId },
    data: { body: body.trim().slice(0, 500), editedAt: new Date() },
    select: { id: true, body: true, editedAt: true },
  });
  return { comment: saved };
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

/** «شافها» لدفعةٍ ممّا مرّ على الشاشة — الخطّ الزمنيّ لا يُفتح لحظةً لحظة. */
export async function markSeenMany(userId: string, ids: string[]) {
  for (const id of [...new Set(ids)].slice(0, 50)) await markSeen(userId, id);
  return { ok: true };
}

/**
 * لوحةُ صاحب اللحظة: من شاهدها ومن تفاعل منهم وبماذا، وقفلُ التعليقات.
 *
 * لصاحبها وحده، ولغيره «غير موجودة» (القاعدة ٢٣ب). والمشاهدُ هو من مرّت
 * اللحظةُ على شاشته — وصاحبُها لا يُعدّ من مشاهديه. ومن تفاعل ولم تُسجَّل
 * مشاهدتُه (نسخةٌ قديمة لا ترسلها) يُعدّ مشاهداً: التفاعلُ دليلُ الرؤية.
 */
export async function audience(userId: string, momentId: string) {
  const moment = await prisma.moment.findUnique({
    where: { id: momentId },
    select: { authorId: true, commentsLocked: true },
  });
  if (!moment || moment.authorId !== userId) throw notFound("اللحظة غير موجودة");

  const person = {
    id: true,
    name: true,
    avatarMediaId: true,
    // بلا تشارم: ركنُ الوجه هنا لشارة التفاعل (القاعدة ٤٧).
    frame: { select: { spec: true, mediaId: true, frameHole: true } },
  } as const;

  const [views, reactions] = await Promise.all([
    prisma.view.findMany({
      where: { momentId, userId: { not: userId } },
      orderBy: { seenAt: "desc" },
      take: 300,
      select: { seenAt: true, user: { select: person } },
    }),
    prisma.reaction.findMany({
      where: { momentId, userId: { not: userId } },
      orderBy: { createdAt: "desc" },
      select: { kind: true, emoji: true, createdAt: true, user: { select: person } },
    }),
  ]);

  const seen = new Set(views.map((v) => v.user.id));
  // من تفاعل أوّلاً، ثمّ من شاهد بلا تفاعل — الأحدثُ أوّلاً في كلٍّ.
  const people = [
    ...reactions.map((r) => ({ user: r.user, reaction: { kind: r.kind, emoji: r.emoji } })),
    ...views
      .filter((v) => !reactions.some((r) => r.user.id === v.user.id))
      .map((v) => ({ user: v.user, reaction: null })),
  ];
  const count = seen.size + reactions.filter((r) => !seen.has(r.user.id)).length;

  return { commentsLocked: moment.commentsLocked, views: count, people };
}

/** قفلُ التعليقات وفتحُها — لصاحب اللحظة وحده. */
export async function lockComments(userId: string, momentId: string, locked: boolean) {
  const done = await prisma.moment.updateMany({
    where: { id: momentId, authorId: userId },
    data: { commentsLocked: locked },
  });
  if (done.count === 0) throw notFound("اللحظة غير موجودة");
  return { commentsLocked: locked };
}
