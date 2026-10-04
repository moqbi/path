import { useRef } from "react";
import { Animated, Dimensions, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable, View } from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "./type";
import { CloseIcon } from "./icons";

const DISMISS = 90;

/**
 * النافذةُ الزجاجيّة — قشرةٌ واحدة لـ«من كان هنا» (القاعدة ٢٣٠) ولوحة التفاعل
 * (القاعدة ٢٤٧): زجاجُ الشريط السفليّ نفسه (القاعدة ٢٢٨)، طافيةٌ فوق أسفل
 * الشاشة، وتُغلق بالضغط خارجها وبسحبها إلى أسفل (القاعدة ٧٨) وتتبع الإصبع.
 *
 * **والسحبُ من رأسها وحده** لا من جسمها: في جسمها لوحةُ إيموجي تُمرَّر
 * وحقلُ كتابة، وسحبٌ يُلتقط من أيّ مكانٍ كان سيأخذ تمريرَ اللوحة.
 * وتصعد فوق الكيبورد (`KeyboardAvoidingView`) فحقلُ التعليق يُرى وهو يُكتب.
 * وتُركَّب في الجذر (القاعدة ١٣٧).
 */
export function GlassSheet({
  icon,
  title,
  subtitle,
  onClose,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const drag = useRef(new Animated.Value(0)).current;
  const height = Dimensions.get("window").height;

  const close = () => {
    onClose();
    drag.setValue(0);
  };

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => drag.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_, g) => {
        if (g.dy > DISMISS || g.vy > 1.2) {
          Animated.timing(drag, { toValue: height, duration: 180, useNativeDriver: true }).start(close);
        } else {
          Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    }),
  ).current;

  return (
    <Modal transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(8,14,20,.38)" }} onPress={close} />

        <Animated.View
          style={{
            marginHorizontal: 10,
            marginBottom: Math.max(insets.bottom, 12),
            maxHeight: height * 0.78,
            transform: [{ translateY: drag }],
            borderRadius: 30,
            shadowColor: "#000",
            shadowOpacity: 0.3,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: 10 },
            elevation: 18,
          }}
        >
          <View
            style={{
              borderRadius: 30,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,.16)",
              backgroundColor: Platform.OS === "android" ? "rgba(20,24,28,.94)" : "rgba(20,24,28,.6)",
            }}
          >
            {Platform.OS !== "android" ? (
              <BlurView intensity={70} tint="systemUltraThinMaterialDark" style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }} />
            ) : null}

            <View {...pan.panHandlers}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,.3)", alignSelf: "center", marginTop: 10 }} />
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 14 }}>
                {icon ? (
                  <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.1)" }}>
                    {icon}
                  </View>
                ) : null}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ color: "#fff", fontSize: 17, fontWeight: "700" }}>
                    {title}
                  </Text>
                  {subtitle ? (
                    <Text numberOfLines={1} style={{ color: "rgba(255,255,255,.62)", fontSize: 12, marginTop: 2 }}>
                      {subtitle}
                    </Text>
                  ) : null}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="إغلاق"
                  onPress={close}
                  hitSlop={8}
                  style={{ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.12)" }}
                >
                  <CloseIcon size={16} color="#fff" />
                </Pressable>
              </View>
              <View style={{ height: 1, backgroundColor: "rgba(255,255,255,.1)", marginHorizontal: 18 }} />
            </View>

            {children}
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
