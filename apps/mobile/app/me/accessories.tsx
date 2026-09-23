import { View, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { Text } from "../../components/type";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ScreenHeader } from "../../components/screen-header";
import { MediaImage } from "../../components/media-image";
import { firstColor, frameInset } from "../../components/avatar";
import { CheckIcon } from "../../components/icons";
import { api } from "../../lib/api";
import { keys } from "../../lib/queries";
import { useSession } from "../../lib/session";
import { colors } from "../../theme/tokens";

type Kind = "FRAME" | "BACKGROUND" | "THEME" | "CHARM";

type Owned = {
  id: string;
  name: string;
  spec: string;
  kind: Kind;
  mediaId: string | null;
  /** اتّساعُ فراغ الإطار الأوسط: الوجه يجلس فيه لا في مربّع الرسم. */
  frameHole?: number | null;
  giftedBy: string | null;
};

type Row = {
  item: {
    id: string;
    name: string;
    spec: string;
    kind: Kind;
    mediaId: string | null;
    frameHole?: number | null;
  };
  giftedBy: { id: string; name: string } | null;
};

/**
 * الإكسسوارات: ما تملكه يُلبَس من ملفك، لا من المتجر.
 *
 * المتجر يبيع، والملف يُلبِس — هكذا يعرف صاحبه أين يجد ما اشتراه أو ما
 * أُهدي إليه. والأقسام أقسام المتجر نفسها: إطارات، وثيمات، وتمائم.
 */
export default function Accessories() {
  const me = useSession((state) => state.me);
  const refresh = useSession((state) => state.refresh);
  const client = useQueryClient();

  const mine = useQuery({
    queryKey: ["store", "mine"],
    queryFn: () => api<{ items: Row[] }>("/v1/store/mine"),
  });

  const after = async () => {
    await refresh();
    await client.invalidateQueries({ queryKey: keys.store });
    await client.invalidateQueries({ queryKey: keys.me });
  };

  const wear = useMutation({
    mutationFn: (id: string) => api(`/v1/store/${id}/equip`, { method: "POST" }),
    onSuccess: after,
  });
  const strip = useMutation({
    mutationFn: (kind: "FRAME" | "BACKGROUND" | "CHARM") =>
      api("/v1/store/unequip", { method: "POST", body: JSON.stringify({ kind }) }),
    onSuccess: after,
  });

  const owned: Owned[] = (mine.data?.items ?? []).map((row) => ({
    ...row.item,
    giftedBy: row.giftedBy?.name ?? null,
  }));

  const act = (item: Owned, on: boolean) => {
    if (on) {
      strip.mutate(item.kind === "FRAME" ? "FRAME" : item.kind === "CHARM" ? "CHARM" : "BACKGROUND");
      return;
    }
    wear.mutate(item.id);
  };

  return (
    <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScreenHeader title="إكسسواراتي" back="/me" />

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40, direction: "rtl" }}>
        <Text style={{ color: colors.muted, fontSize: 11.5, marginBottom: 14, textAlign: "right" }}>
          ما اشتريته وما أُهدي إليك — اضغط لتلبسه
        </Text>

        {mine.isLoading ? <ActivityIndicator color={colors.clay} /> : null}

        <Group
          title="الإطارات"
          empty="ما عندك إطارات بعد."
          items={owned.filter((item) => item.kind === "FRAME")}
          worn={me?.frame?.id ?? null}
          onPress={act}
        />
        <Group
          title="الثيمات"
          empty="ما عندك ثيمات بعد."
          items={owned.filter((item) => item.kind === "THEME" || item.kind === "BACKGROUND")}
          worn={me?.background?.id ?? null}
          onPress={act}
        />
        <Group
          title="التمائم"
          empty="ما عندك تمائم بعد."
          items={owned.filter((item) => item.kind === "CHARM")}
          worn={me?.charm?.id ?? null}
          onPress={act}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

/** قسمٌ واحد: عنوانه وشبكته، وحاله إن كان فارغاً. */
function Group({
  title,
  items,
  worn,
  empty,
  onPress,
}: {
  title: string;
  items: Owned[];
  worn: string | null;
  empty: string;
  onPress: (item: Owned, on: boolean) => void;
}) {
  const router = useRouter();

  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", marginBottom: 8, textAlign: "right" }}>
        {title}
      </Text>

      {items.length === 0 ? (
        <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, paddingHorizontal: 16, paddingVertical: 24, alignItems: "center" }}>
          <Text style={{ color: colors.muted, fontSize: 12.5, marginBottom: 8 }}>{empty}</Text>
          <Pressable onPress={() => router.push("/(tabs)/store" as never)}>
            <Text style={{ color: colors.clayInk, fontSize: 12.5, fontWeight: "700" }}>
              افتح المتجر
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {items.map((item) => {
            const on = worn === item.id;

            return (
              <Pressable
                key={item.id}
                onPress={() => onPress(item, on)}
                style={{
                  width: "31%",
                  alignItems: "center",
                  gap: 8,
                  borderRadius: 16,
                  borderWidth: on ? 1.5 : 1,
                  borderColor: on ? colors.clay : colors.line,
                  backgroundColor: colors.card,
                  paddingHorizontal: 8,
                  paddingTop: 14,
                  paddingBottom: 12,
                }}
              >
                <Art item={item} />

                <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 11.5, fontWeight: "500" }}>
                  {item.name}
                </Text>

                {item.giftedBy ? (
                  <Text numberOfLines={1} style={{ color: colors.goldInk, fontSize: 10 }}>
                    هدية من {item.giftedBy}
                  </Text>
                ) : null}

                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  {on ? <CheckIcon size={12} color={colors.clay} /> : null}
                  <Text style={{ color: on ? colors.clay : colors.muted, fontSize: 10.5, fontWeight: "600" }}>
                    {on ? "ملبوس — انزعه" : "ألبسه"}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

/** معاينة الصنف تتبع نوعه: الإطار حلقة، والتميمة قطعةٌ حرّة، والثيم مساحة. */
function Art({ item }: { item: Owned }) {
  const paint = firstColor(item.spec, colors.chip);

  if (item.kind === "FRAME") {
    /*
       الإطار المصوَّر **فوق** قرصٍ محايد لا خلفه، كما يُرى على الوجه
       (`Avatar`) وفي المتجر. وكان القرصُ فوقه يُخفي الرسمَ كلَّه —
       وهذا «الإطار ما يظهر» في إكسسواراتي.
    */
    if (item.mediaId) {
      const off = frameInset(item, 58);
      const face = 58 - off * 2;
      return (
        <View style={{ width: 58, height: 58 }}>
          <View
            style={{
              position: "absolute",
              left: off,
              top: off,
              width: face,
              height: face,
              borderRadius: face / 2,
              backgroundColor: colors.chip,
            }}
          />
          <MediaImage mediaId={item.mediaId} resizeMode="contain" style={{ width: 58, height: 58 }} />
        </View>
      );
    }

    return (
      <View style={{ width: 58, height: 58, borderRadius: 29, padding: 3, backgroundColor: paint }}>
        <View style={{ flex: 1, borderRadius: 26, backgroundColor: colors.card }} />
      </View>
    );
  }

  if (item.kind === "CHARM") {
    return (
      <View style={{ width: 50, height: 50, marginVertical: 4, alignItems: "center", justifyContent: "center" }}>
        {item.mediaId ? (
          <MediaImage mediaId={item.mediaId} resizeMode="contain" style={{ width: 50, height: 50 }} />
        ) : (
          <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: paint }} />
        )}
      </View>
    );
  }

  return (
    <View style={{ width: "100%", height: 58, borderRadius: 12, overflow: "hidden", backgroundColor: paint }}>
      {item.mediaId ? <MediaImage mediaId={item.mediaId} style={{ width: "100%", height: 58 }} /> : null}
    </View>
  );
}
