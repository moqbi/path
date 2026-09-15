import { Platform, Linking } from "react-native";
import { PLUS_ENTITLEMENT } from "@athar/shared";

/**
 * الدفع عبر المتجرين — RevenueCat بينهما وبيننا.
 *
 * ولا يُصدَّق العميل: شراؤُه يُفعّل آثار+ حين يصل حدثُ RevenueCat إلى
 * الخادم (`/v1/webhooks/revenuecat`)، لا حين تعود الشاشة بنتيجة. فما
 * هنا واجهةُ شراءٍ لا منحُ صلاحية.
 *
 * والحزمة أصليّة (`react-native-purchases`) فلا تعمل في معاينة الويب
 * ولا في Expo Go — ولهذا تُستورد عند الطلب لا في أعلى الملف: استيرادٌ
 * ثابت يُسقط المعاينة كلها على شاشةٍ بيضاء.
 */
const STORE_KEY = Platform.select({
  ios: process.env.EXPO_PUBLIC_RC_IOS_KEY,
  android: process.env.EXPO_PUBLIC_RC_ANDROID_KEY,
  default: undefined,
});

/**
 * متجر RevenueCat التجريبي — بديلٌ مؤقّت حتى يُفتح حساب آبل للمطوّرين.
 *
 * فآبل تطلب ملف `.p8` من App Store Connect لربط متجرها، وهو لا يوجد قبل
 * الاشتراك ($99). والمتجر التجريبي يشتري بنافذةٍ وهمية ويُصدر أحداثاً
 * حقيقية إلى خادمنا (`store: "TEST_STORE"`, `environment: "SANDBOX"`)،
 * فيُختبر المسار كلّه: الشراء، والحدث، والتفعيل.
 *
 * ومفتاح المتجر الحقيقي يسبقه دائماً: يوم يوجد `appl_`/`goog_` يُستعمل
 * هو، ويبقى هذا للتطوير وحده.
 *
 * **ولا يُقبل في نسخةٍ مُصدَرة ولو وُجد في البيئة**: حزمة RevenueCat
 * تكشف المفتاح التجريبي في بناء الإصدار وتُغلق التطبيق بنفسها
 * («Wrong API Key … The app will close now») — حمايةً لبيانات الشراء
 * التجريبية. فالشرط `__DEV__` لا ترفٌ: بدونه تُقفل الشاشة الأولى على
 * كل من يفتح النسخة. وحذفُه من ملفّ البناء وحده لا يكفي حارساً.
 */
const TEST_KEY = __DEV__ ? process.env.EXPO_PUBLIC_RC_TEST_KEY : undefined;

const KEY = STORE_KEY || TEST_KEY;

/** أمضبوطٌ الدفع في هذه النسخة؟ عليه يتوقّف شكل شاشة الاشتراك. */
export const billingReady = (): boolean => Platform.OS !== "web" && Boolean(KEY);

/** أهو المتجر التجريبي؟ تقوله الشاشة صراحةً فلا يُحسب شراءٌ حقيقياً. */
export const testStore = (): boolean => billingReady() && !STORE_KEY;

type Purchases = typeof import("react-native-purchases").default;

let sdk: Purchases | null = null;
let openedFor: string | null = null;

async function load(): Promise<Purchases | null> {
  if (!billingReady()) return null;
  if (!sdk) sdk = (await import("react-native-purchases")).default;
  return sdk;
}

/**
 * يربط المشتري بحسابه عندنا.
 *
 * `appUserID` هو معرّف المستخدم في قاعدتنا — به يصل الحدث إلى صاحبه.
 * وبدونه يشتري RevenueCat لمعرّفٍ مجهول (`$RCAnonymousID:…`) فلا نعرف
 * لمن نفعّل.
 */
export async function startBilling(userId: string): Promise<void> {
  const purchases = await load();
  if (!purchases || openedFor === userId) return;

  if (openedFor) {
    await purchases.logIn(userId);
  } else {
    await purchases.configure({ apiKey: KEY!, appUserID: userId });
  }
  openedFor = userId;
}

/** يُنسى المشتري عند الخروج، وإلا اشترى التالي على حساب الأول. */
export async function stopBilling(): Promise<void> {
  const purchases = await load();
  if (!purchases || !openedFor) return;
  await purchases.logOut().catch(() => {});
  openedFor = null;
}

export type Plan = {
  id: string;
  /** السعر بعملة المشتري وبصيغة متجره — لا نكتبه نحن. */
  price: string;
  yearly: boolean;
};

/**
 * الباقات كما يقولها المتجر.
 *
 * السعر يُقرأ من المتجر لا من الكود: ريالٌ عندنا ودولارٌ عند غيرنا،
 * والضريبة والتقريب يختلفان بين بلدٍ وآخر — ورقمٌ مكتوب في الشاشة
 * يخالف ما يُخصم فعلاً سببُ رفضٍ في المراجعة.
 */
export async function plans(): Promise<Plan[]> {
  const purchases = await load();
  if (!purchases) return [];

  const offerings = await purchases.getOfferings();
  const packages = offerings.current?.availablePackages ?? [];

  return packages.map((item) => ({
    id: item.identifier,
    price: item.product.priceString,
    yearly: item.packageType === "ANNUAL",
  }));
}

/** يشتري باقةً ويردّ هل صار الاستحقاق فعّالاً عند المتجر. */
export async function buy(planId: string): Promise<{ active: boolean; cancelled: boolean }> {
  const purchases = await load();
  if (!purchases) return { active: false, cancelled: false };

  const offerings = await purchases.getOfferings();
  const item = offerings.current?.availablePackages.find((one) => one.identifier === planId);
  if (!item) return { active: false, cancelled: false };

  try {
    const { customerInfo } = await purchases.purchasePackage(item);
    return { active: Boolean(customerInfo.entitlements.active[PLUS_ENTITLEMENT]), cancelled: false };
  } catch (problem) {
    // إلغاءُ المشتري لنافذة الدفع ليس خطأً يُعرض له.
    const cancelled = Boolean((problem as { userCancelled?: boolean }).userCancelled);
    if (cancelled) return { active: false, cancelled: true };
    throw problem;
  }
}

/**
 * باقة كوينز: شراءٌ يُستهلك، لا اشتراكٌ يتجدّد.
 *
 * ويُشترى بمعرّف المنتج مباشرةً (`purchaseStoreProduct`) لا بحزمةٍ من
 * عرضٍ: العروض في RevenueCat مبنيّةٌ للاشتراك، والباقات تُضاف وتُحذف من
 * لوحتنا — فربطُها بعرضٍ هناك يعني تعديلين لكل تغيير.
 *
 * ولا يُفتح الرصيد هنا: الجهاز يشتري، والخادم يودع حين يصله حدثُ
 * RevenueCat. فما يردّه هذا هو «تمّ الشراء» لا «وصل الرصيد».
 */
export async function buyCoins(sku: string): Promise<{ bought: boolean; cancelled: boolean }> {
  const purchases = await load();
  if (!purchases) return { bought: false, cancelled: false };

  const products = await purchases.getProducts([sku]);
  const product = products.find((one) => one.identifier === sku) ?? products[0];
  if (!product) return { bought: false, cancelled: false };

  try {
    await purchases.purchaseStoreProduct(product);
    return { bought: true, cancelled: false };
  } catch (problem) {
    const cancelled = Boolean((problem as { userCancelled?: boolean }).userCancelled);
    if (cancelled) return { bought: false, cancelled: true };
    throw problem;
  }
}

/**
 * الاستعادة — شرط متجر آبل: من غيّر جهازه أو حذف التطبيق يستعيد ما
 * دفع بلا أن يدفع ثانيةً.
 */
export async function restore(): Promise<boolean> {
  const purchases = await load();
  if (!purchases) return false;
  const info = await purchases.restorePurchases();
  return Boolean(info.entitlements.active[PLUS_ENTITLEMENT]);
}

/**
 * الإلغاء يجري في المتجر لا عندنا.
 *
 * لا آبل ولا جوجل تسمحان بإلغاء اشتراكٍ من داخل التطبيق، وزرٌّ يوهم
 * بذلك يترك صاحبه يُخصم منه شهراً آخر وهو يظنّ أنّه ألغى. فيُفتح
 * الرابط الذي يعطيه المتجر نفسه.
 */
export async function openManage(): Promise<void> {
  const purchases = await load();
  const info = await purchases?.getCustomerInfo();
  const url =
    info?.managementURL ??
    (Platform.OS === "ios"
      ? "https://apps.apple.com/account/subscriptions"
      : "https://play.google.com/store/account/subscriptions");
  await Linking.openURL(url);
}
