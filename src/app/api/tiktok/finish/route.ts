import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { BASE } from "@/lib/base";
import { createSession } from "@/lib/auth";
import { exchangeTikTok, readIdentity, upsertIdentity } from "@/lib/oauth";
import { appUrl } from "@/lib/site-url";

/**
 * عودةُ تيك توك على الويب: `state` يُقارَن بالكوكي، والشيفرةُ تُبادَل بسرّ
 * العميل هنا، ثمّ يُسأل تيك توك عن صاحب الرمز، ثمّ تُفتح جلستُنا.
 * والسببُ يُكتب في السجلّ لا في العنوان وحده (كسناب).
 */
export async function GET(request: NextRequest) {
  const back = (reason: string, detail?: string) => {
    console.error("[tiktok]", reason, detail ?? "");
    return NextResponse.redirect(appUrl(`/login?tiktok=${reason}`) || new URL(`${BASE}/login?tiktok=${reason}`, request.url));
  };

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  /*
     **وعودةُ الجوّال من هنا أيضاً** — عنوانُ عودةٍ واحدٌ يُسجَّل عند تيك توك لا
     اثنان: عنوانٌ ثانٍ نُسي تسجيلُه كان يردّ الجوّالَ بـ«redirect_uri» والويبُ يعمل.
     حارسُ الجوّال يبدأ بـ`app.` (`promptTikTokLogin`)، فيُرتدّ به إلى التطبيق بما
     جاء كما هو، ويُفحص الحارسُ هناك وتُبادَل الشيفرةُ على `/v1/auth/oauth`.
  */
  if (state?.startsWith("app.")) return bounce(request.nextUrl.searchParams);
  // من رفض الإذن في تيك توك يعود بـ`error` لا بشيفرة — ليس عطلاً.
  if (request.nextUrl.searchParams.get("error")) return back("cancel");

  const store = await cookies();
  const saved = store.get("tiktok_state")?.value;
  store.delete("tiktok_state");
  if (!code || !state || state !== saved) {
    return back("bad", `code=${Boolean(code)} state=${Boolean(state)} match=${state === saved}`);
  }

  try {
    const token = await exchangeTikTok(code, appUrl("/api/tiktok/finish"));
    const identity = await readIdentity("TIKTOK", token, null);
    const { userId } = await upsertIdentity(identity);
    await createSession(userId);
  } catch (problem) {
    return back("fail", problem instanceof Error ? problem.message : String(problem));
  }

  return NextResponse.redirect(appUrl("/") || new URL(`${BASE}/`, request.url));
}

/** صفحةُ الارتداد إلى `athar://tiktok` — كـ`/tiktok/callback`: تُرسم ثمّ ترتدّ، والزرُّ لمن لم يرتدّ به جهازُه. */
function bounce(params: URLSearchParams) {
  const query = new URLSearchParams();
  for (const key of ["code", "state", "error", "error_description"]) {
    const value = params.get(key);
    if (value) query.set(key, value);
  }
  const deep = `athar://tiktok?${query.toString()}`;
  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>العودة إلى آثار</title></head>
<body style="margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;font-family:system-ui;background:#0E1A24;color:#f7f5ef;text-align:center;padding:24px">
<p style="font-size:15px;font-weight:600;margin:0">نرجعك إلى آثار…</p>
<a href="${deep.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}" style="background:linear-gradient(90deg,#F6B93B,#FF7A5A);color:#0E1A24;font-weight:700;padding:14px 24px;border-radius:12px;text-decoration:none">افتح التطبيق</a>
<script>setTimeout(function(){location.href=${JSON.stringify(deep).replace(/</g, "\\u003c")}},400)</script>
</body></html>`;
  return new NextResponse(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
