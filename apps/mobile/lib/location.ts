import { Platform } from "react-native";
import * as Base from "expo-location";

export * from "expo-location";

/**
 * موضعُ الجهاز على أندرويد بلا خدمات قوقل (القاعدة ٤٤٢).
 *
 * `getCurrentPositionAsync` في واجهة `expo-location` القديمة يسأل `FusedLocationProviderClient`
 * من خدمات قوقل وحده — وجوّالاتُ هواوي بلاها، فكان «من حولك» واختيارُ المكان ولحظةُ المدينة لا
 * تجد موضعاً. وواجهتُها الجديدة (`expo-location/next`) في البناء نفسه، **وتجرّب قوقل ثمّ
 * `LocationManager` الأصليّ**، فيُقرأ منها على أندرويد ويُعاد بشكل القديمة فلا يتغيّر من ينادي.
 * وآبل على القديمة كما هي.
 */
type Next = typeof import("expo-location/next");
let next: Next | null | undefined;

function nextApi(): Next | null {
  if (Platform.OS !== "android") return null;
  if (next === undefined) {
    try {
      next = require("expo-location/next") as Next;
    } catch {
      next = null;
    }
  }
  return next;
}

type Fix = NonNullable<Awaited<ReturnType<Next["Location"]["getPosition"]>>>;

function shape(p: Fix): Base.LocationObject {
  return {
    coords: {
      latitude: p.coordinates.latitude,
      longitude: p.coordinates.longitude,
      accuracy: p.horizontalAccuracy,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
    },
    timestamp: p.timestamp,
  };
}

export async function getCurrentPositionAsync(options?: Base.LocationOptions): Promise<Base.LocationObject> {
  const api = nextApi();
  if (!api) return Base.getCurrentPositionAsync(options);
  const fix = await api.Location.getPosition({ timeout: 20 });
  if (!fix) throw new Error("no location");
  return shape(fix);
}

export async function getLastKnownPositionAsync(
  options?: Base.LocationLastKnownOptions,
): Promise<Base.LocationObject | null> {
  const api = nextApi();
  if (!api) return Base.getLastKnownPositionAsync(options);
  const fix = await api.Location.getPosition({ timeout: 0 }).catch(() => null);
  if (!fix) return null;
  if (options?.maxAge != null && Date.now() - fix.timestamp > options.maxAge) return null;
  if (options?.requiredAccuracy != null && (fix.horizontalAccuracy ?? Infinity) > options.requiredAccuracy) return null;
  return shape(fix);
}
