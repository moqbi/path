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
