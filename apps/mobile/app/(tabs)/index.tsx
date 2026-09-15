import { useMemo } from "react";
import { View, Text, SectionList, RefreshControl, ActivityIndicator, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MomentCard, SPINE_W } from "../../components/moment-card";
import { SPINE_X } from "../../components/spine";
import { CoverLayer } from "../../components/cover";
import { Avatar } from "../../components/avatar";
import { AthrMark } from "../../components/brand";
import { MessageIcon, RefreshIcon, SparkIcon, StarIcon } from "../../components/icons";
import { ComposerFan } from "../../components/composer-fan";
import { Tour } from "../../components/tour";
import { useCircle, useFeed, useTogether, type Moment } from "../../lib/queries";
import { useSession } from "../../lib/session";
import { ar, dayLabel, membership, MONTHS } from "../../lib/format";
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
  const router = useRouter();

  /*
    العدسات ثلاثٌ في الخط الزمني نفسه لا ثلاثُ صفحات: الرأس والغلاف
    والصورة تبقى، ويتبدّل ما تحتها وحده.
  */
  const params = useLocalSearchParams<{ view?: string; with?: string }>();
  const view = params.view === "private" || params.view === "together" ? params.view : "";
  const withId = view === "together" ? (params.with ?? "") : "";

  const feed = useFeed(view === "private" ? "private" : "");
  const together = useTogether(withId);
  const circle = useCircle();

  const lensMoments = useMemo(
    () =>
      view === "together"
        ? (together.data?.moments ?? [])
        : (feed.data?.pages.flatMap((page) => page.moments) ?? []),
    [view, together.data, feed.data],
  );
  const moments = lensMoments;

  const friend = circle.data?.members.find((person) => person.id === withId) ?? null;
  const since = together.data?.since ? new Date(together.data.since) : null;

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
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 20,
          paddingTop: 6,
          paddingBottom: 10,
          backgroundColor: colors.chrome,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
          <AthrMark size={34} />
          <Text style={{ color: colors.chromeInk, fontSize: 19, fontWeight: "700", letterSpacing: 2 }}>
            ATHR
          </Text>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Pressable
            onPress={() => router.push("/subscribe" as never)}
            style={{
              flexDirection: "row",
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
            flexDirection: "row",
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
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
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
            insetInlineStart: SPINE_X,
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
            refreshing={
              view === "together"
                ? together.isRefetching
                : feed.isRefetching && !feed.isFetchingNextPage
            }
            onRefresh={() => void (view === "together" ? together.refetch() : feed.refetch())}
            tintColor={colors.clay}
          />
        }
        onEndReachedThreshold={0.6}
        onEndReached={() => {
          if (view === "together") return;
          if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
        }}
        renderSectionHeader={({ section }) => (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 16 }}>
            <View style={{ width: SPINE_W, alignItems: "center" }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.line }} />
            </View>
            <Text style={{ color: colors.ink2, fontSize: 15, fontWeight: "700" }}>{section.title}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <MomentCard moment={item} viewerId={me.id} isPlus={me.isPlus} />
        )}
        ListHeaderComponent={
          <LensHead
            view={view}
            friend={friend}
            me={me}
            count={moments.length}
            since={since}
            people={circle.data?.members ?? []}
            onPick={(id) => router.setParams({ view: "together", with: id })}
            onClear={() => router.setParams({ view: "together", with: "" })}
          />
        }
        ListEmptyComponent={
          (view === "together" ? together.isLoading : feed.isLoading) ? (
            <ActivityIndicator style={{ marginTop: 50 }} color={colors.clay} />
          ) : view === "together" && !friend ? null : (
            <View style={{ marginTop: 40, borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, padding: 24 }}>
              <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "700", textAlign: "center", marginBottom: 6 }}>
                {view === "private"
                  ? "ما فيه لحظات خاصة"
                  : view === "together"
                    ? "ما فيه أثر بعد"
                    : "خطك الزمني فارغ"}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12.5, textAlign: "center", lineHeight: 22 }}>
                {view === "private"
                  ? "عند النشر اختر «من يراها» — تصنيفاً من أصدقائك أو أشخاصاً بأعيانهم."
                  : view === "together"
                    ? "أشِر إليه في لحظة، أو تفاعل مع لحظاته — وسيبدأ الخطّ المشترك."
                    : "اضغط الزائد وانشر لحظتك الأولى، أو انتظر أحداً من أصدقائك ينشر."}
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

      <ComposerFan />
      <Tour />
    </SafeAreaView>
  );
}


/**
 * ما فوق اللحظات في كل عدسة.
 *
 * «الخاصة» سطرٌ يشرح ما تراه، و«آثارنا» بطاقةُ العدد بينكما — أو قائمةُ
 * الأصدقاء إن لم يُختر صاحبها بعد. ولا شرائح تحت الغلاف ولا زرّ رجوع:
 * اسم التبويب يقول أيّ عدسةٍ مفتوحة.
 */
function LensHead({
  view,
  friend,
  me,
  count,
  since,
  people,
  onPick,
  onClear,
}: {
  view: string;
  friend: { id: string; name: string; avatarMediaId: string | null; frame: { spec: string } | null; charm: { spec: string; mediaId: string | null } | null } | null;
  me: { name: string; avatarMediaId: string | null };
  count: number;
  since: Date | null;
  people: { id: string; name: string; avatarMediaId: string | null; frame: { spec: string } | null; charm: { spec: string; mediaId: string | null } | null }[];
  onPick: (id: string) => void;
  onClear: () => void;
}) {
  if (view === "private") {
    return (
      <Text style={{ color: colors.muted, fontSize: 11.5, lineHeight: 19, paddingTop: 14, textAlign: "right" }}>
        ما نُشر لتصنيفٍ من أصدقائك أو لأشخاص بأعيانهم — غيرهم لا يراها أصلاً.
      </Text>
    );
  }

  if (view !== "together") return null;

  if (friend) {
    return (
      <View style={{ marginTop: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, padding: 16, alignItems: "center" }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
          <Avatar name={me.name} size={44} mediaId={me.avatarMediaId} />
          <View style={{ marginRight: -12 }}>
            <Avatar
              name={friend.name}
              size={44}
              frameSpec={friend.frame?.spec}
              charm={friend.charm}
              mediaId={friend.avatarMediaId}
            />
          </View>
        </View>

        <Text style={{ color: colors.clayInk, fontSize: 12.5, fontWeight: "600" }}>
          أثركما المشترك
        </Text>
        <Text style={{ color: colors.ink, fontSize: 28, marginVertical: 2 }}>{ar(count)}</Text>
        <Text style={{ color: colors.muted, fontSize: 12, textAlign: "center" }}>
          لحظة تجمعك بـ{friend.name}
          {since ? ` منذ ${MONTHS[since.getMonth()]} ${ar(since.getFullYear())}` : ""}
        </Text>

        <Pressable onPress={onClear} style={{ marginTop: 8 }}>
          <Text style={{ color: colors.clayInk, fontSize: 12, fontWeight: "600" }}>غيّر الصديق</Text>
        </Pressable>
      </View>
    );
  }

  if (people.length === 0) {
    return (
      <View style={{ marginTop: 40, borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, padding: 24 }}>
        <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "700", textAlign: "center", marginBottom: 6 }}>
          ما عندك أصدقاء بعد
        </Text>
        <Text style={{ color: colors.muted, fontSize: 12.5, textAlign: "center", lineHeight: 22 }}>
          أضف صديقاً أولاً من تبويب الأصدقاء.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ paddingTop: 14 }}>
      <Text style={{ color: colors.muted, fontSize: 11.5, lineHeight: 19, marginBottom: 8, textAlign: "right" }}>
        اختر صاحبك لترى ما جمعكما: إشارةٌ منه أو تفاعلٌ أو تعليق.
      </Text>

      <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, overflow: "hidden" }}>
        {people.map((person, index) => (
          <Pressable
            key={person.id}
            onPress={() => onPick(person.id)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              padding: 12,
              borderTopWidth: index === 0 ? 0 : 1,
              borderTopColor: colors.line,
            }}
          >
            <Avatar
              name={person.name}
              size={42}
              frameSpec={person.frame?.spec}
              charm={person.charm}
              mediaId={person.avatarMediaId}
            />
            <Text numberOfLines={1} style={{ flex: 1, color: colors.ink, fontSize: 14, fontWeight: "600", textAlign: "right" }}>
              {person.name}
            </Text>
            <Text style={{ color: colors.clayInk, fontSize: 12, fontWeight: "600" }}>أثرنا</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
