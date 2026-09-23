import { useEffect, useRef, useState } from "react";
import { View, Pressable, Modal, Animated, Easing, Dimensions } from "react-native";
import Svg, { Path } from "react-native-svg";
import { Text } from "./type";
import { measureSpot, type Rect } from "./spot";
import { getItem, setItem } from "../lib/store";
import { colors } from "../theme/tokens";

/**
 * الجولة تُعرض مرّةً لكل جهاز. والمفتاحُ بنسخةٍ (`v2`): من رأى النافذة
 * القديمة يرى الجولة مرّةً — هي شيءٌ آخر لا الشيءُ نفسه مكرّراً.
 */
const KEY = "athr:tour:v2";

/**
 * خطواتُ الجولة: هدفٌ على الشاشة وسطران عنه.
 *
 * بالترتيب الذي تُقرأ به الشاشة: اللحظات، ثمّ بابُها المخفيّ، ثمّ زرُّ
 * النشر، ثمّ بقيّةُ التبويبات من اليمين إلى اليسار.
 */
const STEPS: { spot: string; title: string; body: string }[] = [
  {
    spot: "tab.index",
    title: "اللحظات",
    body: "خطّك الزمنيّ: لحظاتك ولحظات أصدقائك، الأحدث أولاً — بلا خوارزميةٍ ترتّبها.",
  },
  {
    spot: "tab.index",
    title: "اضغط عليه مطوّلاً",
    body: "ضغطةٌ مطوّلة على «اللحظات» تفتح بابين: لحظاتك الخاصة التي لا يراها غيرك، و«آثارنا» — ما بينك وبين كل صديق.",
  },
  {
    spot: "compose",
    title: "انشر لحظة",
    body: "الزائد يفتح قوساً: خاطرة، صورة، مكان، أغنية، نوم، صحو. وعند النشر تختار من يرى: كل دائرتك، أو تصنيفاً منها، أو أشخاصاً بأعيانهم.",
  },
  {
    spot: "tab.circle",
    title: "الأصدقاء",
    body: "دائرتك: مئةٌ وخمسون لا أكثر، ولا يُشترى مقعدٌ فيها. لا بحث ولا استكشاف — تُضيف من أعطاك رابط ملفه، ومن المقترحين من أصدقاء أصدقائك. ومنها محادثاتك.",
  },
  {
    spot: "tab.notifications",
    title: "الإشعارات",
    body: "من تفاعل مع لحظتك، ومن علّق، ومن أضافك أو أهداك — ونقطةٌ على الجرس حين يجدّ شيء.",
  },
  {
    spot: "tab.store",
    title: "المتجر",
    body: "إطاراتٌ وتمائمُ وثيماتٌ تُلبسها ملفّك، بالنقاط. كلُّ صنفٍ يُرى قبل شرائه — ولا صناديقَ عشوائية.",
  },
  {
    spot: "tab.me",
    title: "أنا",
    body: "ملفّك: الغلافُ والصورة والنبذة وما تلبسه. ومنه الإعدادات والخصوصية، ومشاركةُ رابط ملفّك.",
  },
];

/** حولَ الهدف فراغٌ يتنفّس فيه — الدائرة لا تلتصق بحوافّه. */
const PAD = 14;

/**
 * جولة أوّل فتح — **تُري لا تحكي**.
 *
 * كانت نافذةً من الأسفل بخمس شرائح تصف الشاشة وصفاً: «تبويب اللحظات…»
 * والقارئُ لا يعرف أيَّها يُقصد. صارت الشاشةُ نفسها هي الشرح: تُعتَم
 * قليلاً، وتنفتح دائرةٌ على التبويب المقصود، وفوقه سطران عنه — فيعرف
 * أين هو قبل أن يعرف ما هو.
 *
 * والدائرةُ **ثقبٌ حقيقيّ** في الحجاب (`Path` بقاعدة `evenodd`): التبويبُ
 * تحتها يُرى بألوانه لا مغطّىً بطبقةٍ فاتحة.
 */
export function Tour() {
  const [step, setStep] = useState<number | null>(null);
  const [hole, setHole] = useState<Rect | null>(null);
  const fade = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    void getItem(KEY).then((seen) => {
      // مهلةٌ قصيرة: الشريطُ السفليّ يُرسم بعد الشاشة، ولا دائرة بلا هدف.
      if (seen !== "1") setTimeout(() => setStep(0), 700);
    });
  }, []);

  // كلُّ خطوةٍ تقيس هدفها ساعتها، ثمّ تظهر.
  useEffect(() => {
    if (step === null) return;
    let alive = true;
    fade.setValue(0);
    const id = STEPS[step].spot;
    void measureSpot(id).then((rect) => {
      if (!alive) return;
      // التبويبُ أيقونةٌ وتحتها اسمُه: الدائرةُ تحتضن الاثنين لا الأيقونة وحدها.
      setHole(rect && id.startsWith("tab.") ? { ...rect, height: rect.height + 16 } : rect);
      Animated.timing(fade, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
    return () => {
      alive = false;
    };
  }, [step, fade]);

  // حلقةٌ تنبض حول الدائرة: العينُ تذهب إلى ما يتحرّك.
  useEffect(() => {
    if (step === null) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [step, pulse]);

  async function close() {
    await setItem(KEY, "1");
    setStep(null);
  }

  if (step === null) return null;

  const screen = Dimensions.get("window");
  const current = STEPS[step];
  const last = step === STEPS.length - 1;

  const circle = hole
    ? {
        cx: hole.x + hole.width / 2,
        cy: hole.y + hole.height / 2,
        r: Math.max(hole.width, hole.height) / 2 + PAD,
      }
    : null;

  // الحجابُ مستطيلُ الشاشة وفيه ثقبٌ دائريّ — قوسان يرسمان الدائرة.
  const veil = circle
    ? `M0 0H${screen.width}V${screen.height}H0Z ` +
      `M${circle.cx - circle.r} ${circle.cy}` +
      `a${circle.r} ${circle.r} 0 1 0 ${circle.r * 2} 0` +
      `a${circle.r} ${circle.r} 0 1 0 ${-circle.r * 2} 0Z`
    : `M0 0H${screen.width}V${screen.height}H0Z`;

  /*
    النافذةُ فوق الهدف إن كان في النصف الأسفل — والأهدافُ كلُّها في
    الشريط السفليّ أو فوقه بقليل — وتحته إن كان في الأعلى.
  */
  const below = circle ? circle.cy < screen.height / 2 : false;
  const cardStyle = circle
    ? below
      ? { top: circle.cy + circle.r + 18 }
      : { bottom: screen.height - (circle.cy - circle.r) + 18 }
    : { top: screen.height / 2 - 110 };

  return (
    <Modal transparent animationType="none" onRequestClose={() => void close()} statusBarTranslucent>
      <Animated.View style={{ flex: 1, opacity: fade }}>
        {/* تعتيمٌ خفيف لا ظلام: الشاشةُ تبقى مقروءةً حول الدائرة. */}
        <Svg width={screen.width} height={screen.height} style={{ position: "absolute" }}>
          <Path d={veil} fill="rgba(14,26,36,0.62)" fillRule="evenodd" />
        </Svg>

        {circle ? (
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: circle.cx - circle.r,
              top: circle.cy - circle.r,
              width: circle.r * 2,
              height: circle.r * 2,
              borderRadius: circle.r,
              borderWidth: 2,
              borderColor: colors.gold,
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] }),
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] }) }],
            }}
          />
        ) : null}

        <View
          style={{
            position: "absolute",
            left: 20,
            right: 20,
            ...cardStyle,
            borderRadius: 20,
            backgroundColor: colors.card,
            padding: 18,
            shadowColor: "#0E1A24",
            shadowOpacity: 0.25,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 6 },
            elevation: 10,
          }}
        >
          <Text face="display" style={{ color: colors.ink, fontSize: 17, fontWeight: "700", marginBottom: 6 }}>
            {current.title}
          </Text>
          <Text style={{ color: colors.ink2, fontSize: 13.5, lineHeight: 23 }}>{current.body}</Text>

          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 16 }}>
            {/* نقاطُ الخطوات: أين أنت منها. */}
            <View style={{ flex: 1, flexDirection: "row", gap: 5 }}>
              {STEPS.map((_, index) => (
                <View
                  key={index}
                  style={{
                    width: index === step ? 16 : 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: index === step ? colors.clay : colors.line,
                  }}
                />
              ))}
            </View>

            {last ? null : (
              <Pressable onPress={() => void close()} hitSlop={10} style={{ paddingHorizontal: 12, height: 40, justifyContent: "center" }}>
                <Text style={{ color: colors.muted, fontSize: 13 }}>تخطَّ</Text>
              </Pressable>
            )}
            <Pressable
              onPress={() => (last ? void close() : setStep(step + 1))}
              style={{ height: 40, paddingHorizontal: 20, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: colors.clay }}
            >
              <Text style={{ color: colors.onBrand, fontSize: 13.5, fontWeight: "700" }}>
                {last ? "ابدأ" : "التالي"}
              </Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}
