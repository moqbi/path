import { useEffect, useState } from "react";
import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Text } from "./type";
import { SparkIcon } from "./icons";
import { PERKS } from "./plus-perks";
import { billingReady, openManage, plans, type Plan } from "../lib/billing";
import { colors } from "../theme/tokens";

/** ما يُرى من المزايا قبل «عرض المزيد». */
const SHORT = 3;

/**
 * بطاقةُ «اشتراك آثار+» في أعلى المتجر — **بقرار المالك**: المزايا مختصرةً و«عرض المزيد»،
 * ثمّ الشهريّ والسنويّ بأسعار المتجر. الضغطةُ على الباقة تفتح صفحةَ الاشتراك وتبدأ شراءها
 * (`/subscribe?plan=`) — نافذةُ آبل فوق نصّ التجديد والشروط (3.1.2)، والتفعيلُ من الخادم كما هو.
 */
export function PlusCard({ isPlus }: { isPlus: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [offers, setOffers] = useState<Plan[] | null>(null);

  useEffect(() => {
    if (isPlus || !billingReady()) return;
    plans()
      .then(setOffers)
      .catch(() => setOffers([]));
  }, [isPlus]);

  const shown = open ? PERKS : PERKS.slice(0, SHORT);
  const priceOf = (yearly: boolean) => offers?.find((one) => one.yearly === yearly) ?? null;

  return (
    <View
      style={{
        marginBottom: 22,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.goldLine,
        backgroundColor: colors.card,
        padding: 16,
      }}
    >
      <Pressable
        onPress={() => router.push("/subscribe" as never)}
        style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 }}
      >
        <View style={{ width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.goldSoft }}>
          <SparkIcon size={19} color={colors.gold} />
        </View>
        <Text style={{ flex: 1, color: colors.ink, fontSize: 16, fontWeight: "700" }}>اشتراك آثار+</Text>
        {isPlus ? (
          <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.goldSoft }}>
            <Text style={{ color: colors.goldInk, fontSize: 11.5, fontWeight: "700" }}>مشترك</Text>
          </View>
        ) : null}
      </Pressable>

      {shown.map((perk) => (
        <View key={perk.title} style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <View style={{ width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: colors.goldSoft }}>
            {perk.icon}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "600" }}>{perk.title}</Text>
            <Text style={{ color: colors.muted, fontSize: 11.5, lineHeight: 19 }}>{perk.body}</Text>
          </View>
        </View>
      ))}

      {PERKS.length > SHORT ? (
        <Pressable onPress={() => setOpen((now) => !now)} hitSlop={8} style={{ alignSelf: "flex-start", marginBottom: 14 }}>
          <Text style={{ color: colors.clayInk, fontSize: 12.5, fontWeight: "700" }}>
            {open ? "عرض أقلّ" : `عرض المزيد (${PERKS.length - SHORT})`}
          </Text>
        </Pressable>
      ) : null}

      {isPlus ? (
        // الإلغاءُ والتغييرُ في المتجر — لا آبل ولا قوقل تسمح بهما من داخل التطبيق.
        <Pressable
          onPress={() => void openManage()}
          style={{ height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line }}
        >
          <Text style={{ color: colors.muted, fontSize: 13.5, fontWeight: "600" }}>إدارة الاشتراك</Text>
        </Pressable>
      ) : (
        <View style={{ flexDirection: "row", gap: 10 }}>
          {[false, true].map((yearly) => {
            const offer = priceOf(yearly);
            return (
              <Pressable
                key={yearly ? "y" : "m"}
                onPress={() => router.push(`/subscribe?plan=${yearly ? "yearly" : "monthly"}` as never)}
                style={({ pressed }) => ({
                  flex: 1,
                  borderRadius: 14,
                  borderWidth: yearly ? 1.5 : 1,
                  borderColor: yearly ? colors.gold : colors.line,
                  backgroundColor: yearly ? colors.goldSoft : colors.card,
                  paddingVertical: 12,
                  paddingHorizontal: 10,
                  alignItems: "center",
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                })}
              >
                {/* الاسمُ والمدّةُ والسعرُ معاً (3.1.2) — والسعرُ من المتجر لا من الكود. */}
                <Text style={{ color: yearly ? colors.goldInk : colors.muted, fontSize: 11.5, marginBottom: 4 }}>
                  {yearly ? "آثار+ سنوي · سنة" : "آثار+ شهري · شهر"}
                </Text>
                <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "700", writingDirection: "auto" }}>
                  {offer?.price ?? (yearly ? "سنوي" : "شهري")}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 10.5, marginTop: 2, writingDirection: "auto" }}>
                  {offer?.perMonth ? `يعادل ${offer.perMonth} شهرياً` : yearly ? "كل سنة" : "كل شهر"}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}
