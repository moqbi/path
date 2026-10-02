import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";

/**
 * إلغاءُ ربط «الدخول بآبل» عند حذف الحساب — شرطُ آبل 5.1.1(v).
 *
 * **لا رمزَ يُخزَّن عندنا**: الجهاز يطلب من صاحب الحساب أن يؤكّد بآبل
 * لحظةَ الحذف، فيأتي برمز هويّةٍ ورمزِ تفويضٍ جديدين. الأوّل يُثبت أنّه
 * هو، والثاني يُبادَل برمزٍ يُلغى في الحال. رمزُ تجديدٍ مخزَّنٌ لكلّ
 * حساب مفتاحٌ يعيش في القاعدة بلا حاجة.
 *
 * والسرُّ توقيعٌ بمفتاح «Sign in with Apple» من حساب المطوّر
 * (`APPLE_TEAM_ID` و`APPLE_KEY_ID` و`APPLE_KEY_PATH`). **وبلا مفتاحٍ يمضي
 * الحذف** ويُكتب سطرٌ في السجلّ: بيئةٌ لم تُربط لا يُحبس فيها أحدٌ في
 * حسابه (القاعدة ١٠٢). والفشلُ كذلك — آخرُ خطوةٍ قبل فقد كلّ شيء لا
 * تُردّ لأنّ خادمَ آبل لم يجب.
 */

const APPLE = "https://appleid.apple.com";

/** سرُّ العميل: JWT بـES256 صالحٌ خمس دقائق. */
function clientSecret(clientId: string): string | null {
  const team = process.env.APPLE_TEAM_ID;
  const kid = process.env.APPLE_KEY_ID;
  const path = process.env.APPLE_KEY_PATH;
  if (!team || !kid || !path) return null;

  const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: "ES256", kid });
  const body = b64({ iss: team, iat: now - 60, exp: now + 300, aud: APPLE, sub: clientId });
  const signer = createSign("SHA256");
  signer.update(`${head}.${body}`);
  // JOSE (r‖s) لا DER — وإلّا ردّت آبل invalid_client.
  const sig = signer.sign({ key: readFileSync(path, "utf8"), dsaEncoding: "ieee-p1363" });
  return `${head}.${body}.${sig.toString("base64url")}`;
}

async function post(path: string, form: Record<string, string>) {
  return fetch(APPLE + path, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form),
    signal: AbortSignal.timeout(8000),
  });
}

/**
 * يُبادل رمزَ التفويض ثمّ يُلغي ما خرج منه. لا يرمي أبداً: يردّ هل أُلغي،
 * والسببُ في السجلّ.
 */
export async function revokeApple(code: string, clientId: string): Promise<boolean> {
  try {
    const secret = clientSecret(clientId);
    if (!secret) {
      console.warn("[apple] لم يُلغَ الربط — APPLE_TEAM_ID/APPLE_KEY_ID/APPLE_KEY_PATH غير مضبوطة");
      return false;
    }

    const exchanged = await post("/auth/token", {
      client_id: clientId,
      client_secret: secret,
      code,
      grant_type: "authorization_code",
    });
    if (!exchanged.ok) {
      console.error("[apple] مبادلة الرمز:", exchanged.status, await exchanged.text());
      return false;
    }
    const tokens = (await exchanged.json()) as { refresh_token?: string; access_token?: string };
    const token = tokens.refresh_token ?? tokens.access_token;
    if (!token) return false;

    const revoked = await post("/auth/revoke", {
      client_id: clientId,
      client_secret: secret,
      token,
      token_type_hint: tokens.refresh_token ? "refresh_token" : "access_token",
    });
    if (!revoked.ok) {
      console.error("[apple] الإلغاء:", revoked.status, await revoked.text());
      return false;
    }
    return true;
  } catch (problem) {
    console.error("[apple] الإلغاء:", problem instanceof Error ? problem.message : problem);
    return false;
  }
}
