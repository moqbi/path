import { useEffect, useState } from "react";
import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Text } from "./type";
import { SparkIcon } from "./icons";
import { billingReady, openManage, plans, type Plan } from "../lib/billing";
import { colors } from "../theme/tokens";

/** سطرُ المزايا المختصر تحت العنوان — والقائمةُ كاملةً في صفحة آثار+. */
const BRIEF = "١٠٠٠ نقطة شهرياً · صورة عرض متحركة · وسم «داعم» وشارة التوثيق";

/**
 * بطاقتا «آثار+ شهري» و«آثار+ سنوي» جنباً إلى جنب أوّلَ «المميز» — **بقرار المالك** (القاعدة ٤٦٥):
 * في كلٍّ العنوانُ، فسطرُ مزايا، فالسعرُ من المتجر ومدّتُه (3.1.2)، ثمّ «اشتراك» يفتح صفحةَ الاشتراك
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
            <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 18, marginBottom: 10 }}>{BRIEF}</Text>

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
