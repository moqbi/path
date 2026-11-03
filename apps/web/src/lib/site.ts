import { cache } from "react";
import { prisma } from "@/lib/db";

/**
 * محتوى الموقع العام: الافتراضيّ في الكود، والتعديل في القاعدة.
 *
 * **الافتراضيّ ليس بذرة**: لا يُكتب صفٌّ إلا حين يعدّله المشرف، فقاعدةٌ
 * جديدةٌ تعرض الموقع كاملاً بلا صفٍّ واحد — ونشرٌ على قاعدةٍ عامرة لا
 * يمسّ ما حرّره أحد. وحذفُ الصفّ يردّ الافتراضيّ، فلا حاجة إلى «استعادة».
 *
 * والمفتاح يقول مكانه (`hero.line`، `feature.circle.body`) فلا يحتاج
 * جدولَ «صفحة» وجدولَ «قسم»: الصفحات معدودة، وشجرةُ محتوى كاملة لموقعٍ
 * من سبع صفحات تُبنى مرّةً وتُصان إلى الأبد.
 */
export const SITE_TEXT = {
  // ── الرأس ──
  /** الكلمةُ العملاقة خلف الهاتف (القاعدة ٢٧٦) — كلمةٌ أو اثنتان، وما طال يُصغَّر ليتّسع. */
  "hero.word": "آثار",
  "hero.line": "بعض اللحظات تستحق أن تبقى.",
  "hero.latin": "Some moments deserve to stay.",
  "hero.body":
    "آثار مومنتس هو المكان الهادئ الذي تجمع فيه لحظاتك، وتشاركها مع ناسك، وتعود إليها كلما احتجت أن تتذكّر ما يجمعكم.",

  // ── المزايا ──
  "feature.moments.title": "اللحظات",
  "feature.moments.body": "صورة، فكرة، مكان، أغنية — سطرٌ صغير يقول أين أنت اليوم.",
  "feature.stories.title": "القصص",
  "feature.stories.body": "صورة أو فيديو حتى دقيقة، بنصوصٍ وملصقاتٍ وموسيقى وفلاتر — يراه أصدقاؤك يوماً ثم يذهب.",
  "feature.circle.title": "الدائرة",
  "feature.circle.body": "مئةٌ وخمسون صديقاً سقفاً لا يُباع. بلا متابعين، وبلا غرباء.",
  "feature.chat.title": "المحادثات",
  "feature.chat.body": "نصّ وصورة وصوت، بإيصالٍ يقول وصلت وقُرئت — وتُكنس بعد شهر.",
  "feature.notes.title": "النوت",
  "feature.notes.body": "عبارةٌ أو أغنية فوق صورتك في شريط القصص — تعيش يوماً، ويراها من تختار.",
  "feature.store.title": "المتجر",
  "feature.store.body": "إطاراتٌ وتشارمز وثيمات، وأثوابٌ للمعرض وتصاميمُ لكتابك، وملصقات — بسعرٍ واضح، بلا صناديق عشوائية.",
  "feature.book.title": "كتاب سنتك",
  "feature.book.body": "لحظاتك يوماً بيوم، يرويها الكتاب بلسانك — تصمّمه وتحمّله PDF، وتمشي بينها في المعرض.",
  "feature.plus.title": "آثار+",
  "feature.plus.body": "شارة التوثيق، وأرشيفٌ بلا نهاية، والملصقات، وتصميم كتابك، ووضع التخفّي، و١٠٠٠ نقطة كل شهر — وأصدقاؤك يبقون ١٥٠.",

  // ── الجديد (القاعدة ٤١٥) ──
  "new.title": "آثار تكبر معك",
  "new.sub": "ستّ مزايا جديدة — كلُّها داخل دائرتك، لا خارجها.",
  "new.nearby.title": "من حولك",
  "new.nearby.body": "صديقٌ جديد على طاولتك؟ افتحا «من حولك» فيظهر كلٌّ منكما للآخر بالبلوتوث والموقع — أو ابحث بمعرّفه، أو امسح رمزك.",
  "new.map.title": "خريطتي",
  "new.map.body": "كل لحظةٍ نشرتها على خريطتك: دولٌ ومدنٌ وأماكن، وصورةُ كلّ مدينة وذكرياتك فيها. لك وحدك.",
  "new.gallery.title": "المعرض",
  "new.gallery.body": "لحظاتُ سنتك لوحاتٌ على جدار، تمشي بينها بإصبعك شهراً شهراً — وتلبس القاعةُ ثوباً تختاره من المتجر.",
  "new.book.title": "صمّم كتابك",
  "new.book.body": "كتابُ سنتك يرويه بلسانك: اختر غلافه وعنوانه وإهداءه وترتيب فصوله، ثمّ حمّله PDF.",
  "new.stickers.title": "الملصقات",
  "new.stickers.body": "مجموعاتٌ ترسلها في التعليقات والمحادثات — مع آثار+، أو تُشترى بالنقاط وتُهدى لصديق.",
  "new.memories.title": "ذكريات ومناسبات",
  "new.memories.body": "«في مثل هذا اليوم»، وذكرى صداقتكم، وملخّص أسبوعك كل جمعة، وتقويمٌ بمناسبات بلدك.",

  // ── ماذا تنشر ──
  "post.title": "ماذا تنشر في آثار",
  "post.sub": "سطرٌ صغير يقول أين أنت اليوم — والجهاز يعرف أغلبه قبل أن تكتبه.",
  "post.write.title": "لحظة",
  "post.write.tags": "٢٥٠ حرفاً\nذكرى\nلمن تختار",
  "post.photo.title": "كاميرا",
  "post.photo.tags": "حتى خمس صور\nقصة يوم\nفلاتر",
  "post.music.title": "موسيقى",
  "post.music.tags": "ما تسمعه الآن\nنوت فوق صورتك\nموسيقى القصة",
  "post.place.title": "موقع",
  "post.place.tags": "من حولك\nمع مين؟\nمن كان هنا",
  "post.sleep.title": "نوم",
  "post.sleep.tags": "لحظة بلا نص\nتصبحون على خير",
  "post.wake.title": "صحيت",
  "post.wake.tags": "ساعتها خبرها\nصباح الخير",

  // ── ليش آثار ──
  "why.title": "ليش آثار؟",
  "why.sub": "شبكةٌ صغيرة بقرار، لا لأنّها لم تكبر بعد.",
  "why.stamp": "دائرة · ١٥٠ · لا تُباع · ",

  // ── التفاعلات ──
  "react.badge": "مفتوحة للجميع",
  "react.title": "تفاعل بوجه، وعلّق بكلمة",
  "react.body": "ثمانية تفاعلات على كل لحظة، ومع كل تفاعل صورةُ صاحبه — في دائرةٍ صغيرة، السؤال الأوّل دائماً: مَن؟",

  // ── من داخل التطبيق ──
  "shots.title": "من داخل التطبيق",
  "shots.sub": "الشاشات كما هي — بلا تجميلٍ لا تراه حين تفتحه.",

  // ── الخصوصية ──
  "privacy.title": "خصوصيةٌ أولاً.",
  "privacy.body":
    "ليست وعداً في صفحة، بل قرارٌ في البناء: لا استكشاف ولا اقتراحاتِ غرباء، ولا يصل إليك أحدٌ إلا بمعرّفك أو رمزك أو وأنتما في المكان نفسه، ولا طرفٌ ثالثٌ يقرأ ما تنشره.",
  "privacy.no": "لا نبيع بياناتك\nلا نتبعك خارج التطبيق\nلا نعرض إعلانات",
  "privacy.yes": "دائرة محدودة — ١٥٠ صديقاً\nأنت من يقرّر من يرى ماذا\nلا متابعين، ولا عدّاد إعجابات",

  // ── التحميل ──
  "download.title": "جاهزٌ للانطلاق؟",
  "download.body":
    "حمّل آثار مومنتس من متجر جهازك، وابدأ دائرتك مع ناسك.",
  "download.cta": "اكتب لنا",
  /*
    روابطُ المتجرين تُلصق من اللوحة (قسم «روابط تحميل التطبيق») بلا نسخةٍ
    جديدة من الموقع، ولا يُقبل إلا `https://`. وفارغُها زرٌّ بلا رابط —
    **بلا «قريباً» بقرار المالك**: التطبيقُ في المتجر، وكلمةٌ تقول غير ذلك
    تُقرأ خطأً.
  */
  "store.ios": "",
  "store.android": "",

  /*
    حسابُ الدعم والأخبار (القاعدة ٢٢١): رقمُ عضويّته تحيل إليه نماذجُ
    التواصل في الموقع والتطبيق. رقمٌ في اللوحة لا في الكود (القاعدة ٣٢ب).
  */
  "support.member": "1",

  // ── الذيل ──
  "foot.tagline": "لحظاتك، مع ناسك.",
  "foot.follow": "تابعنا",
  "foot.rights": "© ٢٠٢٦ آثار مومنتس. جميع الحقوق محفوظة.",
} as const;

export type SiteKey = keyof typeof SITE_TEXT;

/**
 * تُقرأ مرّةً لكل طلب: التخطيط يقرأ الذيل والصفحة تقرأ متنها — وبلا
 * `cache` لصارا استعلامين على الجدول نفسه في الطلب الواحد.
 */
export const siteText = cache(async function siteText(): Promise<Record<SiteKey, string>> {
  const rows = await prisma.siteText.findMany().catch(() => []);
  const out = { ...SITE_TEXT } as Record<SiteKey, string>;
  for (const row of rows) {
    if (row.key in out) out[row.key as SiteKey] = row.value;
  }
  return out;
});

/** رابطُ متجرٍ صالح أو لا شيء: حقلٌ حرّ لا يُرسم منه `javascript:`. */
export const storeUrl = (value: string): string | null =>
  /^https:\/\/[^\s]+$/.test(value.trim()) ? value.trim() : null;

/** سطورٌ من حقلٍ واحد: القائمة تُحرَّر نصّاً بسطرٍ لكل بند. */
export const lines = (value: string): string[] =>
  value.split("\n").map((line) => line.trim()).filter(Boolean);

/**
 * صورةٌ عامّة بمفتاحها — `null` يعني «ارسم الافتراضيّ».
 *
 * وفشلُ القراءة `null` كذلك، كأختيها: صفحةُ الهبوط تُرسم برأسٍ مرسوم
 * ببطاقتها وحدها إن لم تكن هناك صورة، وهذا خيرٌ من أن يسقط الموقع كلّه
 * لأنّ القاعدة تأخّرت لحظة.
 */
export const siteImage = cache(async function siteImage(key: string): Promise<string | null> {
  const row = await prisma.siteImage
    .findUnique({ where: { key }, select: { mediaId: true } })
    .catch(() => null);
  return row?.mediaId ?? null;
});

/** الروابط الظاهرة، مرتّبة — للموقع وللتطبيق سواء. */
export const socialLinks = cache(async function socialLinks() {
  return prisma.socialLink
    .findMany({ where: { hidden: false }, orderBy: { sortOrder: "asc" } })
    .catch(() => []);
});

/**
 * لقطاتُ «من داخل التطبيق» الظاهرة، مرتّبة. وبلا صفٍّ واحد — قاعدةٌ جديدة
 * أو قبل أن يرفع المشرف شيئاً — اللقطاتُ الثلاث المحفوظة مع الكود.
 * والصورةُ من البابِ العامّ لصور الموقع (`/api/site-media`) لا من
 * `/api/media` الذي يشترط جلسة: زائرُ الهبوط لا جلسةَ له.
 */
export type Shot = { id: string; label: string; src: string };

export const DEFAULT_SHOTS: Shot[] = [
  { id: "timeline", label: "الخط الزمني", src: "/shots/timeline.webp" },
  { id: "circle", label: "الدائرة", src: "/shots/circle.webp" },
  { id: "profile", label: "الملف الشخصي", src: "/shots/profile.webp" },
];

export const siteShots = cache(async function siteShots(): Promise<Shot[]> {
  const rows = await prisma.siteShot
    .findMany({
      where: { hidden: false },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, label: true, mediaId: true },
    })
    .catch(() => []);
  if (rows.length === 0) return DEFAULT_SHOTS;
  return rows.map((row) => ({ id: row.id, label: row.label, src: `/api/site-media/${row.mediaId}` }));
});
