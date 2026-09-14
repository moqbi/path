import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, Modal, Animated, Easing, PanResponder } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { CircleIcon, HomeIcon, LockIcon, PlusIcon, WithIcon } from "./icons";
import { getItem, setItem } from "../lib/store";
import { brandGradient, colors } from "../theme/tokens";

const KEY = "athr:tour";

const STEPS = [
  {
    Icon: HomeIcon,
    title: "خطّك الزمني",
    body: "لحظاتك ولحظات أصدقائك في يوميّة واحدة: مكانٌ حللت به، أغنية تسمعها، خاطرة، أو نوم. لا خوارزمية ترتّبها — الأحدث أولاً.",
  },
  {
    Icon: PlusIcon,
    title: "انشر بضغطة",
    body: "زرّ الزائد يفتح قوساً: اكتب، صورة، مكان، أغنية، نوم. والمكان يأتي من جهازك لا من لوحة المفاتيح.",
  },
  {
    Icon: CircleIcon,
    title: "مئة وخمسون",
    body: "سقف أصدقائك ١٥٠ ولا يُشترى. الإضافة من أصدقاء أصدقائك وحدهم — لا بحث ولا اكتشاف عام.",
  },
  {
    Icon: LockIcon,
    title: "من يرى ماذا",
    body: "عند النشر تختار: كل أصدقائك، أو تصنيفاً منهم (العائلة، الزملاء)، أو أشخاصاً بأعيانهم. ومن هو خارج الجمهور لا تصله اللحظة أصلاً.",
  },
  {
    Icon: WithIcon,
    title: "آثارنا",
    body: "اضغط مطوّلاً على تبويب «اللحظات» لتفتح لحظاتك الخاصة، وأثرك المشترك مع كل صديق.",
  },
];

/**
 * جولة أول فتح.
 *
 * تُعرض مرة واحدة ثم تُنسى في مخزن الجهاز — لا صفّ في القاعدة لشيء يخصّ
 * هذا الجهاز وحده. وتُقرأ بعد التركيب لا قبله، فلا تومض للعائدين.
 */
export function Tour() {
  const [step, setStep] = useState<number | null>(null);
  const slide = useRef(new Animated.Value(0)).current;
  const swipe = useRef<number | null>(null);

  useEffect(() => {
    void getItem(KEY).then((seen) => {
      if (seen !== "1") setStep(0);
    });
  }, []);

  function go(next: number, from: number) {
    if (next < 0 || next >= STEPS.length) return;
    // الشريحة تدخل من الجهة التي جاءت منها.
    slide.setValue(next > from ? 42 : -42);
    setStep(next);
    Animated.timing(slide, {
      toValue: 0,
      duration: 360,
      easing: Easing.bezier(0.18, 1.1, 0.32, 1),
      useNativeDriver: true,
    }).start();
  }

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_event, gesture) =>
        Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderGrant: (_event, gesture) => {
        swipe.current = gesture.x0;
      },
      onPanResponderRelease: (_event, gesture) => {
        swipe.current = null;
        setStep((was) => {
          if (was === null) return was;
          // في RTL: السحب لليسار يمضي إلى التالي.
          const next = gesture.dx < -48 ? was + 1 : gesture.dx > 48 ? was - 1 : was;
          if (next === was || next < 0 || next >= STEPS.length) return was;
          slide.setValue(next > was ? 42 : -42);
          Animated.timing(slide, {
            toValue: 0,
            duration: 360,
            easing: Easing.bezier(0.18, 1.1, 0.32, 1),
            useNativeDriver: true,
          }).start();
          return next;
        });
      },
    }),
  ).current;

  async function close() {
    await setItem(KEY, "1");
    setStep(null);
  }

  if (step === null) return null;

  const current = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <Modal transparent animationType="fade" onRequestClose={() => void close()}>
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(14,26,36,.82)" }}>
        <View
          {...pan.panHandlers}
          style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 24,
            paddingTop: 28,
            paddingBottom: 36,
            alignItems: "center",
          }}
        >
          <Animated.View style={{ alignItems: "center", transform: [{ translateX: slide }] }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.claySoft,
                marginBottom: 16,
              }}
            >
              <current.Icon size={28} color={colors.clayInk} />
            </View>

            <Text style={{ color: colors.ink, fontSize: 19, fontWeight: "700", marginBottom: 8 }}>
              {current.title}
            </Text>
            <Text style={{ color: colors.ink2, fontSize: 13.5, lineHeight: 26, textAlign: "center", maxWidth: 320, marginBottom: 24 }}>
              {current.body}
            </Text>
          </Animated.View>

          <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6, marginBottom: 20 }}>
            {STEPS.map((_, index) => (
              <Pressable
                key={index}
                accessibilityLabel={`الشريحة ${index + 1}`}
                onPress={() => go(index, step)}
                style={{
                  width: index === step ? 20 : 7,
                  height: 7,
                  borderRadius: 4,
                  backgroundColor: index === step ? colors.clay : colors.line,
                }}
              />
            ))}
          </View>

          <View style={{ flexDirection: "row-reverse", gap: 10, alignSelf: "stretch" }}>
            <Pressable
              onPress={() => (last ? void close() : go(step + 1, step))}
              style={{ flex: 1 }}
            >
              <LinearGradient
                colors={[brandGradient[0], brandGradient[1]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ height: 50, borderRadius: 12, alignItems: "center", justifyContent: "center" }}
              >
                <Text style={{ color: colors.onBrand, fontSize: 15, fontWeight: "700" }}>
                  {last ? "ابدأ" : "التالي"}
                </Text>
              </LinearGradient>
            </Pressable>

            <Pressable
              onPress={() => void close()}
              style={{ height: 50, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600" }}>تخطّى</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
