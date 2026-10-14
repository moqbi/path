import { Platform } from "react-native";
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
  seen(): { token: string; rssi: number }[];
};

const native = Platform.OS === "ios" ? requireOptionalNativeModule<Native>("NearbyBeacon") : null;

/** خدمةُ آثار في الهواء — ثابتةٌ لا تتغيّر، فالجهازان يعرفان ما يمسحان. */
export const BEACON_SERVICE = "7A1E9C2B-4D3F-4B8A-9E61-2C5D8F0A7B34";

export const beacon = native;
