/**
 * يُنفَّذ مرّةً عند إقلاع اللوحة.
 *
 * حالة التخزين تُطبع لا تُخمَّن: «مربوطة» أو «في القاعدة» يقولها السجلّ
 * في السطر الأول، فلا يُكتشف أنّ المفاتيح ناقصة بعد أن يرفع المشرف صورة
 * ثيم.
 *
 * وهو ملفٌّ لازمٌ هنا ولو كان نسخةً: بلا نسخةٍ في `apps/web` يصعد الإطار
 * إلى جذر المستودع فيلتقط `src/instrumentation.ts` الويب الحالي ويبنيه
 * بمساراتٍ تُحلّ داخل `apps/web` — فيسقط البناء على وحدةٍ لا وجود لها.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { cloudReady } = await import("@athar/storage");
  const bucket = process.env.R2_BUCKET;
  console.log(
    cloudReady()
      ? `آثار · اللوحة · التخزين: Cloudflare R2 · الدلو ${bucket}`
      : "آثار · اللوحة · التخزين: القاعدة — مفاتيح R2 غير مضبوطة",
  );
}
