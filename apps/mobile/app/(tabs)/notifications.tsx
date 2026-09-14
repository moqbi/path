import { View, Text, FlatList, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Avatar } from "../../components/avatar";
import { MediaImage } from "../../components/media-image";
import { ScreenHeader } from "../../components/screen-header";
import { useNotes, type Note } from "../../lib/queries";
import { relative } from "../../lib/format";
import { colors } from "../../theme/tokens";

/**
 * الوجهة تُفكّ هنا.
 *
 * الخادم يرسل وجهةً منطقية (`moment:<id>`) لا مسار صفحة: الويب والموبايل
 * يرتّبان شاشاتهما كما يشاءان، والخادم لا يعرف تسمية أيّهما.
 */
function go(href: string): string | null {
  const [kind, id] = href.split(":");
  if (kind === "moment" && id) return `/m/${id}`;
  if (kind === "user" && id) return `/u/${id}`;
  if (kind === "circle") return "/circle";
  if (kind === "me") return "/me";
  return null;
}

export default function Notifications() {
  const notes = useNotes();
  const router = useRouter();

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScreenHeader title="الإشعارات" />

      <FlatList
        data={notes.data?.notes ?? []}
        keyExtractor={(item: Note) => item.id}
        contentContainerStyle={{ paddingVertical: 8, flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={notes.isRefetching}
            onRefresh={() => void notes.refetch()}
            tintColor={colors.clay}
          />
        }
        renderItem={({ item }) => {
          const target = go(item.href);
          return (
            <Pressable
              onPress={() => target && router.push(target as never)}
              style={{ flexDirection: "row-reverse", alignItems: "center", gap: 11, paddingHorizontal: 16, paddingVertical: 11 }}
            >
              <Avatar name={item.person.name} size={38} mediaId={item.person.avatarMediaId} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.ink, fontSize: 13.5, lineHeight: 21 }} numberOfLines={2}>
                  {item.text}
                </Text>
                <Text style={{ color: colors.faint, fontSize: 11 }}>
                  {relative(new Date(item.at))}
                </Text>
              </View>
              {item.thumb ? (
                <MediaImage mediaId={item.thumb} style={{ width: 40, height: 40, borderRadius: 8 }} />
              ) : null}
            </Pressable>
          );
        }}
        ListEmptyComponent={
          notes.isLoading ? (
            <View style={{ paddingTop: 60, alignItems: "center" }}>
              <ActivityIndicator color={colors.clay} />
            </View>
          ) : (
            <View style={{ paddingTop: 60, paddingHorizontal: 40 }}>
              <Text style={{ color: colors.muted, fontSize: 13.5, textAlign: "center" }}>
                لا إشعارات.
              </Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}
