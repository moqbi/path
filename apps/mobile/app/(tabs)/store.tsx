import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { firstColor } from "../../components/avatar";
import { MediaImage } from "../../components/media-image";
import { ScreenHeader } from "../../components/screen-header";
import { useStore, type StoreItem } from "../../lib/queries";
import { riyals } from "../../lib/format";
import { colors } from "../../theme/tokens";

const KIND_LABEL: Record<string, string> = {
  FRAME: "إطار",
  THEME: "ثيم",
  CHARM: "تميمة",
  BACKGROUND: "خلفية",
};

/**
 * بطاقة صنف.
 *
 * السعر يُكتب دائماً ولو كان صفراً: «مجاني» خبرٌ كالسعر. والمملوك يُقال
 * «عندك» لا يُخفى — إخفاؤه يجعل صاحبه يبحث عنه ظنّاً أنّه ذهب.
 */
function Card({ item, owned }: { item: StoreItem; owned: boolean }) {
  return (
    <View
      style={{
        width: 128,
        marginEnd: 10,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.line,
        backgroundColor: colors.card,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          height: 84,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: firstColor(item.spec, colors.chip),
        }}
      >
        {item.mediaId ? (
          <MediaImage mediaId={item.mediaId} resizeMode="contain" style={{ width: 62, height: 62 }} />
        ) : null}
      </View>

      <View style={{ padding: 9, gap: 3 }}>
        <Text style={{ color: colors.ink, fontSize: 12.5, fontWeight: "700" }} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={{ color: colors.faint, fontSize: 10.5 }}>
          {KIND_LABEL[item.kind] ?? item.kind}
        </Text>
        <Text style={{ color: owned ? colors.clayInk : colors.ink2, fontSize: 11.5, fontWeight: "600" }}>
          {owned ? "عندك" : item.priceHalalas === 0 ? "مجاني" : riyals(item.priceHalalas)}
        </Text>
      </View>
    </View>
  );
}

function Row({ title, items, owned }: { title: string; items: StoreItem[]; owned: Set<string> }) {
  if (items.length === 0) return null;
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={{ color: colors.ink, fontSize: 14.5, fontWeight: "700", paddingHorizontal: 16, marginBottom: 9 }}>
        {title}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
        {items.map((item) => (
          <Card key={item.id} item={item} owned={owned.has(item.id)} />
        ))}
      </ScrollView>
    </View>
  );
}

export default function Store() {
  const store = useStore();
  const data = store.data;
  const owned = new Set(data?.owned ?? []);

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScreenHeader
        title="المتجر"
        right={
          data ? (
            <Text style={{ color: colors.chromeMuted, fontSize: 11.5 }}>{riyals(data.credit)}</Text>
          ) : null
        }
      />

      {store.isLoading ? (
        <View style={{ paddingTop: 60, alignItems: "center" }}>
          <ActivityIndicator color={colors.clay} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 28 }}
          refreshControl={
            <RefreshControl
              refreshing={store.isRefetching}
              onRefresh={() => void store.refetch()}
              tintColor={colors.clay}
            />
          }
        >
          <Row title="جديد" items={data?.rows.fresh ?? []} owned={owned} />
          <Row title="ثيمات" items={data?.rows.themes ?? []} owned={owned} />
          <Row title="محدود" items={data?.rows.limited ?? []} owned={owned} />
          <Row title="كل الأصناف" items={data?.items ?? []} owned={owned} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
