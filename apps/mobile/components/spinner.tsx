import { ActivityIndicator, View, type ActivityIndicatorProps } from "react-native";
import { LogoRefresh } from "./logo-refresh";
import { DEV_FEATURES } from "../lib/dev-features";

/**
 * كلُّ دائرة انتظارٍ في التطبيق شعارُه (القاعدة ٣٢١) — **بقرار المالك**: مكانَ
 * `ActivityIndicator` بخصائصه نفسها، فيُبدَّل الاستيرادُ وحده في كلّ شاشة. في نسخة
 * التطوير وحدها (القاعدة ٢٩١)، والإنتاجُ على دوّارة النظام. واللونُ يُترك: الشعارُ
 * بألوانه، والقوسُ بلون اللمسة.
 */
export function Spinner({ size = "small", style, color: _color, ...rest }: ActivityIndicatorProps) {
  if (!DEV_FEATURES) return <ActivityIndicator size={size} style={style} color={_color} {...rest} />;
  const px = typeof size === "number" ? size : size === "large" ? 38 : 22;
  return (
    <View style={[{ alignItems: "center", justifyContent: "center" }, style]}>
      <LogoRefresh size={px} />
    </View>
  );
}
