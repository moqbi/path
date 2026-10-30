import { useEffect, useRef, useState } from "react";
import { savedInviter } from "../lib/invite-ref";
import { View, Pressable, Animated, Easing, Keyboard, Platform, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text, TextInput } from "../components/type";
import Svg, { Path } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  appleReady,
  finishGoogle,
  googleReady,
  signInWithApple,
  snapReady,
  tiktokReady,
  promptTikTokLogin,
  promptSnapLogin,
  useGoogle,
  useSnap,
  loadProviders,
} from "../lib/providers";
import { AthrWordmark, TAGLINE_AR } from "../components/brand";
import { GlassPanel, LiveStrip, Orbit, SCENE_GROUND, SceneGround } from "../components/login-scene";
import { BackIcon, CheckIcon } from "../components/icons";
import { api } from "../lib/api";
import { openIn } from "../lib/browse";
import { SITE_URL, hasSite } from "@athar/shared";
import { useSession } from "../lib/session";
import { BackToParked } from "../components/accounts-sheet";
import { brandGradient, colors } from "../theme/tokens";

/**
 * حركةُ الدخول مرةً واحدة لكل تشغيل.
 *
 * الويب يكتبها في `sessionStorage` — «جلسة متصفح». ومكافئها هنا متغيّرٌ
 * في وحدة الملف: يعيش ما دام التطبيق حيّاً ويذهب بإغلاقه. ومن خرج ورجع
 * في التشغيل نفسه يجد الشاشة قائمةً بلا انتظار.
 */
let introSeen = false;

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

const RISE = Easing.bezier(0.2, 0.8, 0.2, 1);

const PROVIDERS = [
  { key: "apple", label: "Apple", mark: <AppleMark /> },
  { key: "google", label: "Google", mark: <GoogleMark /> },
  { key: "snap", label: "Snapchat", mark: <SnapMark /> },
  { key: "tiktok", label: "TikTok", mark: <TikTokMark /> },
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
 * المدار والخط الحيّ (القاعدة ٩): الشعار في مداره في الأعلى، وتحته شريطُ
 * خطٍّ زمنيٍّ يمرّ، وخياراتُ الدخول في لوحٍ زجاجيّ حيث يصل الإبهام.
 * وعند أوّل فتحٍ في التشغيل تخرج الرسومُ من الشعار، ثمّ يدخل الشريط،
 * ثمّ يصعد اللوح.
 */
export default function Login() {
  const router = useRouter();
  const { deleted } = useLocalSearchParams<{ deleted?: string }>();
  const [enter] = useState(() => !introSeen);
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const keyboard = useKeyboardHeight();
  const signIn = useSession((s) => s.signIn);
  const adopt = useSession((s) => s.adopt);

  const [showEmail, setShowEmail] = useState(false);
  /*
     بابان في الشاشة نفسها لا شاشتان: من فتحها ليُنشئ حساباً لا يُرسَل
     إلى شاشةٍ أخرى ثمّ يُعاد. وحقلُ الاسم يظهر مع الإنشاء وحده.
  */
  const [newcomer, setNewcomer] = useState(false);
  // الموافقةُ علامةٌ يضعها المستخدم بيده — **بقرار المالك** — لا سطرٌ يُقرأ ويُتجاوز.
  const [agreed, setAgreed] = useState(false);
  const NEED_CONSENT = "ضع علامة الموافقة على الشروط أولاً";
  const [sent, setSent] = useState<string | null>(null);
  const [name, setName] = useState("");
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
  const [snapRequest] = useSnap();
  // زرُّ سناب يتبع الخادم: يظهر حين يكون لها معرّفٌ معتمد، ويختفي حين لا.
  const [snapOn, setSnapOn] = useState(snapReady());
  // وتيك توك كذلك: يظهر حين يكون مفتاحُه وسرُّه على الخادم.
  const [tiktokOn, setTiktokOn] = useState(tiktokReady());
  useEffect(() => {
    void loadProviders().then(() => {
      setSnapOn(snapReady());
      setTiktokOn(tiktokReady());
    });
  }, []);

  useEffect(() => {
    if (googleAnswer?.type !== "success") return;
    const idToken = googleAnswer.params?.id_token;
    if (!idToken) return;

    setPending(true);
    finishGoogle(idToken)
      .then(async (user) => {
        await adopt(user);
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
    if (!agreed) {
      setError(NEED_CONSENT);
      return;
    }

    if (key === "tiktok") {
      setPending(true);
      try {
        const user = await promptTikTokLogin();
        if (user) {
          await adopt(user);
          router.replace("/");
        }
      } catch (problem) {
        setError(problem instanceof Error ? problem.message : "تعذّر الدخول بتيك توك");
      } finally {
        setPending(false);
      }
      return;
    }

    if (key === "snap") {
      if (!snapReady()) {
        setNotice("الدخول بسناب غير مفعّل في هذه النسخة.");
        return;
      }
      setPending(true);
      try {
        const user = await promptSnapLogin(snapRequest);
        if (user) {
          await adopt(user);
          router.replace("/");
        }
      } catch (problem) {
        setError(problem instanceof Error ? problem.message : "تعذّر الدخول بسناب");
      } finally {
        setPending(false);
      }
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
      await adopt(await signInWithApple());
      router.replace("/");
    } catch (problem) {
      // إلغاءُ المستخدم ليس خطأً يُعرض: أغلق النافذة وانتهى.
      const text = problem instanceof Error ? problem.message : "";
      if (!/cancel/i.test(text)) setError(text || "تعذّر الدخول بحساب آبل");
    } finally {
      setPending(false);
    }
  }

  const headFade = useRef(new Animated.Value(enter ? 0 : 1)).current;
  const formFade = useRef(new Animated.Value(enter ? 0 : 1)).current;
  const formRise = useRef(new Animated.Value(enter ? 40 : 0)).current;

  useEffect(() => {
    introSeen = true;
    if (!enter) return;
    Animated.parallel([
      Animated.timing(headFade, { toValue: 1, duration: 800, delay: 450, easing: RISE, useNativeDriver: true }),
      Animated.timing(formFade, { toValue: 1, duration: 800, delay: 900, easing: RISE, useNativeDriver: true }),
      Animated.timing(formRise, { toValue: 0, duration: 900, delay: 900, easing: RISE, useNativeDriver: true }),
    ]).start();
  }, [enter, headFade, formFade, formRise]);

  const headLift = headFade.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });
  // الرأسُ والشريطُ يغيبان ما دامت اللوحة مفتوحة: الحقولُ ترتفع إلى مكانهما.
  const typing = keyboard > 0;
  /*
     نموذجُ البريد أطولُ من الأزرار، والمدارُ والشريطُ معاً لا يتّسعان معه
     على شاشةٍ قصيرة: فيذهب الشريط معه دائماً، والمدارُ على ما دون ٧٦٠ —
     ويبقى الاسمُ والعبارة.
  */
  const longForm = showEmail || sent !== null;
  const compact = longForm && screenHeight < 760;

  async function submit() {
    if (pending) return;
    if (!agreed) {
      setError(NEED_CONSENT);
      return;
    }
    setPending(true);
    setError(null);
    try {
      if (newcomer) {
        /*
           والتسجيل **لا يفتح جلسة**: لا حساب بعدُ حتى يُفتح الرابط،
           فيُولَد هناك ويأخذ رقمَ عضويّته (القاعدة ١٥). فيبقى في هذه
           الشاشة ومعه ما يقول له أين يبحث.
        */
        await api("/v1/auth/register", {
          method: "POST",
          body: JSON.stringify({
            name: name.trim(),
            email: email.trim(),
            password,
            // الداعي من رابطٍ فُتح قبل التسجيل لا من حقل (القاعدة ٢٤٣).
            inviterNo: await savedInviter(),
          }),
        });
        setSent("أرسلنا رابطاً إلى بريدك — افتحه ليُفتح حسابك.");
        return;
      }
      await signIn(email, password);
      router.replace("/");
    } catch (problem) {
      // رسالةٌ واحدة للحالتين: أيُّ بريدٍ مسجَّل ليس خبراً يُعطى.
      setError(problem instanceof Error ? problem.message : newcomer ? "تعذّر التسجيل" : "تعذّر الدخول");
    } finally {
      setPending(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: SCENE_GROUND }}>
      <SceneGround />
      {/* من ضغط «إضافة حساب» ثمّ تراجع يعود إلى حسابه (القاعدة ٣١٦). */}
      <BackToParked />

      <View
        style={{
          flex: 1,
          paddingTop: insets.top + 8,
          paddingBottom: typing ? keyboard + 12 : Math.max(insets.bottom, 12) + 8,
          justifyContent: "flex-end",
        }}
      >
        {typing ? null : (
          <>
            {/* الشعار أوّل ما يُرى (القاعدة ٧)، والمدارُ حوله. */}
            <View style={{ alignItems: "center" }}>
              {compact ? null : <Orbit enter={enter} />}
              <Animated.View
                style={{ alignItems: "center", marginTop: compact ? 12 : -6, opacity: headFade, transform: [{ translateY: headLift }] }}
              >
                <AthrWordmark size={22} color="#f7f5ef" />
                <Text style={{ marginTop: 4, fontSize: 13.5, fontWeight: "600", color: "#d6dde2" }}>{TAGLINE_AR}</Text>
              </Animated.View>
            </View>
            {longForm ? <View style={{ flex: 1 }} /> : <LiveStrip enter={enter} />}
          </>
        )}

        {/* خيارات الدخول: تصعد من الأسفل بعد الشريط. */}
        <Animated.View
          style={{ paddingHorizontal: 12, marginTop: 8, opacity: formFade, transform: [{ translateY: formRise }] }}
        >
          <GlassPanel>
          {sent ? (
            <View style={{ gap: 12 }}>
              <Text
                accessibilityRole="alert"
                style={{
                  fontSize: 13,
                  lineHeight: 22,
                  color: "#e8e2d8",
                  textAlign: "center",
                  backgroundColor: "rgba(14,26,36,.6)",
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 16,
                }}
              >
                {sent}
                {"\n"}
                <Text style={{ fontSize: 11.5, color: "rgba(247,245,239,.62)" }}>
                  إن لم تجد الرسالة في الوارد فانظر في «البريد غير الهامّ».
                </Text>
              </Text>
              <Pressable
                onPress={() => {
                  setSent(null);
                  setNewcomer(false);
                  setPassword("");
                }}
              >
                <Text
                  style={{ fontSize: 12.5, fontWeight: "600", color: "rgba(247,245,239,.86)", textAlign: "center", paddingVertical: 6 }}
                >
                  أكّدتُ — سجّل دخولي
                </Text>
              </Pressable>
            </View>
          ) : showEmail ? (
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

              {newcomer ? (
                <TextInput
                  style={FIELD}
                  value={name}
                  onChangeText={setName}
                  placeholder="اسمك"
                  placeholderTextColor="rgba(247,245,239,.5)"
                  maxLength={40}
                  textContentType="name"
                />
              ) : null}
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
                placeholder={newcomer ? "كلمة المرور — ٨ أحرف فأكثر" : "كلمة المرور"}
                placeholderTextColor="rgba(247,245,239,.5)"
                secureTextEntry
                textContentType={newcomer ? "newPassword" : "password"}
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
                  {pending ? "لحظة…" : newcomer ? "إنشاء حساب" : "دخول"}
                </Text>
              </BrandButton>

              {/*
                 ومن نسي كلمته لا يستطيع الدخول ليطلبها، فبابُها هنا —
                 ولا تُعرض لمن يُنشئ حساباً: لا كلمةَ له بعدُ لينساها.
              */}
              {newcomer ? null : (
                <Pressable onPress={() => router.push("/forgot" as never)}>
                  <Text
                    style={{ fontSize: 12.5, fontWeight: "500", color: "rgba(247,245,239,.72)", textAlign: "center", paddingVertical: 6 }}
                  >
                    نسيت كلمة المرور؟
                  </Text>
                </Pressable>
              )}

              <Pressable
                onPress={() => {
                  setNewcomer((was) => !was);
                  setError(null);
                }}
              >
                <Text
                  style={{ fontSize: 12.5, fontWeight: "600", color: "rgba(247,245,239,.86)", textAlign: "center", paddingVertical: 6 }}
                >
                  {newcomer ? "عندي حساب — سجّل دخولي" : "ما عندي حساب — أنشئ واحداً"}
                </Text>
              </Pressable>
              <Consent agreed={agreed} onToggle={() => { setAgreed((was) => !was); setError(null); }} />
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: "row", gap: 10 }}>
                {PROVIDERS.filter(
                  (provider) =>
                    (provider.key !== "apple" || appleReady()) &&
                    (provider.key !== "snap" || snapOn) &&
                    (provider.key !== "tiktok" || tiktokOn),
                ).map((provider) => (
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

              {/* خطأُ المزوّد يُقرأ هنا: كان يُكتب في نموذج البريد وحده، فيُرى
                  زرُّ سناب «لا يضغط» وهو يفشل بصمت. */}
              {error ? (
                <Text
                  accessibilityRole="alert"
                  style={{ fontSize: 12.5, fontWeight: "500", color: "#ff9d84", textAlign: "center" }}
                >
                  {error}
                </Text>
              ) : null}

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
              <Consent agreed={agreed} onToggle={() => { setAgreed((was) => !was); setError(null); }} />
            </View>
          )}
          </GlassPanel>
        </Animated.View>
      </View>
    </View>
  );
}

/**
 * الموافقةُ على الشروط تحت أبواب الدخول كلّها — شرطُ آبل 1.2 لكل تطبيقٍ فيه
 * محتوى يكتبه الناس: يوافق المستخدم على شروطٍ تقول صراحةً إنّه لا تسامح مع
 * المحتوى المسيء ولا مع المسيئين. والبابُ واحد للبريد والمزوّدين: كلُّها
 * تُنشئ حساباً لمن لا حسابَ له.
 */
function Consent({ agreed, onToggle }: { agreed: boolean; onToggle: () => void }) {
  const link = (title: string, path: string) => (
    <Text
      accessibilityRole="link"
      onPress={() => {
        if (hasSite()) void openIn(`${SITE_URL}${path}`);
      }}
      style={{ color: "#f7f5ef", fontWeight: "700", textDecorationLine: "underline" }}
    >
      {title}
    </Text>
  );
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: agreed }}
      accessibilityLabel="أوافق على شروط الاستخدام وسياسة الخصوصية"
      onPress={onToggle}
      hitSlop={6}
      style={{ marginTop: 6, flexDirection: "row", alignItems: "flex-start", gap: 10 }}
    >
      <View
        style={{
          width: 22,
          height: 22,
          marginTop: 1,
          borderRadius: 6,
          borderWidth: 1.5,
          borderColor: agreed ? colors.clay : "rgba(247,245,239,.6)",
          backgroundColor: agreed ? colors.clay : "transparent",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {agreed ? <CheckIcon size={14} color={colors.onBrand} /> : null}
      </View>
      <Text style={{ flex: 1, minWidth: 0, fontSize: 11.5, lineHeight: 19, color: "rgba(247,245,239,.78)", textAlign: "right" }}>
        أوافق على {link("شروط الاستخدام", "/terms")} و{link("سياسة الخصوصية", "/privacy")}، ولا تسامح مع المحتوى
        المسيء أو المستخدمين المسيئين.
      </Text>
    </Pressable>
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
/**
 * شبحُ سناب — رسمٌ مبسّط بلونه.
 *
 * وفيسبوك ذهب من الشاشة: مفاتيحُه لم تُسجَّل، وزرٌّ لا يعمل أسوأ من
 * زرٍّ غائب. ويعود يوم تُسجَّل.
 */
function SnapMark() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="#FFFC00" stroke="#0E1A24" strokeWidth={1}>
      <Path d="M12 2.6c2.7 0 4.5 2 4.5 4.6 0 .8-.1 1.6-.1 2 .3.2.8.2 1.2 0 .5-.2 1 .1 1.1.5.1.5-.2.9-.9 1.2-.6.3-1.2.4-1.1.9.2.9 2 2.9 3.6 3.3.4.1.5.4.4.7-.2.6-1.4.9-2.3 1-.3 0-.4.3-.5.7 0 .3-.1.6-.5.6-.5 0-1.1-.2-1.9-.1-.8.1-1.5.5-2.2 1.1-.4.3-.9.5-1.3.5s-.9-.2-1.3-.5c-.7-.6-1.4-1-2.2-1.1-.8-.1-1.4.1-1.9.1-.4 0-.5-.3-.5-.6-.1-.4-.2-.7-.5-.7-.9-.1-2.1-.4-2.3-1-.1-.3 0-.6.4-.7 1.6-.4 3.4-2.4 3.6-3.3.1-.5-.5-.6-1.1-.9-.7-.3-1-.7-.9-1.2.1-.4.6-.7 1.1-.5.4.2.9.2 1.2 0 0-.4-.1-1.2-.1-2C7.5 4.6 9.3 2.6 12 2.6Z" />
    </Svg>
  );
}

/** نوتةُ تيك توك بظلّيها — المسارُ من Simple Icons (CC0)، ونسختُها في الويب حرفاً بحرف. */
const TIKTOK_PATH =
  "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z";

function TikTokMark() {
  return (
    <Svg width={22} height={22} viewBox="-1 -1 26 26">
      <Path d={TIKTOK_PATH} fill="#25F4EE" transform="translate(-0.9 -0.9)" />
      <Path d={TIKTOK_PATH} fill="#FE2C55" transform="translate(0.9 0.9)" />
      <Path d={TIKTOK_PATH} fill="#0E1A24" />
    </Svg>
  );
}
