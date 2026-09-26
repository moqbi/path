import { useEffect, useRef, useState } from "react";
import { View, Pressable, Modal, Animated, Easing, Dimensions } from "react-native";
import Svg, { Path } from "react-native-svg";
import { Text } from "./type";
import { measureSpot, type Rect } from "./spot";
import { useRouter } from "expo-router";
import { useFan } from "./composer-fan";
import { getItem, setItem } from "../lib/store";
import { colors } from "../theme/tokens";

/**
 * الجولة تُعرض مرّةً لكل جهاز. والمفتاحُ بنسخةٍ (`v3`): الجولةُ الجديدة
 * شيءٌ آخر، فمن رأى القديمة يراها مرّةً.
 */
const KEY = "athr:tour:v3";

type Step = {
  /** هدفُ الدائرة — فارغٌ لخطوةٍ تُقرأ وحدها بلا هدف (الخاتمة). */
  spot?: string;
  title: string;
  body: string;
  /** شاشةٌ تُفتح قبل القياس: الهدفُ فيها لا في الخطّ الزمنيّ. */
  route?: string;
  /** قوسُ النشر مفتوحٌ في هذه الخطوة: أهدافُها أصنافُه. */
  fan?: boolean;
};

/**
 * خطواتُ الجولة — **بترتيب المالك**: النشرُ وكلُّ زرٍّ في قوسه، ثمّ الضغطُ
 * المطوّل على «اللحظات»، ثمّ آثار+، فالمحادثات، فالأصدقاء والقصص، فبقيّةُ
 * التبويبات حتى «أنا» وأزرارها، ثمّ كيف يُضاف الأصدقاء.
 */
const STEPS: Step[] = [
  { spot: "compose", route: "/", title: "انشر لحظة", body: "من الزائد تنشر لحظاتك. اضغطه فينفتح قوسٌ فيه ما تنشره." },
  { spot: "fan.write", route: "/", fan: true, title: "اكتب", body: "خاطرةٌ قصيرة — حتى ٢٥٠ حرفاً — ومعها من كان معك." },
  { spot: "fan.photo", route: "/", fan: true, title: "صورة", body: "من الكاميرا أو ألبومك، ومعها المكان إن شئت." },
  { spot: "fan.place", route: "/", fan: true, title: "مكان", body: "أين أنت الآن: تختار من الأماكن حولك، لا تكتب اسماً." },
  { spot: "fan.music", route: "/", fan: true, title: "أغنية", body: "ما تسمعه الآن، برابطه يُشغَّل من لحظتك." },
  { spot: "fan.sleep", route: "/", fan: true, title: "نوم", body: "ضغطةٌ واحدة: «نمت» — ودائرتك تعرف أنّك نائم." },
  { spot: "fan.wake", route: "/", fan: true, title: "صحيت", body: "وضغطةٌ في الصباح: «صحيت» والساعةُ معها." },
  {
    spot: "tab.index",
    route: "/",
    title: "اضغط «اللحظات» مطوّلاً",
    body: "يفتح بابين: لحظاتك الخاصة التي لا يراها غيرك، و«آثارنا» — ما جمعك بصديقٍ بالإشارة (من مزايا آثار+).",
  },
  { spot: "header.plus", route: "/", title: "آثار+", body: "اشتراكٌ بمزايا لك وحدك: نجمةٌ ووسمُ «داعم»، وإيموجي حرّ، وآثارنا، ونقاطٌ شهرية." },
  { spot: "header.chats", route: "/", title: "المحادثات", body: "رسائلك مع أصدقائك، والرقمُ عليها ما لم تقرأه بعد." },
  {
    spot: "tab.circle",
    route: "/circle",
    title: "الأصدقاء",
    body: "دائرتك: ١٥٠ لا أكثر، متصلٌ وغيرُ متصل. اسحب صديقاً إلى اليمين لمحادثة أو إزالة أو حظر.",
  },
  { spot: "stories", route: "/circle", title: "القصص", body: "صورةٌ أو مقطعٌ يراه أصدقاؤك يوماً ثمّ يذهب. الحلقةُ الملوّنة: فيها ما لم تره." },
  { spot: "tab.notifications", route: "/notifications", title: "الإشعارات", body: "من تفاعل وعلّق وأضافك وأهداك، وأخبارُ آثار. اسحب إشعاراً لتحذفه." },
  { spot: "tab.store", route: "/store", title: "المتجر", body: "تمائمُ وإطاراتٌ وثيمات بالنقاط — كلُّ صنفٍ يُرى قبل شرائه، ولكلٍّ مُدَدُه." },
  { spot: "tab.me", route: "/me", title: "أنا", body: "ملفّك: الغلافُ والصورة والنبذة ولحظاتك." },
  { spot: "me.edit", route: "/me", title: "تعديل الملف", body: "صورتك وغلافُك واسمك ونبذتك ومدينتك." },
  { spot: "me.accessories", route: "/me", title: "إكسسواراتي", body: "ما اشتريته أو أُهدي إليك — تلبسه وتنزعه من هنا." },
  { spot: "me.settings", route: "/me", title: "الإعدادات", body: "الحساب والتنبيهات والخصوصية: من يرى لحظاتك ومن يتفاعل معك." },
  {
    route: "/",
    title: "كيف تضيف أصدقاءك؟",
    body: "لا بحث في آثار. شارك رابط ملفّك من «أنا» ومن يفتحه يضيفك، أو أضف من ظهر في لحظات أصدقائك، أو من «مقترحون» في تبويب الأصدقاء.",
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
  const router = useRouter();
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
    const current = STEPS[step];
    const id = current.spot ?? "";
    /*
      الخطوةُ تفتح شاشتها وقوسَها أوّلاً ثمّ تقيس: الهدفُ في تبويبٍ آخر أو
      داخل القوس، ولا يُقاس قبل أن يُرسم ويقف (القوسُ يطير ٤٢٠ مللي).
    */
    if (current.route) router.navigate(current.route as never);
    useFan.setState({ open: Boolean(current.fan) });
    const settle = new Promise((done) => setTimeout(done, current.fan || current.route ? 520 : 60));
    void settle.then(() => (id ? measureSpot(id) : null)).then((rect) => {
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
    useFan.setState({ open: false });
    router.navigate("/" as never);
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
          <Path d={veil} fill="rgba(8,14,20,0.74)" fillRule="evenodd" />
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

        {/*
          لا نافذةَ بيضاء: السطران يطفوان على التعتيم نفسه بجانب الدائرة —
          **بقرار المالك** — فتبقى الشاشةُ هي الشرح، والكلامُ همسٌ فوقها.
        */}
        <View
          style={{
            position: "absolute",
            left: 24,
            right: 24,
            ...cardStyle,
          }}
        >
          <Text face="display" style={{ color: "#fff", fontSize: 19, fontWeight: "700", marginBottom: 6, textAlign: "right" }}>
            {current.title}
          </Text>
          <Text style={{ color: "rgba(255,255,255,.9)", fontSize: 14, lineHeight: 24, textAlign: "right" }}>{current.body}</Text>

          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 16 }}>
            {/* نقاطُ الخطوات: أين أنت منها. */}
            <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
              {STEPS.map((_, index) => (
                <View
                  key={index}
                  style={{
                    width: index === step ? 14 : 5,
                    height: 5,
                    borderRadius: 3,
                    backgroundColor: index === step ? colors.gold : "rgba(255,255,255,.35)",
                  }}
                />
              ))}
            </View>

            {last ? null : (
              <Pressable onPress={() => void close()} hitSlop={10} style={{ paddingHorizontal: 12, height: 38, justifyContent: "center" }}>
                <Text style={{ color: "rgba(255,255,255,.75)", fontSize: 13 }}>تخطَّ</Text>
              </Pressable>
            )}
            <Pressable
              onPress={() => (last ? void close() : setStep(step + 1))}
              style={{ height: 38, paddingHorizontal: 18, borderRadius: 999, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "#fff" }}
            >
              <Text style={{ color: "#fff", fontSize: 13.5, fontWeight: "700" }}>
                {last ? "ابدأ" : "التالي"}
              </Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}
