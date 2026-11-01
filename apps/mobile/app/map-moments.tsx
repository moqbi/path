import { useEffect } from "react";
import { FlatList, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Text } from "../components/type";
import { Spinner } from "../components/spinner";
import { ScreenHeader } from "../components/screen-header";
import { MomentCard } from "../components/moment-card";
import { api } from "../lib/api";
import { type Moment } from "../lib/queries";
import { useSession } from "../lib/session";
import { useMapMoments } from "../lib/map-moments";
import { colors } from "../theme/tokens";

/**
 * لحظاتُ مدينةٍ أو دولةٍ أو مكانٍ من «خريطتي» كاملةً (القاعدة ٣٨٤): بطاقاتُ الخطّ الزمنيّ
 * نفسها بتفاعلاتها وتعليقاتها، والضغطُ على أيٍّ منها يفتح اللحظة. لصاحبها وحده — الخادمُ
 * يُسقط ما ليس له.
 */
export default function MapMoments() {
  const router = useRouter();
  const { title, ids } = useMapMoments();
  const { me } = useSession();

  // فُتحت بلا قائمة (إعادة تحميلٍ أو رابطٍ مباشر): ترجع إلى الخريطة.
  useEffect(() => {
    if (ids.length === 0) router.replace("/map" as never);
  }, [ids.length]);

  const state = useQuery({
    queryKey: ["map-moments", ids.join(",")],
    enabled: ids.length > 0,
    queryFn: () => api<{ moments: Moment[] }>(`/v1/archive/map/moments?ids=${ids.slice(0, 200).join(",")}`),
  });

  return (
    <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: colors.ground }}>
      <ScreenHeader title={title || "لحظاتي"} back="/map" />
      {state.isLoading || !me ? (
        <Spinner style={{ marginTop: 50 }} color={colors.clay} />
      ) : (
        <FlatList
          data={state.data?.moments ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 40, gap: 4 }}
          renderItem={({ item }) => <MomentCard moment={item} viewerId={me.id} isPlus={me.isPlus} />}
          ListEmptyComponent={
            <View style={{ paddingTop: 40, alignItems: "center" }}>
              <Text style={{ color: colors.groundInk, fontSize: 13 }}>ما فيه لحظات هنا.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
