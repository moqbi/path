import * as Location from "expo-location";
import { AppState } from "react-native";
import { api } from "./api";
import { appleAirport } from "./apple-places";

/**
 * «وصل إلى الرياض» عند فتح التطبيق.
 *
 * كانت لحظةُ المدينة لا تُكتب إلا مع نشر لحظةٍ فيها موقع، فمن سافر ولم
 * ينشر شيئاً لم تعرف دائرتُه أنّه سافر — **وهذا ما طلبه المالك**:
 * تُرسل أوّل ما يُفتح التطبيق في مدينةٍ ثانية. وعلى الويب تبقى كما
 * كانت: متصفّحٌ يُفتح ويُغلق لا يُقاس عليه سفر.
 *
 * والإذنُ لا يُطلب من أجلها (القاعدة ٦٨): يُقرأ الإذنُ الممنوح أصلاً،
 * ومن لم يمنحه لا يُسأل — إذنٌ يُطلب بلا سبب يُرفض بلا تفكير. والخادمُ
 * هو من يقرّر: يحوّل الإحداثيات إلى مدينة ويكتب اللحظة إن تغيّرت.
 *
 * والفشل يُبتلع: خبرٌ زائد لا يُعطّل فتح التطبيق.
 */

/** فاصلٌ أدنى بين سؤالين: قراءةُ موقعٍ مع كل عودةٍ إلى الشاشة ثمنُ بطاريّة. */
const EVERY = 30 * 60 * 1000;
let last = 0;

export async function checkCity(): Promise<void> {
  const now = Date.now();
  if (now - last < EVERY) return;
  last = now;

  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== "granted") return;

    const here = await Location.getLastKnownPositionAsync({ maxAge: 10 * 60 * 1000 })
      .catch(() => null)
      ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
    if (!here) return;

    const { latitude: lat, longitude: lng } = here.coords;
    // المطارُ من خرائط آبل على الجهاز (القاعدة ٢٨٦)، وفشلُها لا يمنع الوصول.
    const airport = await appleAirport(lat, lng).catch(() => null);
    /*
      والمدينةُ والدولة من خرائط آبل أيضاً (`CLGeocoder` تحت `reverseGeocodeAsync`):
      OpenStreetMap على الخادم كان يردّ اسمَ حيٍّ مكان المدينة — «وصل إلى المطار».
      والخادمُ يأخذها إن كانت عربيّة، وإلّا يقرأ ما عنده.
    */
    const [spot] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng }).catch(() => []);
    const city = spot?.city ?? null;
    await api("/v1/places/check-in", {
      method: "POST",
      body: JSON.stringify({
        lat,
        lng,
        ...(airport ? { airport } : {}),
        ...(city ? { city } : {}),
        ...(spot?.country ? { country: spot.country } : {}),
        ...(spot?.isoCountryCode ? { countryCode: spot.isoCountryCode } : {}),
      }),
    });
  } catch {
    last = 0;
  }
}

/** يُنادى مرّةً عند الدخول، ثمّ مع كل عودةٍ من الخلفيّة. */
export function watchCity(): () => void {
  void checkCity();
  const sub = AppState.addEventListener("change", (state) => {
    if (state === "active") void checkCity();
  });
  return () => sub.remove();
}
