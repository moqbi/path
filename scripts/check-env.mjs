/**
 * فحص المتغيّرات قبل الإقلاع.
 *
 * بدونه يفشل `prisma migrate deploy` برسالة P1013 «الصيغة غير معروفة»،
 * وهي نفسها سواء كان المتغيّر مفقوداً أو مُلصقاً خطأً — فلا تدل على السبب.
 * هنا نفصل الحالتين ونطبع ما يكفي للتشخيص دون كشف كلمة المرور: البادئة
 * قبل :// والطول فقط.
 */
const problems = [];

const url = process.env.DATABASE_URL;
if (!url) {
  problems.push(
    "DATABASE_URL غير موجود إطلاقاً.\n" +
      "     في ريندر: الخدمة ← Environment ← Add Environment Variable،\n" +
      "     المفتاح DATABASE_URL، ثم Add from database ← athar-db ← Internal.",
  );
} else {
  const scheme = url.includes("://") ? url.slice(0, url.indexOf("://")) : null;
  console.log(
    `DATABASE_URL: موجود · الطول ${url.length} · البادئة ${scheme ? `"${scheme}"` : "(بلا :// إطلاقاً)"}`,
  );

  if (scheme !== "postgresql" && scheme !== "postgres") {
    problems.push(
      `DATABASE_URL لا يبدأ بـ postgresql:// أو postgres://.\n` +
        "     الغالب أنك نسخت حقل PSQL Command أو Hostname بدل رابط الاتصال.\n" +
        "     المطلوب حقل Internal Database URL من صفحة athar-db،\n" +
        "     ويبدأ بـ postgresql:// وينتهي باسم القاعدة.",
    );
  }
}

if (!process.env.AUTH_SECRET) {
  problems.push("AUTH_SECRET غير موجود — الجلسات لن تُوقَّع.");
}

/*
 * تخزين الملفات: السحابة إن ضُبطت مفاتيحها، وإلا القاعدة.
 * يُطبع ليُعرف أين تذهب الصور والأصوات قبل أن يُسأل عنها بعد شهر.
 */
const cloud = ["R2_ACCOUNT_ID", "R2_BUCKET", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"];
const missing = cloud.filter((name) => !process.env[name]);
console.log(
  missing.length === 0
    ? "تخزين الملفات: Cloudflare R2"
    : `تخزين الملفات: القاعدة (ينقص ${missing.join("، ")})`,
);

if (problems.length > 0) {
  console.error("\n✗ الإقلاع متوقف. السبب:\n");
  for (const problem of problems) console.error(`  ــ ${problem}\n`);
  process.exit(1);
}

console.log("✓ المتغيّرات سليمة.\n");
