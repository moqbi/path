import { useMemo } from "react";
import { View, Text, SectionList, RefreshControl, ActivityIndicator, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MomentCard, SPINE_W } from "../../components/moment-card";
import { SPINE_X } from "../../components/spine";
import { CoverLayer } from "../../components/cover";
import { Avatar } from "../../components/avatar";
import { AthrMark } from "../../components/brand";
import { MessageIcon, PlusIcon, RefreshIcon, SparkIcon, StarIcon } from "../../components/icons";
import { useFeed, type Moment } from "../../lib/queries";
import { useSession } from "../../lib/session";
import { dayLabel, membership } from "../../lib/format";
import { colors } from "../../theme/tokens";

const COVER = 176;

/**
 * الخط الزمني.
 *
 * الرأس ثابت — العلامة و«أثر+» والرسائل — ثم الغلاف وفيه صورتك جالسةٌ
 * على محور الخيط، ومن أسفلها ينزل الخيط إلى لحظات اليوم. واللحظات
 * وحدها تمرّ تحته.
 */
export default function Timeline() {
  const me = useSession((s) => s.me);
  const feed = useFeed("");
  const router = useRouter();

  const moments = useMemo(
    () => feed.data?.pages.flatMap((page) => page.moments) ?? [],
    [feed.data],
  );

  // اللحظات تُجمَّع تحت فواصل الأيام، فالخط يُقرأ يوميات لا تدفّقاً.
  const days = useMemo(() => {
    const out: { title: string; data: Moment[] }[] = [];
    for (const moment of moments) {
      const label = dayLabel(new Date(moment.createdAt));
      const last = out.at(-1);
      if (last && last.title === label) last.data.push(moment);
      else out.push({ title: label, data: [moment] });
    }
    return out;
  }, [moments]);

  if (!me) return null;

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.paper }}>
      {/* الرأس: العلامة ثم ATHR، و«أثر+» قبل الرسائل. */}
      <View
        style={{
          flexDirection: "row-reverse",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 20,
          paddingTop: 6,
          paddingBottom: 10,
          backgroundColor: colors.chrome,
        }}
      >
        <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 9 }}>
          <AthrMark size={26} />
          <Text style={{ color: colors.chromeInk, fontSize: 19, fontWeight: "700", letterSpacing: 2 }}>
            ATHR
          </Text>
        </View>

        <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6 }}>
          <Pressable
            onPress={() => router.push("/subscribe" as never)}
            style={{
              flexDirection: "row-reverse",
              alignItems: "center",
              gap: 4,
              height: 32,
              paddingHorizontal: 12,
              borderRadius: 999,
              backgroundColor: colors.goldSoft,
              borderWidth: 1,
              borderColor: colors.goldLine,
            }}
          >
            <SparkIcon size={13} color={colors.goldInk} />
            <Text style={{ color: colors.goldInk, fontSize: 12, fontWeight: "700" }}>أثر+</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push("/messages" as never)}
            accessibilityLabel="المحادثات"
            style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}
          >
            <MessageIcon size={21} color={colors.chromeInk} />
          </Pressable>
        </View>
      </View>

      {/* الغلاف: صورتك على محور الخيط، والمدّة تحت الاسم، والتحديث مقابله. */}
      <View style={{ height: COVER, overflow: "hidden" }}>
        <CoverLayer mediaId={me.coverMediaId} spec={me.background?.spec} height={COVER} />

        <View
          style={{
            position: "absolute",
            insetInline: 0,
            bottom: 0,
            flexDirection: "row-reverse",
            alignItems: "flex-end",
            gap: 12,
            paddingHorizontal: 20,
            paddingBottom: 16,
          }}
        >
          <View style={{ width: SPINE_W, alignItems: "center" }}>
            <Avatar
              name={me.name}
              size={68}
              mediaId={me.avatarMediaId}
              frameSpec={me.frame?.spec}
              charm={me.charm}
            />
          </View>

          <View style={{ flex: 1, paddingBottom: 6 }}>
            <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6 }}>
              <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>{me.name}</Text>
              {me.isPlus ? <StarIcon size={12} color={colors.clay} /> : null}
              {me.tag ? (
                <View style={{ backgroundColor: me.tag.bg, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 }}>
                  <Text style={{ color: me.tag.fg, fontSize: 10, fontWeight: "700" }}>{me.tag.name}</Text>
                </View>
              ) : null}
            </View>
            <Text style={{ color: "rgba(255,255,255,.92)", fontSize: 11.5 }}>
              لك معانا {membership(me.createdAt)}
            </Text>
          </View>

          <Pressable
            onPress={() => void feed.refetch()}
            accessibilityLabel="تحديث الخط الزمني"
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(255,255,255,.22)",
              marginBottom: 4,
            }}
          >
            <RefreshIcon size={17} color="#fff" />
          </Pressable>
        </View>

        {/* الخيط يبدأ من أسفل الصورة داخل الغلاف نفسه. */}
        <View
          style={{
            position: "absolute",
            insetInlineEnd: SPINE_X,
            bottom: 0,
            width: 1,
            height: 10,
            backgroundColor: "rgba(255,255,255,.75)",
          }}
        />
      </View>

      <SectionList
        sections={days}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 90, flexGrow: 1 }}
        style={{ backgroundColor: colors.paper }}
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
        renderSectionHeader={({ section }) => (
          <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 12, paddingVertical: 16 }}>
            <View style={{ width: SPINE_W, alignItems: "center" }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.line }} />
            </View>
            <Text style={{ color: colors.ink2, fontSize: 15, fontWeight: "700" }}>{section.title}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <MomentCard moment={item} viewerId={me.id} isPlus={me.isPlus} />
        )}
        ListEmptyComponent={
          feed.isLoading ? (
            <ActivityIndicator style={{ marginTop: 50 }} color={colors.clay} />
          ) : (
            <View style={{ marginTop: 40, borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, padding: 24 }}>
              <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "700", textAlign: "center", marginBottom: 6 }}>
                خطك الزمني فارغ
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12.5, textAlign: "center", lineHeight: 22 }}>
                اضغط الزائد وانشر لحظتك الأولى، أو انتظر أحداً من أصدقائك ينشر.
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          feed.isFetchingNextPage ? (
            <ActivityIndicator style={{ paddingVertical: 18 }} color={colors.clay} />
          ) : null
        }
      />

      {/* الزائد: النشر في متناول الإبهام، في الطرف المقابل للخيط. */}
      <Pressable
        onPress={() => router.push("/compose" as never)}
        accessibilityLabel="انشر لحظة"
        style={{
          position: "absolute",
          insetInlineStart: 20,
          bottom: 22,
          width: 58,
          height: 58,
          borderRadius: 29,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.night,
          shadowColor: "#000",
          shadowOpacity: 0.3,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 6,
        }}
      >
        <PlusIcon size={26} color={colors.clay} />
      </Pressable>
    </SafeAreaView>
  );
}
