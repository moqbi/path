import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth";

/**
 * بابُ الجوّال إلى نظام التذاكر (القاعدة ٤٨٠): رمزٌ لمرّةٍ واحدة بدقيقتين يصدره الخادم
 * (`/v1/me/support/link`) ويُستهلك هنا فتُفتح الجلسة ويمضي صاحبُه إلى تذكرته.
 * ومسارٌ لا صفحة: الكوكي لا تُكتب أثناء رسم مكوّن خادم.
 */
export async function GET(request: NextRequest) {
  const to = (path: string) => NextResponse.redirect(new URL(path, request.url));
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const ticket = request.nextUrl.searchParams.get("to") ?? "";
  if (!token) return to("/tickets");

  const row = await prisma.emailToken.findUnique({
    where: { tokenHash: createHash("sha256").update(token).digest("hex") },
    select: { id: true, userId: true, kind: true, expiresAt: true, usedAt: true },
  });
  if (!row || row.kind !== "WEB" || row.usedAt || row.expiresAt < new Date()) return to("/tickets");

  // الاستهلاكُ بشرط «لم يُستعمل» في القاعدة نفسها: طلبان معاً لا يفتحان جلستين.
  const used = await prisma.emailToken.updateMany({
    where: { id: row.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (!used.count) return to("/tickets");

  const user = await prisma.user.findUnique({ where: { id: row.userId }, select: { passwordHash: true } });
  if (!user) return to("/tickets");
  await createSession(row.userId, user.passwordHash);
  return to(/^[a-z0-9]{8,40}$/i.test(ticket) ? `/tickets/${ticket}` : "/tickets");
}
