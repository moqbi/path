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

/**
 * عدسةُ الشريط زجاجٌ فوق زجاج — وعلى آيفون ١٢ وما قبله (A14، `iPhone13,x`) يرسمها
 * iOS 26 قرصاً رمادياً معتماً أكبر من التبويب بدل عدسةٍ تكسر ما تحتها. فتلك الأجهزة
 * تبقى على القرص المرسوم تحت الأيقونة، والشريطُ نفسُه زجاجٌ حقيقيّ كما هو.
 */
function lensCapable() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const id = (require("expo-device") as typeof import("expo-device")).modelId as string | null;
    const major = /^iPhone(\d+),/.exec(id ?? "")?.[1];
    return !major || Number(major) >= 14;
  } catch {
    return true;
  }
}

export const LiquidLens = view && lensCapable() ? view : null;
