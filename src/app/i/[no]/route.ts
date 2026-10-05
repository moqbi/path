import { NextResponse, type NextRequest } from "next/server";
import { REF_COOKIE } from "@/lib/invite-ref";
import { appUrl } from "@/lib/site-url";
import { BASE } from "@/lib/base";

/**
 * رابطُ الدعوة على الويب (القاعدة ٢٤٣): يحفظ الداعي أسبوعاً ويمضي إلى
 * التسجيل. وأوّلُ داعٍ يبقى — من أوصلك أوّلاً هو من دعاك.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ no: string }> }) {
  const { no } = await params;
  const response = NextResponse.redirect(new URL(appUrl("/login") || `${BASE}/login`, request.url));
  if (/^\d{1,9}$/.test(no) && !request.cookies.get(REF_COOKIE)) {
    response.cookies.set(REF_COOKIE, no, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 7 * 86_400,
    });
  }
  return response;
}
