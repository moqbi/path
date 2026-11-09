import { PermissionsAndroid, Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";

/**
 * «من حولك» بالبلوتوث (القاعدة ٢٨٢) — الوحدةُ الأصليّة في `modules/nearby-beacon`
 * (Swift ← CoreBluetooth). **اختياريّة** (`requireOptionalNativeModule`): أندرويد
 * والمعاينةُ وبناءٌ قبل ٠٫١٫٣ بلا وحدة، فيبقى الرادارُ على منارة الموقع وحدها ولا
 * يسقط شيء (القاعدة ١٢٤).
 */
type Native = {
  authorization(): "allowed" | "denied" | "undetermined";
  start(uuid: string, token: string): void;
  stop(): void;
  /** من ٠٫١٫٤: حالُ البلوتوث نفسه — بناءٌ قبلها بلا الدالّة. */
  power?(): "on" | "off" | "denied" | "unsupported" | "unknown";
  seen(): { token: string; rssi: number }[];
};

const raw = Platform.OS === "ios" || Platform.OS === "android" ? requireOptionalNativeModule<Native>("NearbyBeacon") : null;

/**
 * أندرويد لا يسأل بنفسه كآبل حين يُنشأ المدير: الإذنُ يُطلب من هنا (`askBle`) قبل
 * `start` (القاعدة ٤٤٥). وما لم يُسأل بعدُ يُقرأ «undetermined» فينتظره سؤالُ الموقع —
 * نافذتا إذنٍ معاً على أندرويد يُلغي ثانيتُهما الأولى.
 */
let asked = Platform.OS !== "android";

const native: Native | null = raw
  ? Platform.OS === "android"
    ? {
        authorization: () => (asked ? raw.authorization() : "undetermined"),
        start: (uuid, token) => raw.start(uuid, token),
        stop: () => raw.stop(),
        power: () => raw.power?.() ?? "unknown",
        seen: () => raw.seen(),
      }
    : raw
  : null;

export async function askBle(): Promise<void> {
  if (Platform.OS !== "android" || asked) return;
  try {
    const wanted =
      Number(Platform.Version) >= 31
        ? [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN, PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE]
        : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
    await PermissionsAndroid.requestMultiple(wanted);
  } catch {
    // رفضٌ أو نظامٌ لا يسأل: يمضي الرادارُ على الموقع.
  } finally {
    asked = true;
  }
}

/** خدمةُ آثار في الهواء — ثابتةٌ لا تتغيّر، فالجهازان يعرفان ما يمسحان. */
export const BEACON_SERVICE = "7A1E9C2B-4D3F-4B8A-9E61-2C5D8F0A7B34";

export const beacon = native;

export type BleState = "none" | "asking" | "on" | "off" | "denied";

/** حالُ البلوتوث كما تُقرأ في الرادار: الإذنُ أوّلاً ثمّ الجهاز. */
export function bleState(): BleState {
  if (!native) return "none";
  const auth = native.authorization();
  if (auth === "denied") return "denied";
  if (auth === "undetermined") return "asking";
  const power = native.power?.();
  if (power === "off") return "off";
  if (power === "denied") return "denied";
  return "on";
}
