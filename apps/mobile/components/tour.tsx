import { useEffect, useRef, useState } from "react";
import { View, Pressable, Animated, Easing, BackHandler, useWindowDimensions } from "react-native";
import { create } from "zustand";
import Svg, { Path } from "react-native-svg";
import { Text } from "./type";
import { measureSpot, type Rect } from "./spot";
import { useRouter } from "expo-router";
import { api } from "../lib/api";
import { useFan } from "./composer-fan";
import { getItem, setItem } from "../lib/store";
import { colors } from "../theme/tokens";

/**
 * الجولة تُعرض مرّةً لكل جهاز. والمفتاحُ بنسخةٍ (`v4`): الجولةُ الجديدة
 * شيءٌ آخر، فمن رأى القديمة يراها مرّةً.
 *
 * و**نقاطٌ لا نقطتان رأسيّتان**: المخزنُ الآمن لا يقبل في المفتاح إلا
 * الحروفَ والأرقام و`.` و`-` و`_`، ويرمي على غيرها. فكان `athr:tour:v3`
 * يُسقط القراءةَ فلا تبدأ الجولةُ وحدها، ويُسقط الكتابةَ في `close()` قبل
 * أن تُغلق — فـ«تخطَّ» و«ابدأ» لا يفعلان شيئاً.
 */
const KEY = "athr.tour.v4";
/** الجولةُ السابقة: من رآها رأى التطبيقَ من قبل (القاعدة ٢٤٣). */
const OLD_KEY = "athr.tour.v3";

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
 * خطواتُ الجولة — **بترتيب المالك، وقصيرة**: خطوةٌ أو خطوتان لكلّ تبويب.
 * اللحظات: الزائد (يُفتح قوسُه ولا تُشرح أصنافُه) وآثار+. الأصدقاء: القصصُ والنوت
 * وأبوابُ الإضافة ومن حولك. ثمّ المحادثات، فالمتجر، فـ«أنا»: التعديلُ والإعداداتُ
 * والكتاب. وما زاد يُكتشف في مكانه (القاعدة ٢٨٣).
 */
const STEPS: Step[] = [
  { spot: "compose", route: "/", fan: true, title: "انشر لحظة", body: "من الزائد تنشر لحظاتك: خاطرة، صورة، مكان، أغنية، نومك وصحوتك — ولكلّ لحظةٍ جمهورُها." },
  { spot: "header.plus", route: "/", title: "آثار+", body: "اشتراكٌ بمزايا لك وحدك: شارةُ توثيق، وإيموجي حرّ، وآثارنا، والتخفّي، وأرشيفٌ بلا نهاية، ونقاطٌ شهرية." },
  { spot: "stories", route: "/circle", title: "القصص والنوت", body: "اضغط صورتك: قصةٌ تعيش يوماً، أو نوتٌ — عبارةٌ أو أغنيةٌ فوق صورتك." },
  {
    spot: "circle.add",
    route: "/circle",
    title: "أضف أصدقاءك",
    body: "بالمعرّف أو الاسم الكامل، أو برمزك ورابطك، أو «من حولك» لمن يجلس جنبك. وفعّل تنبيه «من حولك» من الإعدادات ← التنبيهات ليوصلك خبر إذا فتحها أحدٌ قريب منك.",
  },
  { spot: "tab.chats", route: "/messages", title: "المحادثات", body: "رسائلك ومقاطعك الصوتية، ومحادثاتك المفضّلة والمجموعات." },
  { spot: "tab.store", route: "/store", title: "المتجر", body: "تشارمز وإطاراتٌ وثيمات بالنقاط — تُرى قبل شرائها، وتُهدى لصديق." },
  { spot: "me.edit", route: "/me", title: "تعديل الملف", body: "صورتك وغلافُك واسمك ومعرّفك ونبذتك ومدينتك." },
  { spot: "me.settings", route: "/me", title: "الإعدادات", body: "الحساب والتنبيهات والخصوصية: من يرى لحظاتك، والوضع الهادئ، والدعم الفني." },
  { spot: "me.archive", route: "/me", title: "كتابي", body: "أرشيفُ لحظاتك بالشهور، وكتابُ سنتك يومٌ لكل صفحة — تحمّله PDF." },
];

/**
 * خطوةُ الجولة في مخزنٍ لا في حالة المكوّن: «أعد الجولة» في الإعدادات
 * يبدؤها من شاشةٍ أخرى.
 */
const useTour = create<{ step: number | null; first: boolean }>(() => ({ step: null, first: false }));

/** هل الجولةُ ظاهرة؟ — بطاقةُ الإعلان تنتظرها ولا تتزاحم معها. */
export function useTourOn() {
  return useTour((state) => state.step !== null);
}

/** يبدأ الجولةَ من أوّلها — من الإعدادات لمن تخطّاها أو فاتته. */
export function startTour() {
  useTour.setState({ step: 0 });
}

/** يقيس الهدف، ويعيد المحاولة: تبويبٌ فُتح للتوّ قد لا يكون رُسم بعد. */
async function measureSoon(id: string): Promise<Rect | null> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const rect = await measureSpot(id);
    if (rect) return rect;
    await new Promise((done) => setTimeout(done, 200));
  }
  return null;
}

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
  const step = useTour((state) => state.step);
  const setStep = (next: number | null) => useTour.setState({ step: next });
  const screen = useWindowDimensions();
  const [hole, setHole] = useState<Rect | null>(null);
  const fade = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    void Promise.all([
      getItem(KEY).catch(() => null),
      getItem(OLD_KEY).catch(() => null),
    ]).then(([seen, seenOld]) => {
      /*
        مهلةٌ تسبق الجولة: نافذةُ إذن التنبيهات تُطلب مع الدخول، والشريطُ
        السفليّ يُرسم بعد الشاشة — ولا دائرة بلا هدف.
      */
      if (seen !== "1") {
        timer = setTimeout(() => {
          startTour();
          // من رأى الجولة القديمة ليس جديداً: لا يُفتح له ملفُّ الإدارة بعدها.
          useTour.setState({ first: seenOld !== "1" });
        }, 1800);
      }
    });
    return () => clearTimeout(timer);
  }, []);

  // زرُّ الرجوع في أندرويد يُغلقها كما كانت النافذة تُغلق.
  useEffect(() => {
    if (step === null) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [step]);

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
    void settle.then(() => (id ? measureSoon(id) : null)).then((rect) => {
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

  // الإغلاقُ أوّلاً ثمّ الحفظ: مخزنٌ يفشل لا يحبس الشاشة تحت الجولة.
  function close() {
    const first = useTour.getState().first;
    useTour.setState({ step: null, first: false });
    useFan.setState({ open: false });
    router.navigate("/" as never);
    void setItem(KEY, "1").catch(() => {});
    /*
      وبعد أوّل جولةٍ يُفتح ملفُّ حساب الإدارة (القاعدة ٢٤٣): الحسابُ الجديد
      خطُّه الزمنيّ فارغٌ لا صديقَ فيه بعد، ومن وجد شاشةً ميّتة لا يعود.
      الحسابُ مفتوح (القاعدة ٢٢١) فإضافتُه تُقبل في الحال وتملأ الخطّ بأخباره.
      ورقمُه من اللوحة لا من الكود، وبلا حسابٍ لا شيء.
    */
    if (first) {
      void api<{ account: { id: string } | null }>("/v1/site/support")
        .then(({ account }) => {
          if (account) router.push(`/u/${account.id}` as never);
        })
        .catch(() => {});
    }
  }

  if (step === null) return null;

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
    /*
      طبقةٌ في الجذر لا `Modal`: آبل تعرض نافذةً واحدة فوق الشاشة، فإن
      كانت نافذةُ إذن التنبيهات قائمةً ساعةَ تُطلب الجولة سقط عرضُها بصمت
      (القاعدة ١٢٦) — والجولةُ «لا تعمل». والطبقةُ لا تنتظر أحداً.
    */
    <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, elevation: 1000 }}>
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
              <Pressable onPress={() => close()} hitSlop={10} style={{ paddingHorizontal: 12, height: 38, justifyContent: "center" }}>
                <Text style={{ color: "rgba(255,255,255,.75)", fontSize: 13 }}>تخطَّ</Text>
              </Pressable>
            )}
            <Pressable
              onPress={() => (last ? close() : setStep(step + 1))}
              style={{ height: 38, paddingHorizontal: 18, borderRadius: 999, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "#fff" }}
            >
              <Text style={{ color: "#fff", fontSize: 13.5, fontWeight: "700" }}>
                {last ? "ابدأ" : "التالي"}
              </Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}
