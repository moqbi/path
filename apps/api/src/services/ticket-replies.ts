import { prisma } from "@athar/db";
import { push } from "./push";

/**
 * جرسُ ردّ الموظّف على التذكرة (القاعدة ٤٨٠).
 *
 * الردُّ يُكتب من اللوحة — مشروعٌ آخر بلا خدمة التنبيهات — كمنح النقاط (القاعدة ١٩٨).
 * فكنسُ الخادم يلتقط ما لم يُختم من ردود الموظّفين ويختمه **قبل** الإرسال بشرط «لم
 * يُختم» فلا يُقرع مرّتين. وما مضى عليه يومٌ يُختم بلا جرس: خبرٌ قديم لا يوقظ أحداً.
 */
export async function pushTicketReplies(limit = 200): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60_000);
  await prisma.ticketMessage.updateMany({
    where: { fromStaff: true, pushedAt: null, createdAt: { lt: since } },
    data: { pushedAt: new Date() },
  });

  const rows = await prisma.ticketMessage.findMany({
    where: { fromStaff: true, pushedAt: null },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true, body: true, ticket: { select: { id: true, number: true, userId: true } } },
  });
  if (rows.length === 0) return 0;

  const stamp = await prisma.ticketMessage.updateMany({
    where: { id: { in: rows.map((row) => row.id) }, pushedAt: null },
    data: { pushedAt: new Date() },
  });
  if (stamp.count === 0) return 0;

  for (const row of rows) {
    // تذكرةُ الموقع بلا حساب يصلها الردُّ بريداً وحده.
    if (!row.ticket.userId) continue;
    await push({
      userId: row.ticket.userId,
      kind: "SUPPORT",
      title: `ردّ جديد على طلبك رقم ${row.ticket.number.toLocaleString("ar-SA")}`,
      body: row.body.length > 140 ? `${row.body.slice(0, 140)}…` : row.body,
      path: `/settings/support?ticket=${row.ticket.id}`,
    });
  }
  return rows.length;
}
