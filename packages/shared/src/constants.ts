/**
 * الثوابت التي يتقاسمها الخادم والموبايل والويب.
 *
 * مكانٌ واحد لكل رقمٍ يُحكَم به: تكرار «١٥٠» في ثلاثة تطبيقات يعني أن
 * تغييرها يوماً يكسر اثنين منها بصمت.
 */

/** سقف الدائرة. لا يُباع ولا يُرفع باشتراك — هذا قرارُ منتَج لا رقم. */
export const CIRCLE_CAP = 150;

/** حدّ نصّ اللحظة بالحروف. */
export const MOMENT_TEXT_MAX = 250;

/**
 * حدّ النبذة بالحروف. سطرٌ يُقرأ تحت الاسم لا فقرةٌ تُقرأ — وكان ١٦٠
 * فيدفع الاسمَ والإحصاءات إلى أسفل الشاشة في رأسٍ ينكمش أصلاً.
 */
export const BIO_MAX = 100;

/** الرسالة الصوتية بالثواني: للجميع، ولمشتركي آثار+. */
export const VOICE_SECONDS = { free: 20, plus: 120 } as const;

/** القصة: عمرها بالساعات، وأقصى مدّة لفيديوها بالثواني. */
export const STORY_HOURS = 24;
export const STORY_SECONDS = 30;

/** المحادثات تُكنس بعد هذه المدّة — من القاعدة والسحابة معاً. */
export const MESSAGE_KEEP_DAYS = 30;

/** حدود الملفات بالبايت. تُفحص في العميل وتُعاد على الخادم. */
export const LIMITS = {
  image: 1_500_000,
  animated: 3_000_000,
  audio: 2_000_000,
  video: 9_000_000,
} as const;

/**
 * مقاس الصورة المتحركة: من ١٢٠×١٢٠ إلى ٣٢٠×٣٢٠، والحجم كما هو.
 *
 * تُرفع بملفها بلا تصغير (`canvas` يرسم الإطار الأول وحده فيقتل
 * الحركة)، فمقاسُها هو ما يُفكّ في الذاكرة عند كل عرض — وأكبرُ ما
 * تُعرض فيه ١٠٤ بكسلاً. و١٠٢٤×١٠٢٤ بثلاثة ميغا كان يعني مئة إطارٍ
 * تُفكّ لقرصٍ بحجم ظفر.
 */
export const ANIMATED_SIDE = { min: 120, max: 320 } as const;

/** صيغ الملفات المقبولة. */
export const MIME = {
  image: ["image/jpeg", "image/png", "image/webp"],
  animated: ["image/gif", "image/webp"],
  audio: ["audio/webm", "audio/mp4", "audio/ogg", "audio/mpeg", "audio/aac"],
  video: ["video/webm", "video/mp4", "video/quicktime"],
} as const;

/** عمر التوكن: وصولٌ قصير، وتجديدٌ طويل — ومفتاحاهما منفصلان. */
export const TOKEN = { accessMinutes: 15, refreshDays: 30 } as const;

/** فلاتر القصة: الاسم يُحفظ، والقيمة تُطبَّق عند العرض. */
export const STORY_FILTERS = [
  { key: "", name: "بلا", css: "none" },
  { key: "warm", name: "دافئ", css: "sepia(.35) saturate(1.25) contrast(1.03)" },
  { key: "cool", name: "بارد", css: "hue-rotate(-12deg) saturate(1.1) brightness(1.04)" },
  { key: "mono", name: "رمادي", css: "grayscale(1) contrast(1.08)" },
  { key: "vivid", name: "زاهي", css: "saturate(1.5) contrast(1.1)" },
  { key: "fade", name: "باهت", css: "saturate(.75) brightness(1.08) contrast(.92)" },
] as const;

/**
 * آثار+ عبر RevenueCat.
 *
 * الاستحقاق (`entitlement`) اسمٌ واحد يتّفق عليه المتجران والخادم: كل
 * ما يهمّ التطبيقَ هو «أهو مستحقّ آثار+ الآن»، لا أيّ منتجٍ اشترى ولا من
 * أيّ متجر. وتغيير هذا الاسم يعني تغييره في لوحة RevenueCat معه.
 */
export const PLUS_ENTITLEMENT = "athr_pro";

/**
 * النقاط عملةُ المتجر الوحيدة.
 *
 * ما في المتجر يُشترى بها ولا يُشترى شيءٌ بالريال مباشرةً — والاشتراك
 * وحده يبقى بمالٍ حقيقي. والصرف ثابتٌ هنا: ١٠٠٠ نقطة = ٣٠ ر.س، أي
 * نقاطٌ بثلاث هللات. ولا يُكتب هذا الرقم في مكانٍ ثانٍ.
 */
export const COIN_HALALAS = 3;

/** نقاط تُودَع مع كل دورة اشتراك في آثار+. */
export const PLUS_COINS = 1000;

/**
 * عنوان الموقع — يُشارَك به رابط الملف، ومنه تُفتح لوحة التحكم.
 *
 * **لا يُكتب نطاقٌ في الكود**: النطاق لم يُحسم بعد، والمكتوب اليوم يبقى
 * في ملفٍّ منسيٍّ بعد أن يُحسم. فيُقرأ من البيئة باسمه في كل مضيف —
 * `SITE_URL` على الخادم، و`NEXT_PUBLIC_SITE_URL` في الويب، و
 * `EXPO_PUBLIC_SITE_URL` على الجوّال — وفراغُه ليس عطلاً: ما يحتاجه
 * يختفي (زرّ اللوحة، ورابط المشاركة) وما لا يحتاجه يعمل.
 */
export const SITE_URL: string =
  process.env.SITE_URL ??
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.EXPO_PUBLIC_SITE_URL ??
  "";

/** هل يوجد عنوانٌ صالح؟ أقصرُ من `SITE_URL !== ""` في كل موضع. */
export const hasSite = (): boolean => SITE_URL.startsWith("http");
