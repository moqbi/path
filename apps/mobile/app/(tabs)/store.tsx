import { useState } from "react";
import { View, ScrollView, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { Text } from "../../components/type";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { AthrMark } from "../../components/brand";
import { StoreGrid } from "../../components/store-grid";
import { FlameIcon, InfoIcon, SparkIcon } from "../../components/icons";
import { useStore, type StoreItem } from "../../lib/queries";
import { coinText } from "../../lib/format";
import { colors } from "../../theme/tokens";

/** عنوان صفٍّ في «المميز» — واللهب رسمٌ لا إيموجي، كبقية أيقونات التطبيق. */
function Row({ title, flame = false, children }: { title: string; flame?: boolean; children: React.ReactNode }) {
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
        {flame ? <FlameIcon size={16} color={colors.live} /> : null}
        <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "700" }}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

/**
 * المتجر: شريط تصنيفات، ثم صفوف.
 *
 * «المميز» ليس تصنيفاً بل واجهة: ما وصل حديثاً، ثم ثيمات آثار، ثم الحزم
 * المحدودة — صفوفٌ تُشتقّ من الأصناف لا تُرصف يدوياً.
 */
export default function Store() {
  const router = useRouter();
  const store = useStore();
  const [slug, setSlug] = useState("");
  const data = store.data;

  const grid = (items: StoreItem[]) =>
    data ? (
      <StoreGrid
        items={items}
        owned={data.owned}
        isPlus={data.isPlus}
        coins={data.coins}
        daysHere={data.daysHere}
        equipped={data.equipped}
      />
    ) : null;

  const category = data?.categories.find((row) => row.slug === slug) ?? null;

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.paper }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 20,
          paddingTop: 6,
          paddingBottom: 10,
          backgroundColor: colors.chrome,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <AthrMark size={32} />
          <View style={{ width: 1, height: 18, backgroundColor: colors.chromeLine }} />
          <Text style={{ color: colors.chromeInk, fontSize: 16, fontWeight: "700" }}>المتجر</Text>
        </View>

        {/*
          الرصيد زرٌّ لا لافتة: من يقرأ رصيده هو من يريد شحنه، فالطريق
          إلى الشحن من مكان السؤال لا من قائمةٍ أخرى.
        */}
        <Pressable
          accessibilityLabel="شحن النقاط"
          onPress={() => router.push("/coins" as never)}
          style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.goldSoft, borderWidth: 1, borderColor: colors.goldLine }}
        >
          <SparkIcon size={14} color={colors.gold} />
          <Text style={{ color: colors.goldInk, fontSize: 12.5, fontWeight: "600" }}>
            رصيدك {coinText(data?.coins ?? 0)}
          </Text>
          <Text style={{ color: colors.goldInk, fontSize: 15, fontWeight: "700", marginTop: -1 }}>＋</Text>
        </Pressable>
      </View>

      {/* شريط التصنيفات: «المميز» أولاً، ثم ما يضيفه المشرف. */}
      <View style={{ paddingTop: 12, paddingBottom: 4 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row", paddingHorizontal: 20, gap: 8 }}>
          {[{ slug: "", name: "المميز" }, ...(data?.categories ?? [])].map((chip) => {
            const on = slug === chip.slug;
            return (
              <Pressable
                key={chip.slug || "featured"}
                onPress={() => setSlug(chip.slug)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: on ? colors.clay : colors.card,
                  borderWidth: 1,
                  borderColor: on ? colors.clay : colors.line,
                }}
              >
                <Text style={{ fontSize: 12.5, fontWeight: "600", color: on ? colors.onBrand : colors.ink2 }}>
                  {chip.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {store.isLoading ? (
        <ActivityIndicator style={{ marginTop: 50 }} color={colors.clay} />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 28 }}
          refreshControl={
            <RefreshControl refreshing={store.isRefetching} onRefresh={() => void store.refetch()} tintColor={colors.clay} />
          }
        >
          {category ? (
            grid((data?.items ?? []).filter((item) => item.categoryId === category.id))
          ) : (
            <>
              <Row title="وصل حديثاً" flame>{grid(data?.rows.fresh ?? [])}</Row>
              <Row title="ثيمات آثار">{grid(data?.rows.themes ?? [])}</Row>
              <Row title="حزم محدودة">{grid(data?.rows.limited ?? [])}</Row>
            </>
          )}

          {data && !data.isPlus ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20, borderRadius: 16, borderWidth: 1, borderColor: colors.goldLine, backgroundColor: colors.goldSoft, padding: 16 }}>
              <View style={{ width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#f0e4c8" }}>
                <SparkIcon size={19} color={colors.gold} />
              </View>
              <Text style={{ flex: 1, color: colors.ink2, fontSize: 12, lineHeight: 21 }}>
                مشتركو <Text style={{ fontWeight: "600", color: colors.goldInk }}>آثار+</Text> يحصلون على ١٠٠٠ نقطة شهرياً وخصم ٢٠٪
              </Text>
            </View>
          ) : null}

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingBottom: 24 }}>
            <InfoIcon size={13} color={colors.faint} />
            <Text style={{ color: colors.faint, fontSize: 11, textAlign: "center" }}>
              لا صناديق عشوائية · كل صنف بسعره الواضح
            </Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
