import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
// `redirect()` في معالج المسار لا يسبق الجذرَ `/app` (القاعدة ١٢٢) — كان يُرسل إلى ٤٠٤.
import { BASE } from "@/lib/base";
import { SITE_URL, appUrl } from "@/lib/site-url";

/**
 * بدءُ الدخول بتيك توك من الويب.
 *
 * `state` حارسُ التزوير في كوكي httpOnly قصيرة، يُقارَن عند العودة. ولا
 * PKCE هنا: الويبُ عند تيك توك عميلٌ بسرّ، والسرُّ على خادمنا يبادل
 * الشيفرة — فشيفرةٌ ملتقَطةٌ من العنوان لا تُبادَل بلاه.
 */
const AUTHORIZE = "https://www.tiktok.com/v2/auth/authorize/";

export async function GET() {
  const key = process.env.TIKTOK_CLIENT_KEY;
  if (!key || !process.env.TIKTOK_CLIENT_SECRET || !SITE_URL) redirect(`${BASE}/login?tiktok=off`);

  const state = randomBytes(16).toString("base64url");
  const store = await cookies();
  store.set("tiktok_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });

  const query = new URLSearchParams({
    client_key: key,
    response_type: "code",
    scope: "user.info.basic",
    redirect_uri: appUrl("/api/tiktok/finish"),
    state,
  });
  redirect(`${AUTHORIZE}?${query.toString()}`);
}
