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
  "hero.line": "بعض اللحظات تستحق أن تبقى.",
  "hero.latin": "Some moments deserve to stay.",
  "hero.body":
    "آثار مومنتس هو المكان الهادئ الذي تجمع فيه لحظاتك، وتشاركها مع ناسك، وتعود إليها كلما احتجت أن تتذكّر ما يجمعكم.",

  // ── المزايا ──
  "features.title": "ما الذي في آثار مومنتس",
  "features.sub": "أربعة أشياء تُفعل كل يوم — ولا خامس يزاحمها.",
  "feature.moments.title": "اللحظات",
  "feature.moments.body": "صورة، فكرة، مكان، أغنية — سطرٌ صغير يقول أين أنت اليوم.",
  "feature.stories.title": "القصص",
  "feature.stories.body": "صورة أو فيديو يراه أصدقاؤك يوماً ثم يذهب — لا يدخل الخط الزمني.",
  "feature.circle.title": "الدائرة",
  "feature.circle.body": "مئةٌ وخمسون صديقاً سقفاً لا يُباع. بلا متابعين، وبلا غرباء.",
  "feature.chat.title": "المحادثات",
  "feature.chat.body": "نصّ وصورة وصوت، بإيصالٍ يقول وصلت وقُرئت — وتُكنس بعد شهر.",

  // ── من داخل التطبيق ──
  "shots.title": "من داخل التطبيق",
  "shots.sub": "الشاشات كما هي — بلا تجميلٍ لا تراه حين تفتحه.",

  // ── الخصوصية ──
  "privacy.title": "خصوصيةٌ أولاً.",
  "privacy.body":
    "ليست وعداً في صفحة، بل قرارٌ في البناء: لا استكشاف، ولا بحثَ يصل إليك، ولا طرفٍ ثالثٍ يقرأ ما تنشره.",
  "privacy.no": "لا نبيع بياناتك\nلا نتبعك خارج التطبيق\nلا نعرض إعلانات",
  "privacy.yes": "دائرة محدودة — ١٥٠ صديقاً\nأنت من يقرّر من يرى ماذا\nلا متابعين، ولا عدّاد إعجابات",

  // ── التحميل ──
  "download.title": "جاهزٌ للانطلاق؟",
  "download.body":
    "آثار مومنتس يصل المتجرين قريباً. وحتى ذلك الحين، اكتب لنا إن أردت أن تكون من أوّل من يجرّبه.",
  "download.cta": "اكتب لنا",

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

/** سطورٌ من حقلٍ واحد: القائمة تُحرَّر نصّاً بسطرٍ لكل بند. */
export const lines = (value: string): string[] =>
  value.split("\n").map((line) => line.trim()).filter(Boolean);

/**
 * صورةٌ عامّة بمفتاحها — `null` يعني «ارسم الافتراضيّ».
 *
 * وفشلُ القراءة `null` كذلك، كأختيها: صفحةُ الهبوط تُرسم برأسٍ مرسوم
 * (`HeroArt`) إن لم تكن هناك صورة، وهذا خيرٌ من أن يسقط الموقع كلّه
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
