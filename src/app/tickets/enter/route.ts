import { NextResponse, type NextRequest } from "next/server";
import { SITE_URL } from "@/lib/site-url";

/**
 * بابُ الجوّال القديم: الرمزُ يُمرَّر كما هو إلى باب الجذر (`/tickets/enter`) فيُستهلك
 * هناك — لا هنا، فلا يُفتح بابان برمزٍ واحد.
 */
export function GET(request: NextRequest) {
  if (!SITE_URL) return NextResponse.redirect(new URL("/app/settings/support", request.url));
  return NextResponse.redirect(`${SITE_URL}/tickets/enter${request.nextUrl.search}`);
}
