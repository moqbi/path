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

/**
 * الإشراف على المحتوى: المالك، أو مشرفٌ مُنح `canModerate`.
 *
 * صلاحيةٌ مستقلّة عن اللوحة قصداً: من يدير المتجر لا يحتاج أن يقرأ
 * لحظات الناس، ومشرفٌ يملكها وآخر لا. والمالك يملكها بدوره.
 *
 * وتُقرأ من الصفّ لا من التوكن — للسبب نفسه في `requireAdmin`: من سُحبت
 * صلاحيته يبقى بختمٍ صالح خمس عشرة دقيقة، وهذا الباب يفتح لحظات الناس.
 */
export const requireModerator: MiddlewareHandler = async (c, next) => {
  const claims = c.get("user");
  if (!claims) throw forbidden("هذا للمشرفين");
  if (!(await isModerator(claims.sub))) throw forbidden("هذا للمشرفين");
  await next();
};

/** هل يملك هذا الحساب صلاحية الإشراف؟ يُقرأ في الحرّاس وفي العرض معاً. */
export async function isModerator(userId: string): Promise<boolean> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, canModerate: true },
  });
  return row?.role === "ADMIN" || row?.canModerate === true;
}

/**
 * الحظر المؤقّت: يُقرأ من الصفّ، ويُردّ نصّاً يُقال لصاحبه.
 *
 * `null` يعني «غير محظور» — ويشمل حظراً انقضى: التاريخ يبقى في الصفّ
 * ليُقرأ عند البلاغ التالي، ولا يُمحى فيضيع أنّه حُظر يوماً.
 */
export async function suspensionOf(
  userId: string,
): Promise<{ until: Date; reason: string | null } | null> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { suspendedUntil: true, suspendedReason: true },
  });
  if (!row?.suspendedUntil || row.suspendedUntil <= new Date()) return null;
  return { until: row.suspendedUntil, reason: row.suspendedReason };
}

/**
 * «الأحد ٢١ سبتمبر ٢٠٢٦، ١٠:٣٠ م» — تاريخٌ يُقرأ لا طابعُ ISO.
 *
 * والتقويم ميلاديّ بالعربية كبقية التطبيق: `ar-SA` وحدها تُخرجه هجرياً
 * فتختلف الرسالةُ عن كل تاريخٍ آخر يراه المستخدم. و`Asia/Riyadh` لأنّ
 * الخادم بتوقيت UTC والقارئ ليس كذلك.
 */
export function untilText(until: Date): string {
  return new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Asia/Riyadh",
  }).format(until);
}

/**
 * الأبواب التي **تكتب** تُغلق في وجه المحظور مؤقّتاً.
 *
 * والقراءة تبقى مفتوحة: من مُنع من النشر لا يُمنع من رؤية ما قاله له
 * الناس، ولا من قراءة سبب حظره. ومنعُ الكتابة وحده يكفي — حظرٌ يمحو
 * التطبيق من يد صاحبه يُقرأ عطلاً لا عقوبة.
 *
 * وصفٌّ واحد يُقرأ في مسارات الكتابة وحدها: فحصُه في `requireAuth` يعني
 * استعلاماً زائداً مع كل تمريرة خطٍّ زمنيّ، وهو أكثر ما يجري.
 */
export const requireActive: MiddlewareHandler = async (c, next) => {
  const claims = c.get("user");
  if (!claims) throw unauthorized();

  const held = await suspensionOf(claims.sub);
  if (held) {
    throw forbidden(
      `حسابك موقوف حتى ${untilText(held.until)}${held.reason ? ` — ${held.reason}` : ""}`,
    );
  }
  await next();
};

/** المعرّف من التوكن — الدالّة الوحيدة التي يُقرأ منها. */
export const me = (c: Context): string => c.get("user").sub;
