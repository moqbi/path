import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";
import type { ComponentType } from "react";
import type { GlassViewProps } from "expo-glass-effect";

/**
 * زجاجُ آبل الحقيقيّ (Liquid Glass) — iOS 26 وما بعده، ببناءٍ يحمل `expo-glass-effect`.
 *
 * **والوحدةُ اختياريّة** (القاعدة ١٢٤): بناءٌ قديمٌ بلاها يصله التحديثُ فيرسم الزجاجَ
 * المغبّش كما كان ولا يسقط. والحزمةُ تُستورد بعد ثبوت الوحدة لا قبلها: استيرادُها
 * يطلب مديرَ العرض الأصليّ في أوّل سطر. وiOS قبل ٢٦ يحمل الوحدة بلا واجهةِ الزجاج،
 * فيُسأل `isGlassEffectAPIAvailable` أيضاً.
 */
let view: ComponentType<GlassViewProps> | null = null;

if (Platform.OS === "ios" && requireOptionalNativeModule("ExpoGlassEffect")) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const glass = require("expo-glass-effect") as typeof import("expo-glass-effect");
    if (glass.isLiquidGlassAvailable() && glass.isGlassEffectAPIAvailable()) view = glass.GlassView;
  } catch {
    view = null;
  }
}

export const LiquidGlass = view;
