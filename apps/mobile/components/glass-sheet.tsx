import { createContext, useCallback, useContext, useRef } from "react";
import { Animated, Dimensions, Easing, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable, ScrollView, View } from "react-native";
import type { NativeScrollEvent, NativeSyntheticEvent, ScrollViewProps } from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "./type";
import { CloseIcon } from "./icons";

const DISMISS = 90;

/**
 * ما في جسم النافذة من قوائمَ تُمرَّر يقول هنا أهو في أعلاه: السحبُ إلى أسفل
 * يُغلق النافذة ما دامت كلُّها في أعلاها، ويمرّر القائمةَ إن لم تكن.
 */
const Scrolls = createContext<((key: string, top: boolean) => void) | null>(null);

/** `onScroll` لقائمةٍ داخل `GlassSheet`: تُبلغ النافذةَ أهي في أعلاها. */
export function useSheetScroll(key: string) {
  const report = useContext(Scrolls);
  return useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => report?.(key, event.nativeEvent.contentOffset.y <= 2),
    [report, key],
  );
}

/**
 * النافذةُ الزجاجيّة — قشرةٌ واحدة لـ«من كان هنا» (القاعدة ٢٣٠) ولوحة التفاعل
 * (القاعدة ٢٤٧): زجاجُ الشريط السفليّ نفسه (القاعدة ٢٢٨)، طافيةٌ فوق أسفل
 * الشاشة، وتُغلق بالضغط خارجها وبسحبها إلى أسفل (القاعدة ٧٨) وتتبع الإصبع.
 *
 * **والسحبُ إلى أسفل من أيّ موضعٍ فيها** ما دامت قوائمُها في أعلاها
 * (`useSheetScroll`) — فلوحةُ الإيموجي وما يُمرَّر لا تُؤخذ منهما سحبتُهما.
 * وتصعد فوق الكيبورد (`KeyboardAvoidingView`) فحقلُ التعليق يُرى وهو يُكتب.
 * وتُركَّب في الجذر (القاعدة ١٣٧).
 */
/** قائمةٌ تُمرَّر داخل النافذة وتُبلغها أهي في أعلاها. */
export function SheetScrollView({ name, ...props }: ScrollViewProps & { name: string }) {
  const onScroll = useSheetScroll(name);
  return <ScrollView {...props} onScroll={onScroll} scrollEventThrottle={16} />;
}

export function GlassSheet({
  icon,
  title,
  subtitle,
  onClose,
  children,
  overlay,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  /**
   * طبقةٌ بملء الشاشة فوق النافذة — داخل `Modal` نفسه: آبل تعرض النافذةَ فوق كلّ ما
   * في الجذر، فالجولةُ هناك تُرسم خلفها (القاعدة ٣٢٨).
   */
  overlay?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const drag = useRef(new Animated.Value(0)).current;
  const height = Dimensions.get("window").height;

  // لا إعادةَ لـ`drag` بعد الإغلاق: النافذةُ تُزال من الشجرة، وإعادتُها إلى
  // الصفر قبل ذلك كانت تُرجعها إلى مكانها لحظةً قبل أن تختفي.
  const close = () => onClose();

  // قوائمُ الجسم في أعلاها؟ — بلا قائمةٍ مُبلِغة فالجسمُ كلّه «في أعلاه».
  const away = useRef(new Set<string>()).current;
  const report = useCallback(
    (key: string, top: boolean) => {
      if (top) away.delete(key);
      else away.add(key);
    },
    [away],
  );

  // السحبُ إلى أسفل من أيّ موضعٍ فيها — **بقرار المالك** — تتبعه وتصغر وتبهت
  // قليلاً، وما تجاوز الحدّ أو أُفلت بسرعةٍ يُكمل نزولَه ويُغلقها، وإلّا عادت.
  const downward = (g: { dx: number; dy: number }) => g.dy > 8 && g.dy > Math.abs(g.dx) * 1.4;
  const pulling = useRef(false);
  const pan = useRef(
    PanResponder.create({
      // اللمسةُ على ما لا يأخذها أحد — الرأسُ ومقبضُه وعنوانُه وما بين الأزرار — تأخذها
      // النافذة من أوّلها. بلا ذلك لا مستجيبَ ساعةَ البدء، ولا تُسأل النافذةُ عن الحركة
      // بعدها على الجهاز: كان السحبُ يعمل من فوق زرٍّ أو قائمة ولا يعمل من الرأس.
      // والزرُّ أعمقُ منها فيُسأل قبلها، فالضغطُ يبقى للأزرار (ومنها «×»).
      onStartShouldSetPanResponder: () => true,
      // الالتقاطُ في طور الهبوط: الزرُّ والقائمةُ تحت الإصبع كانا يأخذان السحبة.
      onMoveShouldSetPanResponderCapture: (_, g) => downward(g) && away.size === 0,
      onMoveShouldSetPanResponder: (_, g) => downward(g),
      onPanResponderGrant: (_, g) => {
        pulling.current = downward(g);
      },
      // ما لم تثبت السحبةُ نازلةً تُسلَّم اللمسةُ لمن يطلبها — قائمةٌ تُمرَّر إلى أعلى.
      onPanResponderTerminationRequest: () => !pulling.current,
      onPanResponderMove: (_, g) => {
        if (!pulling.current && downward(g)) pulling.current = true;
        if (pulling.current) drag.setValue(Math.max(0, g.dy));
      },
      onPanResponderRelease: (_, g) => {
        if (!pulling.current) return;
        pulling.current = false;
        if (g.dy > DISMISS || g.vy > 1.1) {
          Animated.timing(drag, {
            toValue: height,
            duration: 220,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }).start(({ finished }) => finished && close());
        } else {
          Animated.spring(drag, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
        }
      },
      onPanResponderTerminate: () => {
        pulling.current = false;
        Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start();
      },
    }),
  ).current;

  // الأثر: تصغر حتى ٩٢٪ وتبهت حتى ٦٠٪ كلّما نزلت.
  const scale = drag.interpolate({ inputRange: [0, 320], outputRange: [1, 0.92], extrapolate: "clamp" });
  const fade = drag.interpolate({ inputRange: [0, 320], outputRange: [1, 0.6], extrapolate: "clamp" });

  return (
    <Modal transparent animationType="slide" onRequestClose={close} statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {/* بلا حجابٍ داكن — **بقرار المالك**: النافذةُ طافيةٌ فوق الشاشة كما هي،
            والضغطُ في أيّ مكانٍ خارجها يُغلقها. */}
        <Pressable style={{ flex: 1 }} onPress={close} />

        <Animated.View
          {...pan.panHandlers}
          style={{
            marginHorizontal: 10,
            marginBottom: Math.max(insets.bottom, 12),
            maxHeight: height * 0.78,
            transform: [{ translateY: drag }, { scale }],
            opacity: fade,
            borderRadius: 30,
            shadowColor: "#000",
            shadowOpacity: 0.38,
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

            <View>
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

            <Scrolls.Provider value={report}>{children}</Scrolls.Provider>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
      {overlay}
    </Modal>
  );
}
