import { useState } from "react";
import { View, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { Text } from "../components/type";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ScreenHeader } from "../components/screen-header";
import { CoinIcon } from "../components/icons";
import { billingReady, buyCoins } from "../lib/billing";
import { keys, useCoinPacks, useStore } from "../lib/queries";
import { coinText, riyals } from "../lib/format";
import { colors } from "../theme/tokens";

/**
 * شحن النقاط.
 *
 * النقاط عملة المتجر: كل ما فيه يُشترى بها، ومن نفد رصيدُه يشحن من
 * هنا. والشراء يمرّ بالمتجرين وحدهما — السلع الرقمية لا تُباع بغير
 * IAP، وبطاقةٌ في التطبيق تعني إزالته.
 *
 * والرصيد لا يُفتح على الجهاز: الجهاز يشتري، ويودع الخادمُ حين يصله
 * حدث RevenueCat. فبعد نافذة الدفع نسأل عن الرصيد بضع مرّاتٍ متباعدة
 * بدل أن نُصدّق الجهاز — ثوانٍ في العادة.
 */
async function waitForCoins(ask: () => Promise<unknown>, before: number, now: () => number) {
  for (const wait of [0, 1500, 3000, 5000]) {
    if (wait) await new Promise((done) => setTimeout(done, wait));
    await ask();
    if (now() > before) return true;
  }
  return false;
}

export default function Coins() {
  const packs = useCoinPacks();
  const store = useStore();
  const client = useQueryClient();
  const [note, setNote] = useState<string | null>(null);

  const balance = store.data?.coins ?? 0;

  const act = useMutation({
    mutationFn: async (sku: string) => {
      const before = balance;
      const result = await buyCoins(sku);
      if (result.cancelled) return;
      if (!result.bought) throw new Error("تعذّر إتمام الشراء");

      const landed = await waitForCoins(
        () => client.invalidateQueries({ queryKey: keys.store }),
        before,
        () => client.getQueryData<{ coins: number }>(keys.store)?.coins ?? before,
      );
      setNote(
        landed
          ? "وصل رصيدك"
          : "تمّ الشراء — الإيداع خلال دقيقة. اسحب للتحديث إن تأخّر.",
      );
    },
    onError: (problem) =>
      setNote(problem instanceof Error ? problem.message : "تعذّر الشراء"),
  });

  const rows = packs.data?.packs ?? [];

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScreenHeader title="شحن النقاط" back="/store" />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: colors.goldLine,
            backgroundColor: colors.goldSoft,
            padding: 16,
            marginBottom: 18,
          }}
        >
          <CoinIcon size={22} color={colors.gold} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: colors.goldInk, fontSize: 12, fontWeight: "600", textAlign: "right" }}>
              رصيدك الآن
            </Text>
            <Text style={{ color: colors.ink, fontSize: 19, fontWeight: "700", textAlign: "right" }}>
              {coinText(balance)}
            </Text>
          </View>
        </View>

        {packs.isLoading ? (
          <ActivityIndicator style={{ marginTop: 30 }} color={colors.clay} />
        ) : rows.length === 0 ? (
          <View style={{ borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, padding: 22 }}>
            <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "700", textAlign: "center", marginBottom: 6 }}>
              لا باقات متاحة الآن
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12.5, lineHeight: 22, textAlign: "center" }}>
              الشحن يمرّ بمتجر جهازك، وباقاتُنا تنتظر أن تُنشر هناك.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {rows.map((pack) => (
              <Pressable
                key={pack.id}
                disabled={act.isPending || !billingReady()}
                onPress={() => {
                  setNote(null);
                  act.mutate(pack.sku);
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: colors.line,
                  backgroundColor: colors.card,
                  padding: 16,
                  opacity: act.isPending || !billingReady() ? 0.6 : 1,
                }}
              >
                <CoinIcon size={20} color={colors.gold} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: colors.ink, fontSize: 14.5, fontWeight: "700", textAlign: "right" }}>
                    {pack.name}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 11.5, marginTop: 2, textAlign: "right" }}>
                    {coinText(pack.coins)}
                  </Text>
                </View>
                <Text style={{ color: colors.clayInk, fontSize: 13.5, fontWeight: "700" }}>
                  {riyals(pack.priceHalalas)}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {!billingReady() ? (
          <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 22, textAlign: "center", paddingTop: 16 }}>
            الشحن يتمّ من داخل التطبيق على الجوّال عبر App Store أو Google Play.
          </Text>
        ) : null}

        {note ? (
          <Text
            accessibilityRole="alert"
            style={{ color: colors.clayInk, fontSize: 12.5, lineHeight: 22, textAlign: "center", paddingTop: 16 }}
          >
            {note}
          </Text>
        ) : null}

        <Text style={{ color: colors.faint, fontSize: 10.5, lineHeight: 20, textAlign: "center", paddingTop: 22 }}>
          تُخصم القيمة من حساب متجرك · النقاط لا تُستردّ ولا تُحوَّل
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
