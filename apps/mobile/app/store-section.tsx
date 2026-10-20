import { useEffect } from "react";
import { ActivityIndicator, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ScreenHeader } from "../components/screen-header";
import { StoreGrid } from "../components/store-grid";
import { useStore } from "../lib/queries";
import { useStoreSection } from "../lib/store-section";
import { colors } from "../theme/tokens";

/**
 * «عرض الكل» صفحةٌ مستقلّة لا شبكةٌ تنفتح تحت الصفّ (القاعدة ٣١٠): قسمٌ بعشرات
 * الأصناف كان يدفع ما تحته من المتجر إلى أسفل حتى يضيع. والرجوعُ يعيد المتجرَ
 * حيث كان، بشريحته وموضع تمريره.
 */
export default function StoreSection() {
  const router = useRouter();
  const { title, ids } = useStoreSection();
  const store = useStore();
  const data = store.data;

  // فُتحت بلا قسمٍ (إعادة تحميلٍ أو رابطٍ مباشر): لا شيء تعرضه، فترجع إلى المتجر.
  useEffect(() => {
    if (ids.length === 0) router.replace("/store" as never);
  }, [ids.length]);

  const order = new Map(ids.map((id, index) => [id, index]));
  const items = (data?.items ?? [])
    .filter((item) => order.has(item.id))
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

  return (
    <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: colors.ground }}>
      <ScreenHeader title={title || "المتجر"} back="/store" />
      {!data ? (
        <ActivityIndicator style={{ marginTop: 50 }} color={colors.clay} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 }}>
          <StoreGrid
            items={items}
            owned={data.owned}
            expires={data.expires ?? {}}
            isPlus={data.isPlus}
            coins={data.coins}
            daysHere={data.daysHere}
            equipped={data.equipped}
          />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
