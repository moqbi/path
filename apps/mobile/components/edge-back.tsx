import { useRef } from "react";
import { Animated, Easing, PanResponder, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";

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
export function EdgeBack({ fallback, children }: { fallback: string; children: React.ReactNode }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const shift = useRef(new Animated.Value(0)).current;
  const from = useRef<"right" | "left" | null>(null);
  const sizes = useRef({ width });
  sizes.current.width = width;

  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace(fallback as never);
  };
  const go = useRef(back);
  go.current = back;

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (event, gesture) => {
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
        return true;
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_event, gesture) => {
        const value = from.current === "right" ? Math.min(0, gesture.dx) : Math.max(0, gesture.dx);
        shift.setValue(value);
      },
      onPanResponderRelease: (_event, gesture) => {
        const w = sizes.current.width;
        const distance = Math.abs(gesture.dx);
        const fast = Math.abs(gesture.vx) > 0.6;
        if (distance > w / 3 || (fast && distance > 40)) {
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

  return (
    <Animated.View {...pan.panHandlers} style={{ flex: 1, transform: [{ translateX: shift }] }}>
      {children}
    </Animated.View>
  );
}
