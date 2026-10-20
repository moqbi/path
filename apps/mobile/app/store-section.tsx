import { useEffect } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { Text } from "../components/type";
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
  const { title, parts } = useStoreSection();
  const store = useStore();
  const data = store.data;

  // فُتحت بلا قسمٍ (إعادة تحميلٍ أو رابطٍ مباشر): لا شيء تعرضه، فترجع إلى المتجر.
  useEffect(() => {
    if (parts.length === 0) router.replace("/store" as never);
  }, [parts.length]);

  // كلُّ قسمٍ بأصنافه من الاستعلام بترتيبه، وما خلا منها (بيعٌ أُخفي بعد الفتح) لا يُرسم.
  const byId = new Map((data?.items ?? []).map((item) => [item.id, item]));
  const sections = parts
    .map((part) => ({ title: part.title, items: part.ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : [])) }))
    .filter((part) => part.items.length > 0);

  return (
    <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: colors.ground }}>
      <ScreenHeader title={title || "المتجر"} back="/store" />
      {!data ? (
        <ActivityIndicator style={{ marginTop: 50 }} color={colors.clay} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 }}>
          {/* قسمٌ واحد بلا عنوان، وأكثرُ منه كلٌّ بعنوان مجموعته (القاعدة ٣١٣). */}
          {sections.map((part) => (
            <View key={part.title}>
              {sections.length > 1 ? (
                <Text style={{ color: colors.groundInk, fontSize: 14, fontWeight: "700", marginBottom: 10 }}>{part.title}</Text>
              ) : null}
              <StoreGrid
                items={part.items}
                owned={data.owned}
                expires={data.expires ?? {}}
                isPlus={data.isPlus}
                coins={data.coins}
                daysHere={data.daysHere}
                equipped={data.equipped}
              />
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
