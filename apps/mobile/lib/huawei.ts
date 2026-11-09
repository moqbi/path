import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";

/**
 * خدماتُ هواوي (القاعدة ٤٤٦): رمزُ Push Kit والدفعُ داخل التطبيق.
 *
 * الوحدةُ في `modules/huawei-hms`، **وخدماتُها في بناء `huawei` وحده** — غيرُه يحمل الوحدةَ
 * فارغة (`enabled()` كاذبة). واختياريّةٌ (القاعدة ١٢٤): بناءُ هواوي قبلها يمضي بلا دفعٍ
 * ولا تنبيهات كما كان.
 */
type Purchase = { code: number; data?: string; signature?: string; message?: string };
type Product = { productId: string; price: string; micros: number; currency: string; name: string; period: string };

type Native = {
  enabled(): boolean;
  available(): boolean;
  pushToken(appId: string): Promise<string | null>;
  deleteToken(appId: string): Promise<boolean>;
  iapReady(): Promise<string>;
  products(ids: string[], type: number): Promise<Product[]>;
  buy(productId: string, type: number, payload: string): Promise<Purchase>;
  owned(type: number): Promise<{ data: string; signature: string }[]>;
  manage(): Promise<boolean>;
};

const native = Platform.OS === "android" ? requireOptionalNativeModule<Native>("HuaweiHms") : null;

/** معرّفُ التطبيق عند هواوي (AppGallery Connect ← `agconnect-services.json`). */
export const HUAWEI_APP_ID = "119730833";

/** نوعُ المنتج عند هواوي: ما يُستهلك (النقاط والهدية) والاشتراك. */
export const CONSUMABLE = 0;
export const SUBSCRIPTION = 2;

/** رموزُ `OrderStatusCode`. */
export const HW = {
  OK: 0,
  CANCEL: 60000,
  NOT_LOGIN: 60050,
  OWNED: 60051,
  AREA: 60054,
  AGREEMENT: 60055,
  PENDING: 60057,
} as const;

let ready: boolean | null = null;

/** أفي هذا البناء خدماتُ هواوي، وفي الجهاز HMS Core؟ */
export function huawei(): boolean {
  if (!native) return false;
  if (ready === null) {
    try {
      ready = native.enabled() && native.available();
    } catch {
      ready = false;
    }
  }
  return ready;
}

export const hms = native;

/** سببُ الفشل بلسان صاحبه. */
export function hwProblem(code: number | string): string {
  const n = typeof code === "string" ? Number(code.replace(/^code:/, "")) : code;
  if (n === HW.NOT_LOGIN || code === "login") return "سجّل الدخول بحساب هواوي (HUAWEI ID) أوّلاً ثمّ أعد المحاولة.";
  if (n === HW.AREA || code === "area") return "الدفعُ غير متاح لبلد حساب هواوي هذا.";
  if (n === HW.AGREEMENT) return "وافق على اتفاقيّة الدفع في حساب هواوي ثمّ أعد المحاولة.";
  if (n === HW.PENDING) return "الدفعُ بانتظار الاكتمال — يُفعَّل حين يكتمل.";
  if (n === 60003) return "المنتجُ غير موجود في متجر هواوي بعد.";
  if (n === 60005) return "تعذّر الاتصال بمتجر هواوي — تحقّق من الإنترنت.";
  if (n === 60007) return "المنتجُ غير متاح في بلدك.";
  return `تعذّر الدفع (${code})`;
}
