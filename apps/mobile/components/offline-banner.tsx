import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "./type";
import { LogoRefresh } from "./logo-refresh";
import { CheckIcon, OfflineIcon } from "./icons";
import { retryNow, useNet } from "../lib/network";

/**
 * «ما فيه اتصال» قرصٌ زجاجيّ في أعلى الشاشة (القاعدة ٣٢١) — **بقرار المالك**، بهيئة
 * «تمّ التبديل» (القاعدة ٣١٦): يبقى ما دام الاتصالُ مقطوعاً ويقول إنّنا نحاول، والشعارُ
 * يدور فيه وهو يسأل، والضغطةُ تسأل في الحال. وبعودة الاتصال «رجع الاتصال» ثانيتين
 * ثمّ يذهب. ولا يظهر لانقطاعٍ أقصر من ثانية: طلبٌ بطيءٌ ثمّ ردٌّ لا يستحقّ خبراً.
 */
export function OfflineBanner() {
  const { offline, checking, back } = useNet();
  const insets = useSafeAreaInsets();
  const show = useRef(new Animated.Value(0)).current;
  const [mode, setMode] = useState<"off" | "down" | "back">("off");

  useEffect(() => {
    if (!offline) return;
    const wait = setTimeout(() => {
      setMode("down");
      AccessibilityInfo.announceForAccessibility?.("ما فيه اتصال بالإنترنت");
    }, 1000);
    return () => clearTimeout(wait);
  }, [offline]);

  useEffect(() => {
    if (!back || mode !== "down") return;
    setMode("back");
    const hide = setTimeout(() => setMode("off"), 2000);
    return () => clearTimeout(hide);
  }, [back]);

  useEffect(() => {
    Animated.timing(show, {
      toValue: mode === "off" ? 0 : 1,
      duration: mode === "off" ? 260 : 220,
      easing: mode === "off" ? Easing.in(Easing.cubic) : Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [mode]);

  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (mode !== "off") return setShown(true);
    const gone = setTimeout(() => setShown(false), 280);
    return () => clearTimeout(gone);
  }, [mode]);
  if (!shown) return null;

  const down = mode !== "back";
  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: insets.top + 8,
        alignItems: "center",
        zIndex: 70,
        opacity: show,
        transform: [{ translateY: show.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
      }}
    >
      <Pressable
        onPress={retryNow}
        disabled={!down}
        accessibilityRole="button"
        accessibilityLabel={down ? "ما فيه اتصال بالإنترنت، اضغط لإعادة المحاولة" : "رجع الاتصال"}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingVertical: 7,
          paddingLeft: 16,
          paddingRight: 8,
          borderRadius: 24,
          backgroundColor: "rgba(20,24,28,.88)",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,.12)",
          maxWidth: "90%",
          shadowColor: "#000",
          shadowOpacity: 0.25,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        }}
      >
        <View style={{ width: 30, height: 30, alignItems: "center", justifyContent: "center" }}>
          {down ? checking ? <LogoRefresh size={28} /> : <OfflineIcon size={20} color="#FF9C82" /> : <CheckIcon size={20} color="#7BD88F" />}
        </View>
        <View style={{ flexShrink: 1 }}>
          <Text numberOfLines={1} style={{ color: "#fff", fontSize: 13.5, fontWeight: "700" }}>
            {down ? "ما فيه اتصال بالإنترنت" : "رجع الاتصال"}
          </Text>
          {down ? (
            <Text numberOfLines={1} style={{ color: "rgba(255,255,255,.7)", fontSize: 11.5 }}>
              {checking ? "نحاول نعيد الاتصال…" : "نعيد المحاولة تلقائياً — اضغط للمحاولة الآن"}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}
