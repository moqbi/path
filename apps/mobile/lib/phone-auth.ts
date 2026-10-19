import { TurboModuleRegistry } from "react-native";

/**
 * تأكيدُ رقم الجوال برمز SMS من Firebase (القاعدة ٢٩٧) — **بقرار المالك**، بالمكتبة
 * الأصليّة: الرمزُ يصل ويُكتب داخل شاشتنا، وعلى الآيفون يتحقّق Firebase من الجهاز بتنبيهٍ
 * صامت فلا يُسأل «لست روبوتاً» غالباً.
 *
 * **ونحن لا نستعمل Firebase حساباً**: دخولُه يُثبت ملكيّة الرقم وحده، فيُرسل رمزُ هويّته
 * إلى خادمنا ليتحقّق منه بنفسه (القاعدة ١٢١) ثمّ يُخرَج منه في الحال.
 *
 * **والوحدةُ اختياريّة** (القاعدة ١٢٤): بناءٌ بلا Firebase — أو بلا ملفّ إعداده — لا
 * يرى شاشةَ الرقم أصلاً، والحزمةُ تُستورد بعد ثبوتها.
 */
function configured(): boolean {
  try {
    const app = TurboModuleRegistry.get<any>("NativeRNFBTurboApp");
    const auth = TurboModuleRegistry.get<any>("NativeRNFBTurboAuth");
    if (!app || !auth) return false;
    const apps = app.getConstants?.().NATIVE_FIREBASE_APPS;
    return Array.isArray(apps) && apps.length > 0;
  } catch {
    return false;
  }
}

export const phoneAuthReady = configured();

type Pending = { confirm: (code: string) => Promise<unknown> };
let pending: Pending | null = null;

/** يُرسل Firebase الرمز. أخطاؤه بالعربيّة لا برموزه. */
export async function sendCode(e164: string): Promise<void> {
  const { getAuth, signInWithPhoneNumber } = await import("@react-native-firebase/auth");
  try {
    pending = await signInWithPhoneNumber(getAuth(), e164);
  } catch (error) {
    throw new Error(explain(error));
  }
}

/** يؤكّد الرمز ويردّ رمزَ هويّة Firebase ليُرسل إلى خادمنا، ثمّ يخرج من Firebase. */
export async function confirmCode(code: string): Promise<string> {
  if (!pending) throw new Error("اطلب رمزاً جديداً");
  const { getAuth, signOut } = await import("@react-native-firebase/auth");
  try {
    await pending.confirm(code);
    const user = getAuth().currentUser;
    if (!user) throw new Error("تعذّر التأكيد — اطلب رمزاً جديداً");
    const token = await user.getIdToken(true);
    pending = null;
    return token;
  } catch (error) {
    throw new Error(explain(error));
  } finally {
    // لا جلسةَ Firebase تبقى على الجهاز: لا نستعملها لشيءٍ بعد هذا.
    if (getAuth().currentUser) await signOut(getAuth()).catch(() => {});
  }
}

function explain(error: unknown): string {
  const code = (error as { code?: string })?.code ?? "";
  if (code.includes("invalid-verification-code")) return "الرمز غير صحيح";
  if (code.includes("code-expired") || code.includes("session-expired")) return "انتهى الرمز — اطلب رمزاً جديداً";
  if (code.includes("invalid-phone-number")) return "اكتب رقم جوال صحيح";
  if (code.includes("too-many-requests") || code.includes("quota-exceeded")) return "محاولات كثيرة — حاول بعد قليل";
  if (code.includes("network")) return "تعذّر الاتصال — تأكد من الإنترنت";
  if (error instanceof Error && !code) return error.message;
  return "تعذّر إرسال الرمز — حاول بعد قليل";
}
