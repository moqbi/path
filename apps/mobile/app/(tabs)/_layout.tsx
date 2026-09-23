import { useEffect, useRef, useState } from "react";
import { View, Pressable, Animated, Easing } from "react-native";
import { Text } from "../../components/type";
import { Tabs, useGlobalSearchParams, usePathname, useRouter } from "expo-router";
import {
  BellIcon,
  CircleIcon,
  HomeIcon,
  LockIcon,
  StoreIcon,
  UserIcon,
  WithIcon,
} from "../../components/icons";
import { useNoteCount } from "../../lib/queries";
import { Spot } from "../../components/spot";
import { colors } from "../../theme/tokens";
import { familyOf } from "../../theme/fonts";

/**
 * الشريط السفلي — نفس التبويبات الخمسة وبنفس ترتيبها في الويب.
 *
 * والنقطة فوق جرس الإشعارات عددٌ لا يُكتب: الرقم فوق الأيقونة يقول
 * «أنجز هذه المهام»، والنقطة تقول «فيه جديد» — وهذا ما نريده.
 */
function Dot() {
  return (
    <View
      style={{
        position: "absolute",
        top: -1,
        insetInlineEnd: -4,
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: colors.clay,
      }}
    />
  );
}

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
  const { data } = useNoteCount();
  const unseen = data?.unseen ?? 0;
  const router = useRouter();

  /*
    ملفّ الصديق شاشةٌ داخل المكدّس السفلي لا صفحةٌ فوقه (القاعدة ٤٢):
    كان في `app/u/[id].tsx` خارج المجموعة فيختفي الشريط تحته، وصار
    `(tabs)/u/[id].tsx` بـ`href: null` — لا تبويبَ له، والشريط باقٍ.
    وتبويب «الأصدقاء» يبقى مضيئاً تحته كما في الويب: من هناك يُفتح.
  */
  const path = usePathname();
  const onFriend = path.startsWith("/u/");

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
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.clayInk,
          tabBarInactiveTintColor: colors.muted,
          /*
            الظلّ فوق الشريط السفلي، وبابان لا باب: `elevation` لأندرويد
            وحده لا يرسم شيئاً على آبل، و`shadow*` لآبل وحدها لا تعني
            شيئاً لأندرويد. وكان هنا `elevation` بلا `shadow*`، فالخطّ
            العلوي وحده يفصل الشريط عن الصفحة على آيفون — ومع ثيمٍ فاتح
            تحته لا يكاد يُرى.

            والظلّ إلى **أعلى** (`height: -2`): الشريط في أسفل الشاشة،
            فظلٌّ نازلٌ منه يقع خارجها.
          */
          tabBarStyle: {
            backgroundColor: colors.card,
            borderTopColor: colors.line,
            height: 62,
            paddingTop: 4,
            paddingBottom: 6,
            shadowColor: "#0E1A24",
            shadowOpacity: 0.08,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: -2 },
            elevation: 12,
          },
          /*
            وعنوان التبويب لا يمرّ بـ`components/type.tsx`: الشريط يرسم
            نصّه بنفسه، فالعائلة تُكتب هنا بيدها وإلا بقيت التبويبات
            الخمسة وحدها بخطّ النظام في تطبيقٍ كلُّه بخطّ العلامة.
          */
          tabBarLabelStyle: { fontSize: 9.5, fontFamily: familyOf("body", 500) },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            // تبويب اللحظات يحمل اسم العدسة المفتوحة.
            title: lens.label,
            tabBarIcon: ({ color }) => (
              <Spot id="tab.index">
                <HomeIcon size={19} color={color} />
              </Spot>
            ),
            /*
              الضغطة المطوّلة بابٌ مخفيّ، وتُقاس بمؤقّتٍ كما في الويب:
              نصف ثانيةٍ من الضغط تفتح البابين، ورفعُ الإصبع قبلها يلغيها
              فتبقى ضغطةً قصيرةً تنقّل. و`ref` يُترك لصاحبه: نوعُه في
              React Navigation أوسع ممّا يقبله `Pressable`.
            */
            tabBarButton: ({ ref: _ref, ...props }) => (
              <Pressable
                {...props}
                onPressIn={(event) => {
                  hold();
                  props.onPressIn?.(event);
                }}
                onPressOut={(event) => {
                  release();
                  props.onPressOut?.(event);
                }}
              />
            ),
          }}
          listeners={{ tabLongPress: () => setOpen(true) }}
        />
        <Tabs.Screen
          name="circle"
          options={{
            title: "الأصدقاء",
            tabBarIcon: ({ color }) => (
              <Spot id="tab.circle">
                <CircleIcon size={19} color={onFriend ? colors.clayInk : color} />
              </Spot>
            ),
            tabBarLabelStyle: {
              fontSize: 9.5,
              fontFamily: familyOf("body", 500),
              color: onFriend ? colors.clayInk : undefined,
            },
          }}
        />
        <Tabs.Screen
          name="notifications"
          options={{
            title: "الإشعارات",
            tabBarIcon: ({ color, focused }) => (
              <Spot id="tab.notifications">
                <BellIcon size={19} color={color} />
                {unseen > 0 && !focused ? <Dot /> : null}
              </Spot>
            ),
          }}
        />
        <Tabs.Screen
          name="store"
          options={{
            title: "المتجر",
            tabBarIcon: ({ color }) => (
              <Spot id="tab.store">
                <StoreIcon size={19} color={color} />
              </Spot>
            ),
          }}
        />
        <Tabs.Screen
          name="me"
          options={{
            title: "أنا",
            tabBarIcon: ({ color }) => (
              <Spot id="tab.me">
                <UserIcon size={19} color={color} />
              </Spot>
            ),
          }}
        />
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
        style={{ position: "absolute", right: 6, bottom: 62, width: 92, height: 74 }}
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
