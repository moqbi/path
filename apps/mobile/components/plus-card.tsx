import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Text } from "./type";
import { CameraIcon, CoinIcon, SparkIcon, StickerIcon, VerifiedIcon } from "./icons";
import { billingReady, openManage, plans, type Plan } from "../lib/billing";
import { colors } from "../theme/tokens";

/** أقراصُ المزايا تحت العنوان — النقاط، والصورة المتحركة، وشارة التوثيق، والملصقات، وآثار+ نفسُه.
 *  والقائمةُ كاملةً بأسمائها في صفحة آثار+ («المزيد»). */
const PERK_ICONS = [CoinIcon, CameraIcon, VerifiedIcon, StickerIcon, SparkIcon];

/** يطفو في مكانه: صعودٌ ونزولٌ بستّ نقاطٍ متتابعٌ بين الأقراص — على المحرّك الأصليّ، وساكنٌ لمن طلب «قلّل الحركة». */
function FloatingPerks({ offset }: { offset: number }) {
  const [still, setStill] = useState(false);
  const values = useRef(PERK_ICONS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setStill).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (still) return;
    const loops = values.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay((i * 260 + offset) % 1400),
          Animated.timing(v, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [still, values, offset]);

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5, paddingTop: 6, marginBottom: 10 }}>
      {PERK_ICONS.map((Icon, i) => (
        <Animated.View
          key={i}
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.goldSoft,
            transform: [{ translateY: values[i].interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }],
          }}
        >
          <Icon size={14} color={colors.goldInk} />
        </Animated.View>
      ))}
    </View>
  );
}

/**
 * بطاقتا «آثار+ شهري» و«آثار+ سنوي» جنباً إلى جنب أوّلَ «المميز» — **بقرار المالك** (القاعدة ٤٦٥):
 * في كلٍّ العنوانُ، فأقراصُ مزايا تطفو في مكانها (وعلى السنويّ «خصم ١٦٫٧٪»)، فالسعرُ من المتجر ومدّتُه (3.1.2)، ثمّ «اشتراك» يفتح صفحةَ الاشتراك
 * ويبدأ شراءَ باقته (`/subscribe?plan=`) و«المزيد» يفتح صفحةَ مزايا آثار+ كما هي.
 */
export function PlusCards({ isPlus }: { isPlus: boolean }) {
  const router = useRouter();
  const [offers, setOffers] = useState<Plan[] | null>(null);

  useEffect(() => {
    if (isPlus || !billingReady()) return;
    plans()
      .then(setOffers)
      .catch(() => setOffers([]));
  }, [isPlus]);

  return (
    <View style={{ flexDirection: "row", gap: 10, marginBottom: 22 }}>
      {[false, true].map((yearly) => {
        const offer = offers?.find((one) => one.yearly === yearly) ?? null;
        return (
          <View
            key={yearly ? "y" : "m"}
            style={{
              flex: 1,
              borderRadius: 16,
              borderWidth: yearly ? 1.5 : 1,
              borderColor: yearly ? colors.gold : colors.goldLine,
              backgroundColor: colors.card,
              padding: 12,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <SparkIcon size={15} color={colors.gold} />
              <Text style={{ flex: 1, color: colors.ink, fontSize: 14, fontWeight: "700" }}>
                {yearly ? "آثار+ سنوي" : "آثار+ شهري"}
              </Text>
            </View>
            {yearly ? (
              <View
                style={{
                  alignSelf: "flex-start",
                  borderRadius: 8,
                  paddingHorizontal: 7,
                  paddingVertical: 2,
                  backgroundColor: colors.clay,
                  marginBottom: 2,
                }}
              >
                <Text style={{ color: colors.onBrand, fontSize: 10.5, fontWeight: "700" }}>خصم ١٦٫٧٪</Text>
              </View>
            ) : null}
            <FloatingPerks offset={yearly ? 650 : 0} />

            {/* السعرُ والمدّةُ معاً (3.1.2) — من المتجر لا من الكود، وبلاه المدّةُ وحدها. */}
            <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "700", writingDirection: "auto" }}>
              {offer?.price ?? (yearly ? "سنة" : "شهر")}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 10.5, marginBottom: 10, writingDirection: "auto" }}>
              {offer?.perMonth ? `كل سنة · يعادل ${offer.perMonth} شهرياً` : yearly ? "كل سنة" : "كل شهر"}
            </Text>

            <View style={{ marginTop: "auto", gap: 6 }}>
              <Pressable
                onPress={() =>
                  isPlus ? void openManage() : router.push(`/subscribe?plan=${yearly ? "yearly" : "monthly"}` as never)
                }
                style={({ pressed }) => ({
                  height: 38,
                  borderRadius: 10,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: isPlus ? colors.goldSoft : colors.clay,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text style={{ color: isPlus ? colors.goldInk : colors.onBrand, fontSize: 13, fontWeight: "700" }}>
                  {isPlus ? "إدارة الاشتراك" : "اشتراك"}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => router.push("/subscribe" as never)}
                style={{ height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line }}
              >
                <Text style={{ color: colors.ink2, fontSize: 12.5, fontWeight: "600" }}>المزيد</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </View>
  );
}
