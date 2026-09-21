import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SITE_URL } from "@/lib/site-url";

/**
 * بدءُ الدخول بسناب من الويب.
 *
 * **بـPKCE بلا سرٍّ**: عميلُ سناب عامّ، والسرُّ في متصفّحٍ ليس سرّاً.
 * فيُولَّد مُتحقِّقٌ عشوائيّ، ويُرسَل تلخيصُه إلى سناب، ويبقى هو في
 * كوكي httpOnly قصيرة — فلا يستطيع من التقط الرمزَ من العنوان أن
 * يبادله بلا المتحقّق.
 *
 * و`state` حارسُ التزوير: يُقارَن عند العودة، فطلبٌ لم يبدأ من هنا
 * يُردّ.
 */
const AUTHORIZE = "https://accounts.snapchat.com/accounts/oauth2/auth";

const SCOPES = [
  "https://auth.snapchat.com/oauth2/api/user.display_name",
  "https://auth.snapchat.com/oauth2/api/user.external_id",
].join(" ");

export async function GET() {
  const clientId = process.env.SNAP_CLIENT_ID;
  if (!clientId || !SITE_URL) redirect("/login?snap=off");

  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const state = randomBytes(16).toString("base64url");

  const store = await cookies();
  const life = { httpOnly: true, secure: true, sameSite: "lax" as const, maxAge: 600, path: "/" };
  store.set("snap_verifier", verifier, life);
  store.set("snap_state", state, life);

  const query = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${SITE_URL}/api/snap/finish`,
    response_type: "code",
    scope: SCOPES,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });

  redirect(`${AUTHORIZE}?${query.toString()}`);
}
