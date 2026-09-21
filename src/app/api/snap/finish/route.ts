import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { createSession } from "@/lib/auth";
import { readIdentity, upsertIdentity } from "@/lib/oauth";
import { SITE_URL, appUrl } from "@/lib/site-url";

/**
 * عودةُ سناب: تُبادَل الشيفرةُ برمز وصول، ثمّ يُسأل خادمُ سناب عن
 * صاحبه، ثمّ تُفتح جلستُنا.
 *
 * ولا يُصدَّق ما في العنوان: `state` يُقارَن بما في الكوكي، والمبادلةُ
 * تحتاج المتحقّقَ المحفوظ عندنا — فرابطٌ ملتقَطٌ لا يفتح حساباً.
 */
const TOKEN = "https://accounts.snapchat.com/accounts/oauth2/token";

export async function GET(request: NextRequest) {
  const back = (reason: string) =>
    NextResponse.redirect(appUrl(`/login?snap=${reason}`) || new URL(`/login?snap=${reason}`, request.url));

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  const store = await cookies();
  const verifier = store.get("snap_verifier")?.value;
  const saved = store.get("snap_state")?.value;
  store.delete("snap_verifier");
  store.delete("snap_state");

  if (!code || !verifier || !state || state !== saved) return back("bad");

  const clientId = process.env.SNAP_CLIENT_ID;
  if (!clientId || !SITE_URL) return back("off");

  try {
    const response = await fetch(TOKEN, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        redirect_uri: appUrl("/api/snap/finish"),
        code_verifier: verifier,
      }),
    });
    if (!response.ok) return back("token");

    const payload = (await response.json()) as { access_token?: string };
    if (!payload.access_token) return back("token");

    const identity = await readIdentity("SNAP", payload.access_token, null);
    const { userId } = await upsertIdentity(identity);
    await createSession(userId);
  } catch {
    return back("fail");
  }

  return NextResponse.redirect(appUrl("/") || new URL("/", request.url));
}
