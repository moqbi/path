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
  /*
     والسببُ يُكتب في السجلّ لا يُترك في العنوان وحده: من يرى نفسه
     مردوداً إلى الدخول لا يقرأ `?snap=token`، ومن يصلحها لا يجلس معه
     ينظر إلى شاشته. والرمزُ نفسه لا يُكتب — يُكتب أنّه كان موجوداً.
  */
  const back = (reason: string, detail?: string) => {
    console.error("[snap]", reason, detail ?? "");
    return NextResponse.redirect(appUrl(`/login?snap=${reason}`) || new URL(`/login?snap=${reason}`, request.url));
  };

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  const store = await cookies();
  const verifier = store.get("snap_verifier")?.value;
  const saved = store.get("snap_state")?.value;
  store.delete("snap_verifier");
  store.delete("snap_state");

  if (!code || !verifier || !state || state !== saved) {
    return back(
      "bad",
      `code=${Boolean(code)} verifier=${Boolean(verifier)} state=${Boolean(state)} match=${state === saved}`,
    );
  }

  const clientId = process.env.SNAP_CLIENT_ID;
  if (!clientId || !SITE_URL) return back("off", `clientId=${Boolean(clientId)} site=${SITE_URL || "—"}`);

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
    if (!response.ok) {
      return back("token", `${response.status} ${(await response.text().catch(() => "")).slice(0, 300)}`);
    }

    const payload = (await response.json()) as { access_token?: string };
    if (!payload.access_token) return back("token", "ردٌّ بلا access_token");

    const identity = await readIdentity("SNAP", payload.access_token, null);
    const { userId } = await upsertIdentity(identity);
    await createSession(userId);
  } catch (problem) {
    return back("fail", problem instanceof Error ? problem.message : String(problem));
  }

  return NextResponse.redirect(appUrl("/") || new URL("/", request.url));
}
