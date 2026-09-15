/**
 * يُنفَّذ مرّةً عند إقلاع الخادم.
 *
 * حالة التخزين تُطبع هنا لا تُخمَّن: «مربوطة» أو «في القاعدة» يقولها
 * السجلّ في السطر الأول، فلا يُكتشف أنّ المفاتيح ناقصة بعد أن يرفع
 * مستخدمٌ صورة.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { cloudReady } = await import("@/lib/r2");
  const bucket = process.env.R2_BUCKET;
  console.log(
    cloudReady()
      ? `آثار · التخزين: Cloudflare R2 · الدلو ${bucket}`
      : "آثار · التخزين: القاعدة — مفاتيح R2 غير مضبوطة",
  );
}
