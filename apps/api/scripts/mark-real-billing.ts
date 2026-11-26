/**
 * ما سبق تمييزَ الاختبار (القاعدة ٤٩١) يُعلَّم حقيقيّاً من تاريخٍ يختاره المالك.
 *
 * `BillingEvent.sandbox` و`CoinTopUp.sandbox` فارغان لكلّ ما وصل قبل الحقل، والتحليلاتُ
 * لا تعدّ الفارغ — فخرجت أقسامُ آثار+ والنقاط أصفاراً وفي RevenueCat مشترياتٌ حقيقيّة.
 * والقاعدةُ وحدها لا تفرّق: لا بيئةَ محفوظة لما سبق. فالمرجعُ لوحةُ RevenueCat بفلتر
 * Production، ومنها يُعرف يومُ أوّل شراءٍ حقيقيّ — وما بعده في الإنتاج حقيقيٌّ ما دام
 * `ALLOW_SANDBOX_BILLING` مطفأً (حدثُ الاختبار يُهمل ولا يُكتب).
 *
 * التشغيل على الخادم من جذر المستودع:
 *
 *   set -a; . ./.env; set +a
 *   cd apps/api && npx tsx scripts/mark-real-billing.ts                          # معاينة بالأيّام
 *   cd apps/api && npx tsx scripts/mark-real-billing.ts --from=2026-11-10 --apply # التعليم
 *
 * `--from` يومٌ بتوقيت الرياض. ما قبله يبقى فارغاً (لا يُعدّ)، ولا يُمسّ ما عُلّم من قبل.
 *
 * ومشترياتُ تجربةٍ بأعيان أصحابها (مشرفٌ اشترى من TestFlight) تُعلَّم اختباراً:
 *
 *   npx tsx scripts/mark-real-billing.ts --test=2,22 --from=2026-11-04          # معاينة
 *   npx tsx scripts/mark-real-billing.ts --test=2,22 --from=2026-11-04 --apply  # التعليم
 *
 * أرقامُ عضويّة، وكلُّ ما لهم من `--from` يصير `sandbox = true` ولو عُلّم حقيقيّاً قبلُ.
 */
import { prisma } from "@athar/db";

const apply = process.argv.includes("--apply");
const fromArg = process.argv.find((arg) => arg.startsWith("--from="))?.slice(7);
const testArg = process.argv.find((arg) => arg.startsWith("--test="))?.slice(7);
const OFFSET = 3 * 60 * 60 * 1000;

function fromDate(raw: string | undefined): Date | null {
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new Error("--from بصيغة YYYY-MM-DD");
  return new Date(new Date(`${raw}T00:00:00Z`).getTime() - OFFSET);
}

const day = (when: Date) => new Date(when.getTime() + OFFSET).toISOString().slice(0, 10);

async function markTest(members: number[], from: Date) {
  const users = await prisma.user.findMany({
    where: { memberNo: { in: members } },
    select: { id: true, memberNo: true },
  });
  const ids = users.map((u) => u.id);
  const [events, topUps] = await Promise.all([
    prisma.billingEvent.findMany({
      where: { appUserId: { in: ids }, at: { gte: from } },
      orderBy: { at: "asc" },
      select: { id: true, type: true, at: true, appUserId: true, sandbox: true },
    }),
    prisma.coinTopUp.findMany({
      where: { userId: { in: ids }, createdAt: { gte: from } },
      orderBy: { createdAt: "asc" },
      select: { id: true, coins: true, createdAt: true, userId: true, sandbox: true },
    }),
  ]);
  const no = new Map(users.map((u) => [u.id, u.memberNo]));
  const state = (v: boolean | null) => (v === null ? "بلا تمييز" : v ? "اختبار" : "حقيقي");
  for (const e of events) console.log(`${day(e.at)}  ${e.type} · عضوية ${no.get(e.appUserId)} · ${state(e.sandbox)}`);
  for (const t of topUps) console.log(`${day(t.createdAt)}  نقاط ${t.coins} · عضوية ${no.get(t.userId)} · ${state(t.sandbox)}`);
  console.log(`\nتصير اختباراً: ${events.length} حدث و${topUps.length} شراء نقاط`);
  if (!apply) {
    console.log("معاينة — أضف --apply للتعليم.");
    return;
  }
  await prisma.$transaction([
    prisma.billingEvent.updateMany({ where: { id: { in: events.map((e) => e.id) } }, data: { sandbox: true } }),
    prisma.coinTopUp.updateMany({ where: { id: { in: topUps.map((t) => t.id) } }, data: { sandbox: true } }),
  ]);
  console.log("تمّ.");
}

async function main() {
  const from = fromDate(fromArg);
  if (testArg !== undefined) {
    const members = testArg
      .split(",")
      .map((part) => Number(part.trim()))
      .filter((n) => Number.isInteger(n) && n > 0);
    if (!members.length || !from) throw new Error("--test=2,22 مع --from=YYYY-MM-DD");
    return markTest(members, from);
  }

  const [events, topUps] = await Promise.all([
    prisma.billingEvent.findMany({
      where: { sandbox: null },
      orderBy: { at: "asc" },
      select: { id: true, type: true, at: true, appUserId: true },
    }),
    prisma.coinTopUp.findMany({
      where: { sandbox: null, source: "STORE" },
      orderBy: { createdAt: "asc" },
      select: { id: true, coins: true, createdAt: true, userId: true },
    }),
  ]);

  const users = new Map(
    (
      await prisma.user.findMany({
        where: { id: { in: [...new Set([...events.map((e) => e.appUserId), ...topUps.map((t) => t.userId)])] } },
        select: { id: true, memberNo: true },
      })
    ).map((u) => [u.id, u.memberNo]),
  );

  const byDay = new Map<string, string[]>();
  const add = (key: string, line: string) => byDay.set(key, [...(byDay.get(key) ?? []), line]);
  for (const e of events) add(day(e.at), `${e.type} · عضوية ${users.get(e.appUserId) ?? "؟"}`);
  for (const t of topUps) add(day(t.createdAt), `نقاط ${t.coins} · عضوية ${users.get(t.userId) ?? "؟"}`);

  console.log(`بلا تمييز: ${events.length} حدث اشتراك، و${topUps.length} شراء نقاط\n`);
  for (const key of [...byDay.keys()].sort()) {
    const mark = from && new Date(`${key}T00:00:00Z`).getTime() - OFFSET >= from.getTime() ? "✔" : " ";
    console.log(`${mark} ${key}`);
    for (const line of byDay.get(key)!) console.log(`     ${line}`);
  }

  if (!from) {
    console.log("\nاختر يومَ أوّل شراءٍ حقيقيّ من RevenueCat (Production) ثمّ: --from=YYYY-MM-DD --apply");
    return;
  }
  const eventIds = events.filter((e) => e.at >= from).map((e) => e.id);
  const topUpIds = topUps.filter((t) => t.createdAt >= from).map((t) => t.id);
  console.log(`\nمن ${fromArg}: ${eventIds.length} حدث و${topUpIds.length} شراء نقاط ✔`);
  if (!apply) {
    console.log("معاينة — أضف --apply للتعليم.");
    return;
  }
  await prisma.$transaction([
    prisma.billingEvent.updateMany({ where: { id: { in: eventIds }, sandbox: null }, data: { sandbox: false } }),
    prisma.coinTopUp.updateMany({ where: { id: { in: topUpIds }, sandbox: null }, data: { sandbox: false } }),
  ]);
  console.log("تمّ.");
}

main()
  .catch((problem) => {
    console.error(problem);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
