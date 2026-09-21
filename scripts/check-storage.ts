/**
 * أسليمٌ الاتصالُ بالدلو؟
 *
 * `probeBucket` يكتب كائناً صغيراً ثمّ يقرؤه ثمّ يحذفه — فلا يقول
 * «المفاتيحُ موجودة» بل «الكتابةُ والقراءةُ تمّتا». والفرقُ بينهما هو
 * كلُّ ما يهمّ: مفتاحٌ مضبوطٌ بلا صلاحيةِ كتابةٍ على الدلو يجتاز الأوّل
 * ويسقط في الثاني.
 *
 * ولا يطبع سرّاً: طولُ المفتاح وأوّلُ حروفه يكفيان لمعرفة أوقع فيه
 * فراغٌ أو سطرٌ زائد، وهما أكثرُ ما يفسد اللصق.
 */
/*
  والبيئةُ تُقرأ من الغلاف لا من مكتبةٍ تُضاف:
    set -a && . ./.env && set +a && npx tsx scripts/check-storage.ts
  وهو النمط نفسه الذي يُشغَّل به `migrate-from-render.sh` و`deploy.sh`.
*/
import { probeBucket, cloudReady } from "../src/lib/r2";

const show = (name: string) => {
  const value = process.env[name] ?? "";
  if (!value) return `${name.padEnd(24)} — فارغ`;
  const clean = value === value.trim() ? "" : "  ⚠ فيه فراغٌ في طرفه";
  return `${name.padEnd(24)} ${String(value.length).padStart(3)} حرفاً · يبدأ بـ${value.slice(0, 4)}…${clean}`;
};

console.log("─── ما في البيئة ───");
for (const name of ["R2_ACCOUNT_ID", "R2_BUCKET", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_ENDPOINT"]) {
  console.log("  " + show(name));
}

const account = process.env.R2_ACCOUNT_ID;
console.log(
  "\n  العنوان: " +
    (process.env.R2_ENDPOINT || (account ? `https://${account}.r2.cloudflarestorage.com` : "— لا رقمَ حساب")),
);

if (!cloudReady()) {
  console.log("\n✗ ناقصٌ واحدٌ ممّا فوق على الأقلّ — فالملفّات تُكتب في القاعدة لا في السحابة.");
  process.exit(1);
}

console.log("\n─── كتابةٌ ثمّ قراءةٌ ثمّ حذف ───");
probeBucket().then((result) => {
  console.log(result.ok ? `✓ ${result.detail}` : `✗ ${result.detail}`);
  process.exit(result.ok ? 0 : 1);
});
