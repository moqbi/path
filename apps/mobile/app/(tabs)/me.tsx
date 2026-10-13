import { useBarSpace } from "../../components/glass-bar";
import { TabBackdrop } from "../../components/tab-backdrop";
import { scrolled } from "../../lib/scrolled";
import { useMemo, useRef, useState } from "react";
import { View, SectionList, Pressable, ActivityIndicator, Alert, Animated, RefreshControl } from "react-native";
import { Text } from "../../components/type";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { ProfileHead } from "../../components/profile-head";
import { Spot } from "../../components/spot";
import { COVER_HEIGHT, CoverLayer, StretchCover, useStretch } from "../../components/cover";
import { useTabTop } from "../../lib/tab-top";
import { playRefresh } from "../../lib/sound";
import { MomentCard, SPINE_W } from "../../components/moment-card";
import { AthrMark } from "../../components/brand";
import {
  BookIcon, ExitIcon, GearIcon, GiftIcon, SparkIcon, StarIcon, WithIcon,
} from "../../components/icons";
import { api } from "../../lib/api";
import { keys, type Moment } from "../../lib/queries";
import { useSession } from "../../lib/session";
import { ar, dayLabel } from "../../lib/format";
import { useStatusNotes } from "../../lib/status-notes";
import { colors } from "../../theme/tokens";

const COVER = COVER_HEIGHT;

function Stat({ icon, value, label, first }: { icon: React.ReactNode; value: string; label: string; first: boolean }) {
  return (
    <View
      style={{
        flex: 1,
        paddingHorizontal: 4,
        alignItems: "center",
        borderRightWidth: first ? 0 : 1,
        borderRightColor: colors.line,
      }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.chip,
          marginBottom: 4,
        }}
      >
        {icon}
      </View>
      <Text style={{ color: colors.groundInk, fontSize: 15, fontWeight: "700" }}>{value}</Text>
      <Text style={{ color: colors.groundMuted, fontSize: 10, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function Action({
  label,
  icon,
  onPress,
  grow,
}: {
  label?: string;
  icon?: React.ReactNode;
  onPress: () => void;
  grow?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      style={{
        height: 46,
        flexGrow: grow ? 1 : 0,
        width: grow ? undefined : 44,
        paddingHorizontal: grow ? 14 : 0,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: colors.line,
        backgroundColor: colors.card,
      }}
    >
      {label && grow ? (
        <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "600" }}>{label}</Text>
      ) : (
        icon
      )}
    </Pressable>
  );
}

/**
 * «أنا».
 *
 * الرأس ثابت — الغلاف والصورة والأرقام والأزرار — ولحظاتي وحدها تمرّ
 * تحته على الخيط نفسه الذي في «اللحظات».
 */
export default function Me() {
  // المحتوى يمرّ تحت الشريط الزجاجيّ، وآخرُه يُقرأ فوقه (القاعدة ٢٢٨).
  const barSpace = useBarSpace();
  // النوتُ فوق الصورة (القاعدة ٢٦٩).
  const statusNotes = useStatusNotes();
  const { me, signOut } = useSession();
  const router = useRouter();
  // حشوةُ الحافّة العليا في الرأس الداكن نفسه — انظر `components/screen-header.tsx`.
  const insets = useSafeAreaInsets();

  const stats = useQuery({
    queryKey: ["me", "stats"],
    queryFn: () => api<{ moments: number; friends: number; sent: number; got: number }>("/v1/me/stats"),
  });
  const mine = useQuery({
    queryKey: ["me", "moments"],
    queryFn: () => api<{ moments: Moment[] }>("/v1/me/moments?limit=40"),
  });

  /*
    السحبُ من أعلى يمدّ الغلاف ويُحدّث فعلاً — كاللحظات: صاحبُ الجلسة
    (غلافُه وإطارُه) ولحظاتُه وأرقامُه معاً. والضغطةُ على «أنا» وهو
    ظاهرٌ ترجع إلى الأعلى.
  */
  const { y: scrollY, onScroll } = useStretch();
  const list = useRef<SectionList<Moment>>(null);
  const [refreshing, setRefreshing] = useState(false);
  const refreshMe = useSession((state) => state.refresh);
  const reload = () => {
    playRefresh();
    setRefreshing(true);
    void Promise.all([refreshMe(), stats.refetch(), mine.refetch()]).finally(() => setRefreshing(false));
  };
  useTabTop(() => list.current?.getScrollResponder()?.scrollTo({ y: 0, animated: true }));

  const days = useMemo(() => {
    const out: { title: string; data: Moment[] }[] = [];
    for (const moment of mine.data?.moments ?? []) {
      const label = dayLabel(new Date(moment.createdAt));
      const last = out.at(-1);
      if (last && last.title === label) last.data.push(moment);
      else out.push({ title: label, data: [moment] });
    }
    return out;
  }, [mine.data]);

  if (!me) return null;

  const s = stats.data;

  return (
    <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: colors.ground }}>
      <TabBackdrop />
      {/* الرأس: العلامة، ففاصل، فاسم الشاشة — والمشاركة في الطرف المقابل. */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 20,
          paddingTop: insets.top + 6,
          paddingBottom: 10,
          backgroundColor: colors.chrome,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <AthrMark size={32} />
          <View style={{ width: 1, height: 18, backgroundColor: colors.chromeLine }} />
          <Text style={{ color: colors.chromeInk, fontSize: 16, fontWeight: "700" }}>
            الملف الشخصي
          </Text>
        </View>

      </View>

      <Animated.SectionList
        ref={list as never}
        // حقلُ التعليق داخل القائمة: آبل تُزيح المحتوى بقدر الكيبورد وتُظهر
        // الحقلَ المركَّز فوقه، فيرى الكاتبُ ما يكتب.
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        sections={days}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingBottom: barSpace + 8 }}
        onScroll={onScroll}
        onScrollBeginDrag={scrolled}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor="#fff" />}
        ListHeaderComponent={
          <>
            <StretchCover y={scrollY} height={COVER}>
              <CoverLayer mediaId={me.coverMediaId} spec={me.background?.spec} height={COVER} x={me.coverX} y={me.coverY} zoom={me.coverZoom} />
            </StretchCover>

            {/* الصورةُ في طرف البداية، والاسمُ بجانبها (القاعدة ٢٣٣). */}
            <ProfileHead
                  note={statusNotes.data?.notes.find((row) => row.authorId === me.id) ?? null}
              name={me.name}
              isPlus={me.isPlus}
              tag={me.tag}
              handle={me.handle}
              bio={me.bio}
              memberNo={me.memberNo}
              city={me.city}
              since={me.createdAt}
              mediaId={me.avatarMediaId}
              frame={me.frame}
              charm={me.charm}
              frameItem={me.frame}
              charmItem={me.charm}
            />

            <View style={{ alignItems: "center", paddingHorizontal: 20 }}>
              {/* أربعة أرقام بأيقوناتها. */}
              <View style={{ flexDirection: "row", alignItems: "stretch", maxWidth: 330, width: "100%", marginTop: 14, marginBottom: 6 }}>
                <Stat first icon={<BookIcon size={14} color={colors.ink2} />} value={ar(s?.moments ?? 0)} label="لحظة" />
                <Stat first={false} icon={<WithIcon size={14} color={colors.ink2} />} value={ar(s?.friends ?? 0)} label="صديق" />
                <Stat first={false} icon={<GiftIcon size={14} color={colors.ink2} />} value={ar(s?.sent ?? 0)} label="أهديت" />
                <Stat first={false} icon={<GiftIcon size={14} color={colors.ink2} />} value={ar(s?.got ?? 0)} label="أُهدي لك" />
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 20, marginTop: 10, marginBottom: 18 }}>
              {/* أهدافُ الجولة: كلُّ زرٍّ يُضاء في دوره. */}
              <Spot id="me.edit" grow>
                <Action grow label="تعديل الملف" onPress={() => router.push("/me/edit" as never)} />
              </Spot>
              <Spot id="me.accessories" grow>
                <Action grow label="إكسسواراتي" onPress={() => router.push("/me/accessories" as never)} />
              </Spot>
              <Spot id="me.settings">
                <Action label="الإعدادات" icon={<GearIcon size={18} color={colors.ink2} />} onPress={() => router.push("/settings" as never)} />
              </Spot>
              <Action
                label="خروج"
                icon={<ExitIcon size={18} color={colors.ink2} />}
                onPress={() =>
                  Alert.alert("تسجيل الخروج", "تريد الخروج من حسابك؟", [
                    { text: "لا", style: "cancel" },
                    {
                      text: "اخرج",
                      style: "destructive",
                      onPress: () => void signOut().then(() => router.replace("/login")),
                    },
                  ])
                }
              />
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 4 }}>
              <Text style={{ color: colors.groundInk, fontSize: 15, fontWeight: "700" }}>
                لحظاتي <Text style={{ color: colors.groundMuted, fontSize: 12, fontWeight: "400" }}>{ar(s?.moments ?? 0)}</Text>
              </Text>
              {/* «أرشيفي» و«سنتك في كتاب» (القاعدة ٢٤٤): بابُهما عند لحظاتك لا بعد آخرها. */}
              <Spot id="me.archive">
              <Pressable
                onPress={() => router.push("/me/archive" as never)}
                hitSlop={8}
                style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, height: 32, borderRadius: 16, backgroundColor: colors.goldSoft }}
              >
                <BookIcon size={14} color={colors.clayInk} />
                <Text style={{ color: colors.clayInk, fontSize: 12.5, fontWeight: "700" }}>أرشيفي وكتاب سنتي</Text>
              </Pressable>
              </Spot>
            </View>
          </>
        }
        renderSectionHeader={({ section }) => (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 16 }}>
            <View style={{ width: SPINE_W, alignItems: "center" }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.groundLine }} />
            </View>
            <Text style={{ color: colors.groundInk2, fontSize: 15, fontWeight: "700" }}>{section.title}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 20 }}>
            <MomentCard moment={item} viewerId={me.id} isPlus={me.isPlus} />
          </View>
        )}
        ListEmptyComponent={
          mine.isLoading ? (
            <ActivityIndicator style={{ marginTop: 24 }} color={colors.clay} />
          ) : (
            <View style={{ marginHorizontal: 20, borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, paddingVertical: 32, paddingHorizontal: 16 }}>
              <Text style={{ color: colors.muted, fontSize: 13, textAlign: "center" }}>
                ما نشرت شي بعد. اضغط الزائد في «اللحظات».
              </Text>
            </View>
          )
        }
      />

    </SafeAreaView>
  );
}
