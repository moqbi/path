import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";

/**
 * لقطةُ الشاشة (القاعدة ٢٤٠) — الجهازُ يقولها، لا نمنعها.
 *
 * والوحدةُ **اختياريّة** كخرائط آبل (القاعدة ١٨٨): تحديثٌ يصل إلى بناءٍ قديمٍ
 * بلا `ExpoScreenCapture` لا يسقط عند الإقلاع (القاعدة ١٢٤) — يمضي بلا رصد.
 * ولذلك تُستورد الحزمةُ بعد أن يثبت وجودُ الوحدة لا في رأس الملفّ: استيرادُها
 * يطلب الوحدةَ بـ`requireNativeModule` فيرمي حين تغيب.
 */
const present = Platform.OS !== "web" && requireOptionalNativeModule("ExpoScreenCapture") !== null;

/** يُنادي `onShot` كلّما صوّر صاحبُ الجهاز الشاشةَ وهذا المكوّنُ مرسوم. */
export function useScreenshot(onShot: () => void) {
  const latest = useRef(onShot);
  latest.current = onShot;
  useEffect(() => {
    if (!present) return;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const capture = require("expo-screen-capture") as typeof import("expo-screen-capture");
    const sub = capture.addScreenshotListener(() => latest.current());
    return () => sub.remove();
  }, []);
}
