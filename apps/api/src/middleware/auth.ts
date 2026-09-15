import type { Context, MiddlewareHandler } from "hono";
import { prisma } from "@athar/db";
import { readAccess, type Claims } from "../lib/tokens";
import { forbidden, unauthorized } from "../lib/errors";

/**
 * الهوية من التوكن وحده.
 *
 * لا `userId` من الجسد ولا من الاستعلام مهما بدا مريحاً: من يكتب معرّفه
 * في الطلب يكتب معرّف غيره. كل استعلام Prisma بعد هذا يُقيَّد بما هنا.
 */
declare module "hono" {
  interface ContextVariableMap {
    user: Claims;
  }
}

export const requireAuth: MiddlewareHandler = async (c, next) => {
  const header = c.req.header("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) throw unauthorized();

  try {
    c.set("user", await readAccess(token));
  } catch {
    throw unauthorized("انتهت الجلسة — جدّدها");
  }
  await next();
};

/**
 * المشرف يُقرأ من صفّه لا من توكنه.
 *
 * الدور في التوكن ختمٌ عمره خمس عشرة دقيقة: من سُحبت صلاحيته يبقى
 * مشرفاً حتى ينتهي توكنه، وهذه الأبواب تحذف لحظات الناس وتحسم بلاغاتهم.
 * وقراءةُ صفٍّ واحد لكل طلب مشرفٍ لا تُحسّ — حركةُ اللوحة قطرة.
 */
export const requireAdmin: MiddlewareHandler = async (c, next) => {
  const claims = c.get("user");
  if (!claims) throw forbidden("هذه الصفحة للمشرفين");

  const row = await prisma.user.findUnique({
    where: { id: claims.sub },
    select: { role: true },
  });
  if (row?.role !== "ADMIN") throw forbidden("هذه الصفحة للمشرفين");
  await next();
};

/** المعرّف من التوكن — الدالّة الوحيدة التي يُقرأ منها. */
export const me = (c: Context): string => c.get("user").sub;
