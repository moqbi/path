/**
 * تصفيرُ الفوترة التجريبيّة قبل الدفع الحقيقيّ — **بقرار المالك**.
 *
 * ما جرى قبل الإطلاق كان تجربةً: اشتراكاتٌ من متجر آبل التجريبيّ ومنحٌ من
 * اللوحة، ونقاطٌ من شحنٍ تجريبيّ، وأصنافٌ اشتُريت بتلك النقاط. فيبدأ الجميع
 * من الصفر:
 *
 *   - آثار+ ينتهي لكلّ أحد — شراءً كان أو منحاً — بـ`endPlus` نفسها، فتُثبَّت
 *     الصورةُ المتحرّكة كما تُثبَّت عند أيّ انتهاء (القاعدة ١٤٩). ولا تُعرض
 *     «انتهى اشتراكك»: لم يدفع أحدٌ شيئاً ليُقال له «جدّد».
 *   - الرصيدُ صفر، وسجلّا الشحن والمنح يُمحيان — وإلّا بقي «لأنك تستحق!»
 *     في الإشعارات لنقاطٍ لم تعد عنده.
 *   - كلُّ صنفٍ مملوكٍ يُسحب، وما يُلبَس منه يُنزع، وغلافُ الثيم يذهب
 *     ببكسلاته (القاعدتان ١٠٤ و١٩٣). وما رفعه صاحبُه بيده من غلافٍ يبقى.
 *
 * ولا يُمسّ: الحسابات، واللحظات (ومنها أسطرُ الهدايا القديمة)، والأصدقاء،
 * والمتجرُ نفسه وباقاتُه، و`BillingEvent` — سجلُّ الأحداث المعالجة الذي يمنع
 * أن يُطبَّق حدثٌ مرّتين.
 *
 * التشغيل على الخادم من جذر المستودع:
 *
 *   set -a; . ./.env; set +a
 *   cd apps/api && npx tsx scripts/reset-billing.ts          # معاينة: يعدّ ولا يكتب
 *   cd apps/api && npx tsx scripts/reset-billing.ts --apply  # التنفيذ
 *
 * وقبل `--apply` نسخةٌ احتياطيّة: `scripts/ops/backup-db.sh`. لا رجعةَ فيه.
 *
 * **والقاعدةُ لا تعرف التجريبيّ من الحقيقيّ**: `BillingEvent` و`CoinTopUp` لا
 * يحفظان بيئة الحدث. فمن اشترى بمالٍ حقيقيّ بعد النشر يُستثنى برقم عضويّته
 * (`--keep=12,40`) — والمرجعُ لوحة RevenueCat بفلتر Production لا هذا السكربت.
 * ويُطفأ `ALLOW_SANDBOX_BILLING` **قبل** التشغيل، فلا يدخل بعده إلا حقيقيّ.
 */
import { prisma } from "@athar/db";
import { endPlus } from "../src/services/plus";
import { dropMedia } from "../src/services/media";

const apply = process.argv.includes("--apply");

/** أرقامُ عضويّة من اشتروا بمالٍ حقيقيّ — لا يُمسّ منهم شيء. */
const keep = (process.argv.find((arg) => arg.startsWith("--keep="))?.slice(7) ?? "")
  .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
  .split(/[\s,،]+/)
  .filter((part) => /^\d+$/.test(part))
  .map(Number);

async function main() {
  const kept = await prisma.user.findMany({ where: { memberNo: { in: keep } }, select: { id: true, memberNo: true } });
  const missing = keep.filter((no) => !kept.some((row) => row.memberNo === no));
  if (missing.length > 0) {
    console.error(`✗ لا حساب بالرقم: ${missing.join("، ")} — صحّح --keep ثمّ أعد`);
    process.exitCode = 1;
    return;
  }
  const keptIds = kept.map((row) => row.id);
  const others = { id: { notIn: keptIds } };
  const ownedByOthers = { userId: { notIn: keptIds } };

  const plusUsers = await prisma.user.findMany({
    where: { ...others, OR: [{ isPlus: true }, { plusUntil: { not: null } }, { plusCreditAt: { not: null } }] },
    select: { id: true },
  });
  const themedCovers = await prisma.user.findMany({
    where: { ...others, coverItemId: { not: null } },
    select: { id: true, coverMediaId: true },
  });
  const [withCoins, purchases, topUps, grants, wearing] = await Promise.all([
    prisma.user.count({ where: { ...others, coins: { not: 0 } } }),
    prisma.purchase.count({ where: ownedByOthers }),
    prisma.coinTopUp.count({ where: ownedByOthers }),
    prisma.coinGrant.count({ where: ownedByOthers }),
    prisma.user.count({
      where: { ...others, OR: [{ frameId: { not: null } }, { charmId: { not: null } }, { backgroundId: { not: null } }] },
    }),
  ]);

  console.log(apply ? "▸ تنفيذ" : "▸ معاينة — لا يُكتب شيء (أضف --apply للتنفيذ)");
  if (kept.length > 0) console.log(`  مستثنون (--keep):          ${kept.map((row) => `#${row.memberNo}`).join(" ")}`);
  console.log(`  اشتراكات آثار+ تنتهي:      ${plusUsers.length}`);
  console.log(`  أرصدة نقاط تُصفَّر:         ${withCoins}`);
  console.log(`  أصناف مملوكة تُسحب:        ${purchases}`);
  console.log(`  حسابات يُنزع ما تلبسه:      ${wearing}`);
  console.log(`  أغلفة ثيمات تُزال:          ${themedCovers.length}`);
  console.log(`  سجلّ شحن نقاط يُمحى:        ${topUps}`);
  console.log(`  سجلّ منح نقاط يُمحى:        ${grants}`);

  if (!apply) return;

  // الانتهاءُ أوّلاً وحسابٌ حسابٌ: تثبيتُ الصورة المتحرّكة يقرأ الملفّ ويكتب
  // غيره، فلا يجتمع في معاملة. وفشلُ واحدٍ لا يوقف الباقي.
  let ended = 0;
  for (const user of plusUsers) {
    try {
      await endPlus(user.id);
      ended += 1;
    } catch (error) {
      console.error(`✗ إنهاء آثار+ لـ${user.id}`, error);
    }
  }

  await prisma.$transaction([
    prisma.purchase.deleteMany({ where: ownedByOthers }),
    prisma.coinTopUp.deleteMany({ where: ownedByOthers }),
    prisma.coinGrant.deleteMany({ where: ownedByOthers }),
    prisma.user.updateMany({
      where: others,
      data: {
        isPlus: false,
        plusUntil: null,
        plusCreditAt: null,
        plusEndedAt: null,
        coins: 0,
        frameId: null,
        charmId: null,
        backgroundId: null,
      },
    }),
    prisma.user.updateMany({
      where: { ...others, coverItemId: { not: null } },
      data: { coverMediaId: null, coverItemId: null, coverY: 50, coverX: 50, coverZoom: 100 },
    }),
  ]);

  // البكسلاتُ بعد الصفوف: ملفٌّ لم يُحذف أهونُ من غلافٍ يشير إلى ملفٍّ ذهب.
  const covers = themedCovers.map((row) => row.coverMediaId).filter((id): id is string => Boolean(id));
  if (covers.length > 0) await dropMedia(covers).catch((error) => console.error("✗ حذف أغلفة الثيمات", error));

  console.log(`✓ تمّ — انتهى آثار+ لـ${ended} من ${plusUsers.length}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
