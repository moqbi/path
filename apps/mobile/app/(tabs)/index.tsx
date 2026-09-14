import { useCallback, useState } from "react";
import { View, Text, FlatList, RefreshControl, ActivityIndicator, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MomentCard } from "../../components/moment-card";
import { ScreenHeader } from "../../components/screen-header";
import { useFeed, type Moment } from "../../lib/queries";
import { colors } from "../../theme/tokens";

/**
 * الخطّ الزمني.
 *
 * صفحاتٌ بمؤشّر تُحمَّل عند الاقتراب من الطرف، لا زرُّ «المزيد»: القراءة
 * في الجوّال إبهامٌ يمضي، وزرٌّ في منتصفها يقطعها.
 */
export default function Timeline() {
  const [view, setView] = useState<"" | "private">("");
  const feed = useFeed(view);
  const moments = feed.data?.pages.flatMap((page) => page.moments) ?? [];

  const render = useCallback(({ item }: { item: Moment }) => <MomentCard moment={item} />, []);

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScreenHeader
        title={view === "private" ? "اللحظات الخاصة" : "اللحظات"}
        right={
          <Pressable onPress={() => setView(view === "private" ? "" : "private")} hitSlop={10}>
            <Text style={{ color: colors.chromeMuted, fontSize: 11.5 }}>
              {view === "private" ? "الكل" : "الخاصة"}
            </Text>
          </Pressable>
        }
      />

      <FlatList
        data={moments}
        keyExtractor={(item) => item.id}
        renderItem={render}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 24, flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={feed.isRefetching && !feed.isFetchingNextPage}
            onRefresh={() => void feed.refetch()}
            tintColor={colors.clay}
          />
        }
        onEndReachedThreshold={0.6}
        onEndReached={() => {
          if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
        }}
        ListEmptyComponent={
          feed.isLoading ? (
            <View style={{ paddingTop: 60, alignItems: "center" }}>
              <ActivityIndicator color={colors.clay} />
            </View>
          ) : (
            <View style={{ paddingTop: 60, paddingHorizontal: 40, alignItems: "center" }}>
              <Text style={{ color: colors.muted, fontSize: 13.5, textAlign: "center", lineHeight: 24 }}>
                {view === "private"
                  ? "ما نشرت لحظةً خاصة بعد."
                  : "لا شيء بعد. أضف أصدقاءك وابدأ لحظتك الأولى."}
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          feed.isFetchingNextPage ? (
            <View style={{ paddingVertical: 18 }}>
              <ActivityIndicator color={colors.clay} />
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}
