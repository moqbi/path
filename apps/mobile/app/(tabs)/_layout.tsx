import { useEffect, useRef, useState } from "react";
import { View, Pressable, Animated, Easing } from "react-native";
import { Text } from "../../components/type";
import { Tabs, useGlobalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HomeIcon, LockIcon, WithIcon } from "../../components/icons";
import { useSession } from "../../lib/session";
import { GlassBar, barBottom } from "../../components/glass-bar";
import { colors } from "../../theme/tokens";

/**
 * عدسات الخط الزمني الثلاث.
 *
 * الضغطة المطوّلة تعرض ما عدا العدسة التي أنت فيها — عرضُ ما أنت فيه
 * خيارٌ لا يفعل شيئاً. واسم التبويب يقول أين أنت، فلا حاجة لشرائح تحت
 * الغلاف.
 */
const LENSES = [
  { key: "", label: "اللحظات", Icon: HomeIcon, bg: colors.night, ink: "#f7f5ef" },
  { key: "private", label: "اللحظات الخاصة", Icon: LockIcon, bg: colors.night, ink: "#f7f5ef" },
  { key: "together", label: "آثارنا", Icon: WithIcon, bg: colors.clay, ink: colors.onBrand },
];

export default function TabsLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  /*
    ملفّ الصديق شاشةٌ داخل المكدّس السفلي لا صفحةٌ فوقه (القاعدة ٤٢):
    `(tabs)/u/[id].tsx` بـ`href: null` — لا تبويبَ له، والشريط باقٍ.
  */
  const { view } = useGlobalSearchParams<{ view?: string }>();
  const lens = LENSES.find((item) => item.key === (view ?? "")) ?? LENSES[0];
  const hidden = LENSES.filter((item) => item.key !== lens.key);

  const [open, setOpen] = useState(false);
  const fan = useRef(new Animated.Value(0)).current;

  /** الضغطة المطوّلة: نصف ثانية تقريباً، ورفعُ الإصبع قبلها يلغيها. */
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hold = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), 450);
  };
  const release = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => () => release(), []);

  useEffect(() => {
    Animated.timing(fan, {
      toValue: open ? 1 : 0,
      duration: open ? 420 : 200,
      easing: open ? Easing.bezier(0.18, 1.3, 0.42, 1) : Easing.bezier(0.4, 0, 1, 1),
      useNativeDriver: true,
    }).start();
  }, [open, fan]);

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        /*
          الرجوعُ بتاريخ التنقّل لا إلى أوّل تبويب: ملفُّ الصديق شاشةٌ في
          هذا المكدّس، وزرُّ رجوعه كان سيسقط على «اللحظات» مهما فُتح من مكان.
        */
        backBehavior="history"
        // الشريطُ زجاجٌ عائمٌ يُرسم بنفسه (القاعدة ٢٢٨)، والمحتوى يمرّ تحته.
        tabBar={(props) => <GlassBar {...props} onLongHome={() => setOpen(true)} />}
        screenOptions={{
          headerShown: false,
          // الشاشةُ على أرضيّتها — شفّافةً حين يلبس صاحبُها ثيماً بصورة، فتُرى
          // الصورةُ المرسومة في الجذر خلفها. وبلا هذا يرسم المتصفّح أرضيته الرمادية.
          sceneStyle: { backgroundColor: colors.ground },
        }}
      >
        <Tabs.Screen name="index" options={{ title: lens.label }} />
        <Tabs.Screen name="circle" options={{ title: "الأصدقاء" }} />
        <Tabs.Screen name="notifications" options={{ title: "الإشعارات" }} />
        <Tabs.Screen name="store" options={{ title: "المتجر" }} />
        <Tabs.Screen name="me" options={{ title: "أنا" }} />
        {/* ملفّ الصديق: شاشةٌ بلا تبويبٍ يخصّها، فيبقى الشريط تحتها. */}
        <Tabs.Screen name="u/[id]" options={{ href: null }} />
      </Tabs>

      {/* الحجاب: ضغطةٌ عليه تُغلق البابين. */}
      <Pressable
        onPress={() => setOpen(false)}
        pointerEvents={open ? "auto" : "none"}
        style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }}
      >
        <Animated.View
          style={{
            flex: 1,
            backgroundColor: "rgba(14,26,36,.82)",
            opacity: fan,
          }}
        />
      </Pressable>

      {/* والبابان ينطلقان من فوق تبويب «اللحظات» في الطرف الأيمن. */}
      <View
        pointerEvents={open ? "box-none" : "none"}
        style={{ position: "absolute", right: 20, bottom: barBottom(insets.bottom) + 30, width: 92, height: 74 }}
      >
        {hidden.map((item, index) => (
          <Animated.View
            key={item.key || "all"}
            style={{
              position: "absolute",
              right: 0,
              bottom: 0,
              width: 92,
              height: 74,
              opacity: fan,
              transform: [
                {
                  translateY: fan.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -96 - index * 88],
                  }),
                },
                { scale: fan.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) },
              ],
            }}
          >
            <Pressable
              onPress={() => {
                setOpen(false);
                // «آثارنا» من مزايا آثار+ — من اختارها بلا اشتراكٍ يُؤخذ إلى صفحته.
                if (item.key === "together" && !useSession.getState().me?.isPlus) {
                  router.push("/subscribe" as never);
                  return;
                }
                router.push(
                  item.key
                    ? ({ pathname: "/", params: { view: item.key } } as never)
                    : ("/" as never),
                );
              }}
              style={{
                width: 92,
                height: 74,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.line,
                backgroundColor: colors.card,
                shadowColor: "#000",
                shadowOpacity: 0.4,
                shadowRadius: 13,
                shadowOffset: { width: 0, height: 10 },
                elevation: 8,
              }}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: item.bg,
                  marginBottom: 4,
                }}
              >
                <item.Icon size={16} color={item.ink} />
              </View>
              <Text style={{ color: colors.ink, fontSize: 9.5, fontWeight: "600" }}>
                {item.label}
              </Text>
            </Pressable>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}
