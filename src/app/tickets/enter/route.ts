import { NextResponse, type NextRequest } from "next/server";
import { consume } from "@/lib/email-tokens";
import { createSession } from "@/lib/auth";
import { appUrl } from "@/lib/site-url";

/**
 * بابُ الجوّال إلى نظام التذاكر (القاعدة ٤٨٠).
 *
 * التطبيقُ يطلب من الخادم رمزاً لمرّةٍ واحدة بدقيقتين (`/v1/me/support/link`) ويفتح
 * هذا الرابط في المتصفّح المدمج: الرمزُ يُستهلك هنا فتُفتح جلسةُ الويب ويمضي صاحبُه إلى
 * تذكرته — بلا كلمة مرورٍ تُكتب، ولا رمزٍ يُفتح ثانيةً لو التُقط الرابط.
 * ومسارٌ لا صفحة: الكوكي لا تُكتب أثناء رسم مكوّن خادم (كـ`/verify`).
 */
export async function GET(request: NextRequest) {
  const to = (path: string) => NextResponse.redirect(new URL(appUrl(path) || path, request.url));
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const ticket = request.nextUrl.searchParams.get("to") ?? "";

  const read = await consume(token, "WEB");
  if ("error" in read) return to("/login");

  await createSession(read.userId);
  // المعرّفُ يُمرَّر إلى الصفحة كما هو، وهي تفحص أنّه لصاحب الجلسة.
  return to(/^[a-z0-9]{8,40}$/i.test(ticket) ? `/tickets/${ticket}` : "/tickets");
}
