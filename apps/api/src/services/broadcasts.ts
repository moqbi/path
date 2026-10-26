import { prisma } from "@athar/db";
import { broadcast } from "./push";

/**
 * تنبيهاتُ المشرف لكلّ مستخدم (القاعدة ٣٦٣).
 *
 * تُكتب من اللوحة — مشروعٌ آخر بلا خدمة التنبيهات — فكنسُ الخادم يلتقط ما لم
 * يُختم، ويختمه **قبل** الإرسال بشرط «لم يُختم» فلا يُرسل مرّتين وإن تزامن
 * كنسان (كجديد المتجر — القاعدة ١٧٧).
 *
 * **والمسارُ «/» والمعرّفُ معه** لا `/broadcast/<id>`: جوّالٌ لا يعرف البطاقة
 * يفتح الخطَّ الزمنيّ بالضغطة، ولا يُرمى إلى «غير موجود».
 */
export async function sendBroadcasts(): Promise<number> {
  const rows = await prisma.broadcast.findMany({
    where: { pushedAt: null },
    select: { id: true, title: true, body: true },
    orderBy: { createdAt: "asc" },
    take: 5,
  });
  let sent = 0;
  for (const row of rows) {
    const stamp = await prisma.broadcast.updateMany({
      where: { id: row.id, pushedAt: null },
      data: { pushedAt: new Date() },
    });
    if (stamp.count === 0) continue;
    const count = await broadcast("NEWS", row.title, row.body, "/", undefined, { broadcast: row.id });
    await prisma.broadcast.update({ where: { id: row.id }, data: { sentCount: count } });
    console.log(`[تنبيه المشرف] ${row.id} ← ${count} جهاز`);
    sent += count;
  }
  return sent;
}

/** بطاقةُ التنبيه — لكلّ من دخل: ما يُقال للجميع لا يُحجب عن أحد. */
export function broadcastCard(id: string) {
  return prisma.broadcast.findFirst({
    where: { id, pushedAt: { not: null } },
    select: { id: true, cardTitle: true, cardBody: true, mediaId: true, createdAt: true },
  });
}
