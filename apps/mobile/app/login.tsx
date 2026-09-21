import { useEffect, useRef, useState } from "react";
import { View, Pressable, Animated, Easing, Keyboard, Platform, useWindowDimensions } from "react-native";
import { Text, TextInput } from "../components/type";
import Svg, {
  Defs,
  Ellipse,
  Path,
  Polygon,
  RadialGradient,
  Stop,
} from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  appleReady,
  finishGoogle,
  googleReady,
  signInWithApple,
  useGoogle,
} from "../lib/providers";
import { AthrMark, AthrWordmark, TAGLINE_AR, TAGLINE_EN } from "../components/brand";
import { BackIcon } from "../components/icons";
import { useSession } from "../lib/session";
import { brandGradient, colors } from "../theme/tokens";

type Phase = "intro" | "leaving" | "form";

/**
 * المقدّمة مرةً واحدة لكل تشغيل.
 *
 * الويب يكتبها في `sessionStorage` — «جلسة متصفح». ومكافئها هنا متغيّرٌ
 * في وحدة الملف: يعيش ما دام التطبيق حيّاً ويذهب بإغلاقه. والمخزن الدائم
 * كان سيعرضها مرةً واحدة في العمر، وهذا غير ما في الويب.
 */
let introSeen = false;

function usePhases(): Phase {
  const [phase, setPhase] = useState<Phase>("intro");

  useEffect(() => {
    if (introSeen) {
      setPhase("form");
      return;
    }

    const leave = setTimeout(() => setPhase("leaving"), 2000);
    const done = setTimeout(() => {
      setPhase("form");
      introSeen = true;
    }, 3100);

    return () => {
      clearTimeout(leave);
      clearTimeout(done);
    };
  }, []);

  return phase;
}

/**
 * ارتفاع لوحة المفاتيح.
 *
 * الشاشة ممتدّة إلى الحوافّ (edge-to-edge في SDK 54)، ومعها لا يقلّص
 * أندرويد النافذة عند ظهور اللوحة مهما كان `adjustResize` — فالحقول
 * تبقى تحتها. فتُقاس اللوحة بنفسها وتُرفع بها الحشوة السفلى، وهذا يعمل
 * على النظامين سواء. و`will` على iOS تسبق الحركة فترتفع الحقول معها،
 * و`did` وحدها على أندرويد.
 */
function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const ios = Platform.OS === "ios";
    const show = Keyboard.addListener(ios ? "keyboardWillShow" : "keyboardDidShow", (event) =>
      setHeight(event.endCoordinates.height),
    );
    const hide = Keyboard.addListener(ios ? "keyboardWillHide" : "keyboardDidHide", () =>
      setHeight(0),
    );

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height;
}

/* منحنيات الويب نفسها: `ease` هو cubic-bezier(.25,.1,.25,1). */
const EASE = Easing.bezier(0.25, 0.1, 0.25, 1);
const INTRO_OUT = Easing.bezier(0.3, 0, 0.2, 1);
const FORM_IN = Easing.bezier(0.2, 0.8, 0.3, 1);

/**
 * الخلفية: لا تتحرّك أبداً — هي التي تربط المراحل الثلاث ببعضها.
 *
 * في الويب تدرّجان فوق بعضهما وتلّان بـ`clipPath`. ولا تدرّجَ شعاعياً
 * ولا `clipPath` في React Native، فيُرسمان بـSVG بنفس الأرقام:
 * - الشعاعيّ `120% 60% at 85% 18%` قطعٌ ناقص نصفاه ١٢٠٪ من العرض و٦٠٪
 *   من الارتفاع، مركزه عند (٨٥٪، ١٨٪)، وتدرّجه إلى الشفافية عند ٦٠٪ من
 *   نصف القطر — وهي نسبةٌ من صندوق القطع نفسه، فتُكتب `offset="0.6"`.
 * - التلّان مضلّعان بنفس نقاط `polygon()` على شبكة ١٠٠×١٠٠
 *   (`preserveAspectRatio="none"`)، فالنسب تبقى نسباً.
 */
function Sky() {
  const { width, height } = useWindowDimensions();

  return (
    <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }} pointerEvents="none">
      {/* linear-gradient(180deg,#16293a 0%,#2c4055 30%,#7b6a63 62%,#3d3a3a 78%,#171d24 100%) */}
      <LinearGradient
        colors={["#16293a", "#2c4055", "#7b6a63", "#3d3a3a", "#171d24"]}
        locations={[0, 0.3, 0.62, 0.78, 1]}
        style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }}
      />

      <Svg width={width} height={height} style={{ position: "absolute", top: 0, left: 0 }}>
        <Defs>
          <RadialGradient id="loginGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#ffc478" stopOpacity={0.55} />
            <Stop offset="0.6" stopColor="#ffc478" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse
          cx={width * 0.85}
          cy={height * 0.18}
          rx={width * 1.2}
          ry={height * 0.6}
          fill="url(#loginGlow)"
        />
      </Svg>

      {/* التلّ الأعلى: ارتفاعه ١٩٠ وقاعدته عند ٢٢٪ من أسفل الشاشة. */}
      <View style={{ position: "absolute", left: 0, right: 0, bottom: height * 0.22, height: 190, opacity: 0.55 }}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <Polygon
            points="0,62 18,30 34,55 52,18 72,48 88,26 100,46 100,100 0,100"
            fill="#2b3a48"
          />
        </Svg>
      </View>

      {/* والتلّ الأقرب: ارتفاعه ٣٠٠ من أسفل الشاشة. */}
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 300 }}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <Polygon
            points="0,55 14,32 30,52 48,22 66,46 84,28 100,50 100,100 0,100"
            fill="#1a2029"
          />
        </Svg>
      </View>
    </View>
  );
}

const PROVIDERS = [
  { key: "apple", label: "Apple", mark: <AppleMark /> },
  { key: "google", label: "Google", mark: <GoogleMark /> },
  { key: "facebook", label: "Facebook", mark: <FacebookMark /> },
];

const FIELD = {
  height: 52,
  borderRadius: 12,
  paddingHorizontal: 16,
  fontSize: 14.5,
  backgroundColor: "rgba(247,245,239,.1)",
  borderWidth: 1,
  borderColor: "rgba(247,245,239,.22)",
  color: "#f7f5ef",
  textAlign: "right",
} as const;

/**
 * الدخول على ثلاث مراحل فوق خلفية ثابتة: يدخل الشعار والعبارتان، ثم
 * يغادران بارتفاع وتلاشٍ، ثم تدخل خيارات الدخول من الأسفل.
 *
 * والمقدّمة مرفوعةٌ من السياق (`position: absolute`) كما في الويب: هناك
 * تصير كذلك عند ظهور النموذج، فلا تدفع ما تحتها.
 */
export default function Login() {
  const router = useRouter();
  const { deleted } = useLocalSearchParams<{ deleted?: string }>();
  const phase = usePhases();
  const keyboard = useKeyboardHeight();
  const signIn = useSession((s) => s.signIn);
  const adopt = useSession((s) => s.adopt);

  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(
    // العودة إلى هذه الشاشة بعد الحذف تحتاج جملة تؤكد أن ما طُلب قد تمّ.
    deleted === "1" ? "حُذف حسابك وكل ما فيه. تسعدنا عودتك متى شئت." : null,
  );

  /*
     قوقل يحتاج خطّافاً يفتح صفحتَه ويردّ الرمز، وآبل تُنجزها في نافذةٍ
     من النظام. وكلاهما ينتهي إلى الباب نفسه: رمزٌ يذهب إلى خادمنا
     فيتحقّق منه ويُصدر جلستنا.
  */
  const [, googleAnswer, promptGoogle] = useGoogle();

  useEffect(() => {
    if (googleAnswer?.type !== "success") return;
    const idToken = googleAnswer.params?.id_token;
    if (!idToken) return;

    setPending(true);
    finishGoogle(idToken)
      .then((user) => {
        adopt(user);
        router.replace("/");
      })
      .catch((problem: unknown) =>
        setError(problem instanceof Error ? problem.message : "تعذّر الدخول بقوقل"),
      )
      .finally(() => setPending(false));
  }, [googleAnswer, adopt, router]);

  /** ما يجري عند ضغط زرّ مزوّد. */
  async function withProvider(key: string) {
    setError(null);
    setNotice(null);

    if (key === "facebook") {
      setNotice("الدخول بفيسبوك يحتاج تسجيل التطبيق عنده. استخدم البريد أو المزوّدين الآخرين.");
      return;
    }

    if (key === "google") {
      if (!googleReady()) {
        setNotice("الدخول بقوقل غير مفعّل في هذه النسخة.");
        return;
      }
      await promptGoogle();
      return;
    }

    setPending(true);
    try {
      adopt(await signInWithApple());
      router.replace("/");
    } catch (problem) {
      // إلغاءُ المستخدم ليس خطأً يُعرض: أغلق النافذة وانتهى.
      const text = problem instanceof Error ? problem.message : "";
      if (!/cancel/i.test(text)) setError(text || "تعذّر الدخول بحساب آبل");
    } finally {
      setPending(false);
    }
  }

  const introVisible = phase === "intro";
  const formVisible = phase === "form";

  const introFade = useRef(new Animated.Value(1)).current;
  const introLift = useRef(new Animated.Value(0)).current;
  const formFade = useRef(new Animated.Value(0)).current;
  const formRise = useRef(new Animated.Value(26)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(introFade, {
        toValue: introVisible ? 1 : 0,
        duration: 800,
        easing: EASE,
        useNativeDriver: true,
      }),
      Animated.timing(introLift, {
        toValue: introVisible ? 0 : phase === "leaving" ? -28 : -40,
        duration: 900,
        easing: INTRO_OUT,
        useNativeDriver: true,
      }),
      Animated.timing(formFade, {
        toValue: formVisible ? 1 : 0,
        duration: 700,
        delay: 120,
        easing: EASE,
        useNativeDriver: true,
      }),
      Animated.timing(formRise, {
        toValue: formVisible ? 0 : 26,
        duration: 800,
        delay: 120,
        easing: FORM_IN,
        useNativeDriver: true,
      }),
    ]).start();
  }, [phase, introVisible, formVisible, introFade, introLift, formFade, formRise]);

  async function submit() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await signIn(email, password);
      router.replace("/");
    } catch (problem) {
      // رسالةٌ واحدة للحالتين: أيُّ بريدٍ مسجَّل ليس خبراً يُعطى.
      setError(problem instanceof Error ? problem.message : "تعذّر الدخول");
    } finally {
      setPending(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#171d24" }}>
      <Sky />

      {/*
        المقدّمة مرفوعةٌ من السياق، والخيارات في الأسفل فوق حشوة ٤٠ —
        وترتفع باللوحة حين تظهر.
      */}
      <View
        style={{
          flex: 1,
          paddingHorizontal: 24,
          paddingTop: 64,
          paddingBottom: keyboard > 0 ? keyboard + 16 : 40,
          justifyContent: "flex-end",
        }}
      >
        {/* المقدّمة: تدخل من الأعلى ثم تغادر إلى الأعلى. */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 64,
            left: 24,
            right: 24,
            paddingTop: 24,
            alignItems: "center",
            opacity: introFade,
            transform: [{ translateY: introLift }],
          }}
        >
          <AthrMark size={76} />
          {/*
            الاسم كاملاً كما هو في المتجرين، بكلمتين لا بكلمة:
            «ATHAR» بلون الورق و«Moments» أصغرَ بكهرمانِ العلامة على
            خطّ قاعدتها. وعرضُه أضيق من كلمتين متساويتين، فيتّسع له
            ٣٢٠ بلا تصغيرٍ ولا كسرِ سطر.
          */}
          <View style={{ marginTop: 20 }}>
            <AthrWordmark size={30} color="#f7f5ef" />
          </View>
          <Text style={{ marginTop: 20, fontSize: 15, fontWeight: "500", color: "#f0ece4" }}>
            {TAGLINE_AR}
          </Text>
          <Text
            style={{
              marginTop: 6,
              fontSize: 10.5,
              lineHeight: 17,
              textAlign: "center",
              color: "#b9b2a8",
              letterSpacing: 1.05,
              writingDirection: "ltr",
            }}
          >
            {TAGLINE_EN}
          </Text>
        </Animated.View>

        {/*
          العلامة في أعلى الشاشة: الشعار أوّل ما يُرى، والخيارات في
          أسفلها حيث يصل الإبهام. وتظهر مع الخيارات بالحركة نفسها.
          وتغيب ما دامت اللوحة مفتوحة: هي مرفوعةٌ من السياق فلا تنزاح
          بارتفاع الحقول، وبقاؤها يعني حقلاً تحت شعار.
        */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 64,
            left: 24,
            right: 24,
            alignItems: "center",
            opacity: keyboard > 0 ? 0 : formFade,
          }}
        >
          <AthrMark size={96} />
          <View style={{ marginTop: 12 }}>
            <AthrWordmark size={26} color="#f7f5ef" />
          </View>
          <Text style={{ marginTop: 8, fontSize: 13, color: "#cbc5bb" }}>{TAGLINE_AR}</Text>
        </Animated.View>

        {/* خيارات الدخول: تدخل من الأسفل بعد مغادرة المقدّمة. */}
        <Animated.View
          pointerEvents={formVisible ? "auto" : "none"}
          style={{ opacity: formFade, transform: [{ translateY: formRise }] }}
        >
          {showEmail ? (
            <View style={{ gap: 10 }}>
              <Pressable
                onPress={() => setShowEmail(false)}
                style={{
                  marginBottom: 4,
                  // «البداية» في واجهةٍ عربية هي اليمين، والشجرة كلها
                  // `rtl` فتكفي `flex-start`.
                  alignSelf: "flex-start",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <BackIcon size={15} color="#b9b2a8" />
                <Text style={{ fontSize: 12.5, color: "#b9b2a8" }}>كل الخيارات</Text>
              </Pressable>

              <TextInput
                style={FIELD}
                value={email}
                onChangeText={setEmail}
                placeholder="البريد"
                // لون المُلمِّح في الويب لون المتصفح الافتراضي: حبرٌ باهت
                // على الأرضية نفسها.
                placeholderTextColor="rgba(247,245,239,.5)"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="emailAddress"
              />
              <TextInput
                style={FIELD}
                value={password}
                onChangeText={setPassword}
                placeholder="كلمة المرور"
                placeholderTextColor="rgba(247,245,239,.5)"
                secureTextEntry
                textContentType="password"
                onSubmitEditing={submit}
              />

              {error ? (
                <Text
                  accessibilityRole="alert"
                  style={{ fontSize: 12.5, fontWeight: "500", color: "#ff9d84", textAlign: "right" }}
                >
                  {error}
                </Text>
              ) : null}

              <BrandButton onPress={submit} disabled={pending} style={{ marginTop: 8 }}>
                <Text style={{ fontSize: 15.5, fontWeight: "700", color: colors.onBrand }}>
                  {pending ? "لحظة…" : "دخول"}
                </Text>
              </BrandButton>

              {/* من نسي كلمته لا يستطيع الدخول ليطلبها، فبابُها هنا. */}
              <Pressable onPress={() => router.push("/forgot" as never)}>
                <Text
                  style={{ fontSize: 12.5, fontWeight: "500", color: "rgba(247,245,239,.72)", textAlign: "center", paddingVertical: 6 }}
                >
                  نسيت كلمة المرور؟
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: "row", gap: 10 }}>
                {PROVIDERS.filter((provider) => provider.key !== "apple" || appleReady()).map((provider) => (
                  <Pressable
                    key={provider.key}
                    accessibilityRole="button"
                    accessibilityLabel={`المتابعة بحساب ${provider.label}`}
                    disabled={pending}
                    onPress={() => void withProvider(provider.key)}
                    style={{
                      flex: 1,
                      height: 54,
                      borderRadius: 12,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "rgba(247,245,239,.94)",
                      borderWidth: 1,
                      borderColor: "rgba(247,245,239,.3)",
                    }}
                  >
                    {provider.mark}
                  </Pressable>
                ))}
              </View>

              <BrandButton onPress={() => setShowEmail(true)} style={{ marginTop: 4 }}>
                <Text style={{ fontSize: 15, fontWeight: "700", color: colors.onBrand }}>
                  المتابعة بالبريد
                </Text>
              </BrandButton>

              {notice ? (
                <Text
                  accessibilityRole="text"
                  style={{
                    marginTop: 4,
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    fontSize: 12,
                    lineHeight: 19.5,
                    textAlign: "right",
                    backgroundColor: "rgba(14,26,36,.6)",
                    color: "#e8e2d8",
                  }}
                >
                  {notice}
                </Text>
              ) : null}
            </View>
          )}
        </Animated.View>
      </View>
    </View>
  );
}

/**
 * الفعل الأساسي بتدرّج العلامة.
 *
 * في الويب `linear-gradient(135deg,…)` — زاويةٌ حقيقية، وهنا نقطتا بداية
 * ونهاية بإحداثيات الصندوق: الزاوية العليا اليسرى إلى السفلى اليمنى.
 * على زرٍّ عرضه أضعاف ارتفاعه يكون محور التدرّج أفقيّ الميل في الحالتين.
 */
function BrandButton({
  onPress,
  disabled,
  style,
  children,
}: {
  onPress: () => void;
  disabled?: boolean;
  style?: object;
  children: React.ReactNode;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[{ opacity: disabled ? 0.6 : 1 }, style]}>
      <LinearGradient
        colors={[brandGradient[0], brandGradient[1]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ height: 54, borderRadius: 12, alignItems: "center", justifyContent: "center" }}
      >
        {children}
      </LinearGradient>
    </Pressable>
  );
}

/* شعارات المزوّدين — أشكال مبسّطة، بلا استعمال علاماتهم الرسمية. */
function AppleMark() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="#0e1a24">
      <Path d="M16.4 12.7c0-2.4 2-3.6 2.1-3.6-1.1-1.7-2.9-1.9-3.6-1.9-1.5-.2-3 .9-3.8.9-.8 0-2-.9-3.3-.8-1.7 0-3.2 1-4.1 2.5-1.7 3-.4 7.5 1.3 9.9.8 1.2 1.8 2.5 3.1 2.5 1.2 0 1.7-.8 3.2-.8s1.9.8 3.2.8c1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8-.1 0-2.4-.9-2.4-3.6ZM14 5.6c.7-.8 1.1-2 1-3.1-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.6 2.9-1.4Z" />
    </Svg>
  );
}
function GoogleMark() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.4Z" />
      <Path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Z" />
      <Path fill="#FBBC05" d="M6.4 14a6 6 0 0 1 0-3.8V7.6H3.1a10 10 0 0 0 0 8.9L6.4 14Z" />
      <Path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.8-2.8A10 10 0 0 0 3.1 7.6l3.3 2.6C7.2 7.8 9.4 5.9 12 5.9Z" />
    </Svg>
  );
}
function FacebookMark() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="#1877F2">
      <Path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12Z" />
    </Svg>
  );
}
