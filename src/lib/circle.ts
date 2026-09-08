import "server-only";
import { prisma } from "@/lib/db";

/**
 * سقف الدائرة. لا يُشترى ولا يزيد بالاشتراك — هذا قرار منتج، لا رقم إعدادات.
 * كل ما يُباع في «أثر+» يدور حول الذاكرة والتعبير، لا حول توسيع الدائرة.
 */
export const CIRCLE_CAP = 150;

/** معرّفات من في دائرة المستخدم (المقبولون فقط)، بلا المستخدم نفسه. */
export async function circleIds(userId: string): Promise<string[]> {
  const rows = await prisma.friendship.findMany({
    where: {
      status: "ACCEPTED",
      OR: [{ requesterId: userId }, { addresseeId: userId }],
    },
    select: { requesterId: true, addresseeId: true },
  });

  return rows.map((row) =>
    row.requesterId === userId ? row.addresseeId : row.requesterId,
  );
}

export async function circleSize(userId: string): Promise<number> {
  return prisma.friendship.count({
    where: {
      status: "ACCEPTED",
      OR: [{ requesterId: userId }, { addresseeId: userId }],
    },
  });
}

export class CircleFullError extends Error {
  constructor() {
    super(`الدائرة ممتلئة — السقف ${CIRCLE_CAP} ولا يمكن تجاوزه`);
    this.name = "CircleFullError";
  }
}

/**
 * يتحقق أن الطرفين تحت السقف قبل قبول صداقة.
 *
 * الفحص على الطرفين لا على الطالب فقط: قبول الطلب يضيف صفاً واحداً يزيد
 * عدد كليهما، فتجاوز أيٍّ منهما للسقف يجب أن يمنع القبول.
 */
export async function assertRoomForBoth(a: string, b: string): Promise<void> {
  const [sizeA, sizeB] = await Promise.all([circleSize(a), circleSize(b)]);
  if (sizeA >= CIRCLE_CAP || sizeB >= CIRCLE_CAP) throw new CircleFullError();
}
