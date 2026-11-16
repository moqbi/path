import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Text } from "./type";
import { CameraIcon, CoinIcon, SparkIcon, StickerIcon, VerifiedIcon } from "./icons";
import { billingReady, openManage, plans, type Plan } from "../lib/billing";
import { colors } from "../theme/tokens";

/** أقراصُ المزايا تحت العنوان — النقاط، والصورة المتحركة، وشارة التوثيق، والملصقات، وآثار+ نفسُه.
 *  والقائمةُ كاملةً بأسمائها في صفحة آثار+ («المزيد»). */
const PERK_ICONS = [CoinIcon, CameraIcon, VerifiedIcon, StickerIcon, SparkIcon];

/** يدخل صاعداً متتابعاً ثمّ يثبت في مكانه — مرّةً عند الظهور لا حركةً دائمة؛ وساكنٌ لمن طلب «قلّل الحركة». */
function FloatingPerks({ offset }: { offset: number }) {
  const values = useRef(PERK_ICONS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((still) => {
        if (!alive) return;
        if (still) {
          values.forEach((v) => v.setValue(1));
          return;
        }
        Animated.stagger(
          90,
          values.map((v) =>
            Animated.spring(v, { toValue: 1, friction: 6, tension: 90, useNativeDriver: true }),
          ),
        ).start();
      });
    return () => {
      alive = false;
    };
  }, [values, offset]);

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
            opacity: values[i].interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }),
            transform: [
              { translateY: values[i].interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
              { scale: values[i].interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
            ],
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
 * في كلٍّ العنوانُ، فأقراصُ مزايا تدخل وتثبت (وعلى السنويّ «خصم ١٦٫٧٪»)، فالسعرُ من المتجر والمدّةُ في العنوان (3.1.2)، ثمّ «اشتراك» يفتح صفحةَ الاشتراك
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
            {yearly ? (
              <View
                style={{
                  position: "absolute",
                  top: -9,
                  left: 10,
                  borderRadius: 8,
                  paddingHorizontal: 7,
                  paddingVertical: 2,
                  backgroundColor: colors.clay,
                }}
              >
                <Text style={{ color: colors.onBrand, fontSize: 10.5, fontWeight: "700" }}>خصم ١٦٫٧٪</Text>
              </View>
            ) : null}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <SparkIcon size={15} color={colors.gold} />
              <Text style={{ flex: 1, color: colors.ink, fontSize: 14, fontWeight: "700" }}>
                {yearly ? "آثار+ سنوي" : "آثار+ شهري"}
              </Text>
            </View>
            <FloatingPerks offset={yearly ? 650 : 0} />

            {/* السعرُ والمدّةُ معاً (3.1.2) — من المتجر لا من الكود، وبلاه المدّةُ وحدها. */}
            <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "700", marginBottom: 10, writingDirection: "auto" }}>
              {offer?.price ?? (yearly ? "سنة" : "شهر")}
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
