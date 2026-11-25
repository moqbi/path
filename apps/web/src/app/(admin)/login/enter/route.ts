import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { SITE_URL, hasSite } from "@athar/shared";

/**
 * بابُ الجوّال إلى اللوحة (القاعدة ٤٩٣): رمزٌ لمرّةٍ واحدة بدقيقتين يصدره الخادم
 * (`/v1/me/admin/link`) لمن له صلاحية، ويُستهلك هنا فتُفتح الجلسة ثمّ التحقّقُ الثنائيّ —
 * الرابطُ يقوم مقام كلمة المرور لا مقام الرمز. فمن دخل بقوقل أو آبل أو سناب بلا كلمة
 * يصل لوحتَه، ورابطٌ التُقط لا يفتح شيئاً بلا جوّال صاحبه.
 */
export async function GET(request: NextRequest) {
  const base = hasSite() ? SITE_URL.replace(/\/+$/, "") : request.nextUrl.origin;
  const to = (path: string) => NextResponse.redirect(`${base}${path}`);
  const token = request.nextUrl.searchParams.get("token") ?? "";
  if (!token) return to("/login");

  const row = await prisma.emailToken.findUnique({
    where: { tokenHash: createHash("sha256").update(token).digest("hex") },
    select: { id: true, userId: true, kind: true, expiresAt: true, usedAt: true },
  });
  if (!row || row.kind !== "ADMIN" || row.usedAt || row.expiresAt < new Date()) return to("/login");

  const used = await prisma.emailToken.updateMany({
    where: { id: row.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (!used.count) return to("/login");

  const user = await prisma.user.findUnique({ where: { id: row.userId }, select: { passwordHash: true } });
  if (!user) return to("/login");
  await createSession(row.userId, user.passwordHash);
  return to("/login/verify");
}
