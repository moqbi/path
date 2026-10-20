import { useRef, useState } from "react";
import { Animated, Easing, PanResponder, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { BackIcon } from "./icons";
import { colors } from "../theme/tokens";

/** أبعدُ ما يدخل سهمُ الرجوع من الحافّة، ومسافةُ الإفلات التي ترجع. */
const ARROW_REACH = 64;
const ARROW_GO = 56;

/** عرضُ الحافّة التي تبدأ منها السحبة — ما بدأ من الوسط يخصّ ما تحته. */
const EDGE = 36;

/**
 * السحبُ من الحافّة رجوعٌ (القاعدة ٧٨، والقاعدة ٢١٧ على الجوّال).
 *
 * شاشاتُ المكدّس تملكه من آبل نفسها، أمّا ما يجلس **داخل التبويبات** — ملفُّ
 * الصديق — فلا إيماءةَ له: التبويباتُ لا مكدّسَ لها تسحبه. فهذا يلفّ الشاشة،
 * ويلتقط سحبةً تبدأ من إحدى الحافّتين (يميناً لقارئ العربية، ويساراً لمن
 * تعوّد اللاتينية) وتمضي إلى الداخل، فتتبع الشاشةُ الإصبع؛ وما تجاوز ثلثَ
 * العرض أو أُفلت بسرعةٍ رجع، وإلّا عادت الشاشة مكانها.
 */
export function EdgeBack({
  fallback,
  enabled = true,
  onBack,
  children,
}: {
  fallback: string;
  /**
   * رجوعٌ بعينه بدل التاريخ: «آثارنا» تُفتح من ملفّ الصديق بتبديل تبويب، وتاريخُ
   * التبويبات قد يسقط الملفَّ المخفيّ فيُرجع إلى «الأصدقاء» لا إلى الملفّ.
   */
  onBack?: () => void;
  /** يُطفأ دون أن تُفكّ الشاشة: «آثارنا» عدسةٌ في تبويب اللحظات تتبدّل ولا تُغلق. */
  enabled?: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const shift = useRef(new Animated.Value(0)).current;
  const from = useRef<"right" | "left" | null>(null);
  const [side, setSide] = useState<"right" | "left">("right");
  const sizes = useRef({ width, enabled });
  sizes.current.width = width;
  sizes.current.enabled = enabled;

  const back = () => {
    if (onBack) onBack();
    else if (router.canGoBack()) router.back();
    else router.replace(fallback as never);
  };
  const go = useRef(back);
  go.current = back;
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (event, gesture) => {
        if (!sizes.current.enabled) return false;
        const w = sizes.current.width;
        /*
          موضعُ البداية = الموضعُ الآن ناقصَ ما قُطع. لا `gesture.x0`: ذاك لا يُملأ
          إلا بعد أن يُمنح المستجيب، فهو هنا صفرٌ أو بقيّةُ السحبة السابقة — فكان
          فحصُ الحافّة يقرأ ما لا معنى له، والرجوعُ لا يعمل من الحافّتين.
        */
        const x0 = gesture.moveX - gesture.dx;
        const side = x0 >= w - EDGE ? "right" : x0 <= EDGE ? "left" : null;
        if (!side) return false;
        const inward = side === "right" ? gesture.dx < -8 : gesture.dx > 8;
        if (!inward || Math.abs(gesture.dx) < Math.abs(gesture.dy) * 1.5) return false;
        from.current = side;
        setSide(side);
        return true;
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_event, gesture) => {
        const value = from.current === "right" ? Math.min(0, gesture.dx) : Math.max(0, gesture.dx);
        // رجوعٌ بعينه: سهمٌ يتبع الإصبع بقدرٍ والشاشةُ ثابتة (القاعدة ٣١٤).
        shift.setValue(onBackRef.current ? Math.max(-ARROW_REACH, Math.min(ARROW_REACH, value)) : value);
      },
      onPanResponderRelease: (_event, gesture) => {
        const w = sizes.current.width;
        const distance = Math.abs(gesture.dx);
        const fast = Math.abs(gesture.vx) > 0.6;
        if (onBackRef.current) {
          /*
            رجوعٌ بعينه يبدّل ما في الشاشة نفسها (عدسةُ «آثارنا») أو يدفع شاشةً فوقها — لا
            شاشةَ تحتها تنكشف. فإن انزلقت الشاشةُ مع الإصبع رأى صاحبُها تحتها صفحةً بيضاء
            (القاعدة ٣١٤): تبقى مكانها، وسهمٌ من الحافّة يقول إنّ الإفلاتَ رجوع.
          */
          Animated.timing(shift, { toValue: 0, duration: 140, useNativeDriver: true }).start();
          if (distance > ARROW_GO || (fast && distance > 30)) go.current();
        } else if (distance > w / 3 || (fast && distance > 40)) {
          const to = from.current === "right" ? -w : w;
          Animated.timing(shift, { toValue: to, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() => {
            go.current();
            // الشاشةُ قد تُعاد من التاريخ لاحقاً: تُردّ إلى مكانها خفيةً.
            requestAnimationFrame(() => shift.setValue(0));
          });
        } else {
          Animated.spring(shift, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
        }
        from.current = null;
      },
      onPanResponderTerminate: () => {
        from.current = null;
        Animated.spring(shift, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
      },
    }),
  ).current;

  if (onBack) {
    const reach = side === "right" ? [-ARROW_REACH, 0] : [0, ARROW_REACH];
    const opacity = shift.interpolate({
      inputRange: side === "right" ? [-ARROW_GO, -8, 0] : [0, 8, ARROW_GO],
      outputRange: side === "right" ? [1, 0.4, 0] : [0, 0.4, 1],
      extrapolate: "clamp",
    });
    return (
      <View {...pan.panHandlers} style={{ flex: 1 }}>
        {children}
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: "45%",
            [side]: -44,
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.chrome,
            opacity,
            transform: [
              { translateX: shift.interpolate({ inputRange: reach, outputRange: reach, extrapolate: "clamp" }) },
              // السهمُ يشير إلى الحافّة التي جاء منها.
              { rotate: side === "right" ? "180deg" : "0deg" },
            ],
          }}
        >
          <BackIcon size={20} color={colors.chromeInk} />
        </Animated.View>
      </View>
    );
  }

  return (
    <Animated.View {...pan.panHandlers} style={{ flex: 1, transform: [{ translateX: shift }] }}>
      {children}
    </Animated.View>
  );
}
