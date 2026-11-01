import * as Location from "expo-location";

/**
 * موضعُ الجهاز لـ«خريطتي» بلا سؤال (القاعدة ٣٨١): من منح إذن الموقع تُقرأ منه، ومن لم
 * يمنحه لا يُسأل (القاعدة ٦٨). آخرُ موضعٍ معروف أوّلاً، ثمّ قراءةٌ سريعة بمهلة ثلاث ثوانٍ
 * — النشرُ لا ينتظر الخريطة، والفشلُ لا شيء.
 */
export async function quietFix(): Promise<{ lat: number; lng: number } | null> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== "granted") return null;
    const known = await Location.getLastKnownPositionAsync({ maxAge: 15 * 60 * 1000 }).catch(() => null);
    const point =
      known ??
      (await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
      ]).catch(() => null));
    return point ? { lat: point.coords.latitude, lng: point.coords.longitude } : null;
  } catch {
    return null;
  }
}
