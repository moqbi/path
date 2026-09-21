import { Platform } from "react-native";
import * as AppleAuth from "expo-apple-authentication";
import * as Google from "expo-auth-session/providers/google";
import * as AuthSession from "expo-auth-session";
import { api, saveTokens } from "./api";
import type { Me } from "./session";

/**
 * الدخول بمزوّد على الجوّال.
 *
 * **الجهاز يأخذ رمزَ الهويّة والخادمُ يتحقّق منه** — لا يرسل التطبيقُ
 * معرّفاً ولا بريداً يُصدَّق كما جاء (`services/oauth.ts`).
 *
 * والمعرّفاتُ من البيئة لا من الكود: معرّفُ عميلٍ مكتوبٌ في ملفٍّ يبقى
 * فيه بعد أن يتغيّر، وبيئةٌ فارغة تعني «غير مفعّل» فيُقال ذلك بدل أن
 * يُفتح بابٌ لا يُغلق.
 */
export const GOOGLE_IDS = {
  ios: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "",
  android: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? "",
  web: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "",
};

/** هل بابُ قوقل مفتوحٌ على هذا الجهاز؟ */
export function googleReady(): boolean {
  return Boolean(Platform.OS === "ios" ? GOOGLE_IDS.ios : GOOGLE_IDS.android);
}

/** وآبل لا تُعرض إلّا على أجهزتها — زرٌّ لا يعمل أسوأ من زرٍّ غائب. */
export function appleReady(): boolean {
  return Platform.OS === "ios";
}

/** ما يردّه الخادم بعد أيّ دخول: جلسةٌ وصاحبُها. */
type Session = { user: Me; accessToken: string; refreshToken: string };

/**
 * يُبادل رمزَ المزوّد بجلستنا ويحفظها.
 *
 * والاسمُ يُمرَّر لآبل وحدها: لا تعطيه إلّا مرّةً واحدة وقت أوّل موافقة،
 * فمن لم يلتقطه التطبيقُ حينها لم يعد يجده في الرمز أبداً.
 */
async function exchange(
  provider: "GOOGLE" | "APPLE" | "SNAP",
  idToken: string,
  name: string | null,
): Promise<Me> {
  const session = await api<Session>("/v1/auth/oauth", {
    method: "POST",
    body: JSON.stringify({ provider, idToken, name }),
  });
  await saveTokens(session.accessToken, session.refreshToken);
  return session.user;
}

/** الدخول بحساب آبل — وهو شرطُ آبل حين يُعرض مزوّدٌ آخر. */
export async function signInWithApple(): Promise<Me> {
  const credential = await AppleAuth.signInAsync({
    requestedScopes: [
      AppleAuth.AppleAuthenticationScope.FULL_NAME,
      AppleAuth.AppleAuthenticationScope.EMAIL,
    ],
  });
  if (!credential.identityToken) throw new Error("ما وصل رمزٌ من آبل");

  const parts = [credential.fullName?.givenName, credential.fullName?.familyName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return exchange("APPLE", credential.identityToken, parts || null);
}

/**
 * قوقل: الخطّافُ يفتح صفحةَ المزوّد ويردّ الرمز.
 *
 * `useIdTokenAuthRequest` لا `useAuthRequest`: نريد **رمز هويّةٍ
 * موقَّعاً** يتحقّق منه خادمُنا، لا رمزَ وصولٍ يُستعمل نيابةً عن أحد.
 */
export function useGoogle() {
  return Google.useIdTokenAuthRequest({
    iosClientId: GOOGLE_IDS.ios || undefined,
    androidClientId: GOOGLE_IDS.android || undefined,
    webClientId: GOOGLE_IDS.web || undefined,
  });
}

/** يُكمل دخولَ قوقل بالرمز الذي ردّه الخطّاف. */
export async function finishGoogle(idToken: string): Promise<Me> {
  return exchange("GOOGLE", idToken, null);
}

/**
 * سناب: رمزُ وصولٍ بـPKCE، لا رمزُ هويّة.
 *
 * وبلا حزمةٍ أصليّةٍ من سناب: `expo-auth-session` تفتح صفحتَها وتعود
 * بالرمز، فلا نُدخل وحدةً أصليّةً ثالثة في البناء لأجل بابٍ واحد.
 *
 * وعميلُها **عامّ** (Public Client): لا سرَّ في التطبيق — والسرُّ في
 * التطبيق ليس سرّاً، فكلُّ من فكّ الحزمة قرأه.
 */
const SNAP = {
  authorizationEndpoint: "https://accounts.snapchat.com/accounts/oauth2/auth",
  tokenEndpoint: "https://accounts.snapchat.com/accounts/oauth2/token",
};

const SNAP_SCOPES = [
  "https://auth.snapchat.com/oauth2/api/user.display_name",
  "https://auth.snapchat.com/oauth2/api/user.external_id",
];

export function snapReady(): boolean {
  return Boolean(process.env.EXPO_PUBLIC_SNAP_CLIENT_ID);
}

export function useSnap() {
  const clientId = process.env.EXPO_PUBLIC_SNAP_CLIENT_ID ?? "";
  // العودةُ إلى التطبيق بمخطّطه (`athar://`) لا إلى صفحةِ ويب.
  const redirectUri = AuthSession.makeRedirectUri({ scheme: "athar", path: "snap" });

  return AuthSession.useAuthRequest(
    {
      clientId,
      scopes: SNAP_SCOPES,
      redirectUri,
      responseType: "code",
      usePKCE: true,
    },
    SNAP,
  );
}

/**
 * يُبادل الرمزَ المؤقّت برمز وصول، ثمّ يرسله إلى خادمنا ليسأل سناب
 * «من صاحبُه؟» — فلا يُصدَّق ما يقوله التطبيق عن نفسه.
 */
export async function finishSnap(code: string, verifier: string): Promise<Me> {
  const clientId = process.env.EXPO_PUBLIC_SNAP_CLIENT_ID ?? "";
  const redirectUri = AuthSession.makeRedirectUri({ scheme: "athar", path: "snap" });

  const token = await AuthSession.exchangeCodeAsync(
    { clientId, code, redirectUri, extraParams: { code_verifier: verifier } },
    SNAP,
  );
  if (!token.accessToken) throw new Error("ما وصل رمزٌ من سناب");

  return exchange("SNAP", token.accessToken, null);
}
