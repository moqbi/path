import { prisma } from "@athar/db";
import { push } from "./push";

/**
 * جرسُ النقاط الممنوحة (القاعدة ١٩٨).
 *
 * المنحُ يجري من اللوحة — مشروعٌ آخر بلا خدمة التنبيهات — كجديد المتجر
 * (القاعدة ١٧٧). فكنسُ الخادم يلتقط ما لم يُختم، ويختمه **قبل** الإرسال بشرط
 * «لم يُختم» فلا يُقرع الجرسُ مرّتين وإن تزامن كنسان.
 */
export async function pushCoinGrants(limit = 300): Promise<number> {
  const rows = await prisma.coinGrant.findMany({
    where: { pushedAt: null },
    select: { id: true, userId: true, coins: true, note: true },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  if (rows.length === 0) return 0;

  const stamp = await prisma.coinGrant.updateMany({
    where: { id: { in: rows.map((row) => row.id) }, pushedAt: null },
    data: { pushedAt: new Date() },
  });
  if (stamp.count === 0) return 0;

  for (const row of rows) {
    await push({
      userId: row.userId,
      kind: "GRANT",
      title: "لأنك تستحق!",
      body: `تمّ منحك ${row.coins.toLocaleString("ar-SA")} نقطة من قبل الإدارة${row.note ? ` — ${row.note}` : ""}`,
      path: "/store",
    });
  }
  return rows.length;
}
