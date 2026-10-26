import { Spinner } from "../../components/spinner";
import { useBarSpace } from "../../components/glass-bar";
import { usePullLogo } from "../../components/logo-refresh";
import { TabBackdrop } from "../../components/tab-backdrop";
import { scrolled } from "../../lib/scrolled";
import { useEffect, useMemo, useRef, useState } from "react";
import { View, SectionList, Pressable, Alert, Animated, AccessibilityInfo } from "react-native";
import { Text } from "../../components/type";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { ProfileHead } from "../../components/profile-head";
import { Spot } from "../../components/spot";
import { COVER_HEIGHT, CoverLayer, StretchCover, useStretch } from "../../components/cover";
import { useTabTop } from "../../lib/tab-top";
import { openAccounts, useDoubleTapSwitch } from "../../components/accounts-sheet";
import { playRefresh } from "../../lib/sound";
import { MomentCard, SPINE_W, SpineThread } from "../../components/moment-card";
import { AthrMark } from "../../components/brand";
import { DEV_FEATURES } from "../../lib/dev-features";
import {
  BookIcon, CalendarIcon, ExitIcon, GearIcon, GiftIcon, PencilIcon, SparkIcon, StarIcon, WithIcon,
} from "../../components/icons";
import { api } from "../../lib/api";
import { keys, type Moment } from "../../lib/queries";
import { useSession } from "../../lib/session";
import { ar, dayLabel } from "../../lib/format";
import { useStatusNotes } from "../../lib/status-notes";
import { colors } from "../../theme/tokens";
import { useScrollLock } from "../../lib/scroll-lock";

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
      <Text style={{ color: colors.groundInk, fontSize: 10, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

/** رقمٌ يعدّ من الصفر إلى قيمته — ومن طلب «قلّل الحركة» يراه في الحال (القاعدة ٣٦). */
function CountUp({ to }: { to: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0;
    let dead = false;
    AccessibilityInfo.isReduceMotionEnabled().then((still) => {
      if (dead) return;
      if (still || to === 0) return setN(to);
      const t0 = Date.now();
      const step = () => {
        const p = Math.min(1, (Date.now() - t0) / 900);
        setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    });
    return () => {
      dead = true;
      cancelAnimationFrame(raf);
    };
  }, [to]);
  return <>{ar(n)}</>;
}

/** الإحصاءاتُ سطرٌ يُقرأ جملةً لا أربعةُ أعمدة: الرقمُ ثقيلٌ والكلمةُ بعده باهتة،
 *  والهديتان رقمان: ما أهديتَه وما أُهدي لك، والصفرُ منهما لا يُكتب (القاعدة ٢٩٣). */
function StatLine({ s }: { s?: { moments: number; friends: number; sent: number; got: number } }) {
  const item = (to: number, label: string) => (
    <Text style={{ color: colors.groundInk, fontSize: 13 }}>
      <Text style={{ color: colors.groundInk, fontSize: 15, fontWeight: "800" }}>
        <CountUp to={to} />
      </Text>{" "}
      {label}
    </Text>
  );
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 14, rowGap: 2, paddingHorizontal: 20, marginTop: 10 }}>
      {item(s?.moments ?? 0, "لحظة")}
      {item(s?.friends ?? 0, "صديق")}
      {s?.sent ? item(s.sent, "أهديت") : null}
      {s?.got ? item(s.got, "أُهدي لك") : null}
    </View>
  );
}

/** قرصُ أيقونةٍ في الرأس الداكن — ٤٠ كبقية الرؤوس (القاعدة ٥٢). */
const HEAD_DISC = {
  width: 40,
  height: 40,
  borderRadius: 20,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "rgba(255,255,255,.08)",
} as const;

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
  // صورُ اللحظة تُسحب أفقياً: القائمةُ تقف ما دامت (`lib/scroll-lock.ts`).
  const scrollLocked = useScrollLock((state) => state.locked);
  const [refreshing, setRefreshing] = useState(false);
  const refreshMe = useSession((state) => state.refresh);
  const reload = () => {
    playRefresh();
    setRefreshing(true);
    void Promise.all([refreshMe(), stats.refetch(), mine.refetch()]).finally(() => setRefreshing(false));
  };
  const pull = usePullLogo({ refreshing, onRefresh: reload, tint: "#fff", y: scrollY });
  useTabTop(() => list.current?.getScrollResponder()?.scrollTo({ y: 0, animated: true }));
  // تعدّدُ الحسابات (القاعدة ٣١٦) في نسخة التطوير وحدها حتى يُجرَّب.
  useDoubleTapSwitch(DEV_FEATURES);

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

        {/* الإعداداتُ والتقويم في الرأس (القاعدة ٢٩٢) — في نسخة التطوير حتى البناء القادم. */}
        {DEV_FEATURES ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Pressable
              onPress={() => router.push("/calendar" as never)}
              hitSlop={6}
              accessibilityLabel="التقويم"
              style={HEAD_DISC}
            >
              <CalendarIcon size={20} color={colors.chromeInk} />
            </Pressable>
            <Spot id="me.settings">
              <Pressable
                onPress={() => router.push("/settings" as never)}
                hitSlop={6}
                accessibilityLabel="الإعدادات"
                style={HEAD_DISC}
              >
                <GearIcon size={20} color={colors.chromeInk} />
              </Pressable>
            </Spot>
          </View>
        ) : null}
      </View>

      <View style={{ flex: 1 }}>
      <Animated.SectionList
        ref={list as never}
        scrollEnabled={!scrollLocked}
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
        {...pull.props}
        ListHeaderComponent={
          <>
            <StretchCover y={scrollY} height={COVER}>
              <CoverLayer mediaId={me.coverMediaId} themeMediaId={me.background?.coverMediaId} spec={me.background?.spec} height={COVER} x={me.coverX} y={me.coverY} zoom={me.coverZoom} />
            </StretchCover>
            {DEV_FEATURES ? (
              // التعديلُ والإكسسوارات على الغلاف في طرفه الأيسر (القاعدة ٣٢٣): سطرُ الاسم
              // يضيق بالوسم. أقراصٌ داكنة لا شفّافة (القاعدة ٥٧)، والصورةُ في الطرف الآخر.
              <View style={{ position: "absolute", top: COVER - 48, left: 16, flexDirection: "row", gap: 8, zIndex: 5 }}>
                <Spot id="me.edit">
                  <Pressable
                    accessibilityLabel="تعديل الملف"
                    onPress={() => router.push("/me/edit" as never)}
                    hitSlop={6}
                    style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(14,26,36,0.6)", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" }}
                  >
                    <PencilIcon size={16} color="#FFFFFF" />
                  </Pressable>
                </Spot>
                <Spot id="me.accessories">
                  <Pressable
                    accessibilityLabel="إكسسواراتي"
                    onPress={() => router.push("/me/accessories" as never)}
                    hitSlop={6}
                    style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(14,26,36,0.6)", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" }}
                  >
                    <SparkIcon size={16} color="#F6B93B" />
                  </Pressable>
                </Spot>
              </View>
            ) : null}

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
              onAccounts={DEV_FEATURES ? openAccounts : undefined}
              marquee={DEV_FEATURES}
            />

            {DEV_FEATURES ? (
              <StatLine s={s} />
            ) : (
            <View style={{ alignItems: "center", paddingHorizontal: 20 }}>
              {/* أربعة أرقام بأيقوناتها. */}
              <View style={{ flexDirection: "row", alignItems: "stretch", maxWidth: 330, width: "100%", marginTop: 14, marginBottom: 6 }}>
                <Stat first icon={<BookIcon size={14} color={colors.ink2} />} value={ar(s?.moments ?? 0)} label="لحظة" />
                <Stat first={false} icon={<WithIcon size={14} color={colors.ink2} />} value={ar(s?.friends ?? 0)} label="صديق" />
                <Stat first={false} icon={<GiftIcon size={14} color={colors.ink2} />} value={ar(s?.sent ?? 0)} label="أهديت" />
                <Stat first={false} icon={<GiftIcon size={14} color={colors.ink2} />} value={ar(s?.got ?? 0)} label="أُهدي لك" />
              </View>
            </View>
            )}

            {DEV_FEATURES ? <View style={{ height: 14 }} /> : (
            <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 20, marginTop: 10, marginBottom: 18 }}>
              {/* أهدافُ الجولة: كلُّ زرٍّ يُضاء في دوره. */}
              <Spot id="me.edit" grow>
                <Action grow label="تعديل الملف" onPress={() => router.push("/me/edit" as never)} />
              </Spot>
              <Spot id="me.accessories" grow>
                <Action grow label="إكسسواراتي" onPress={() => router.push("/me/accessories" as never)} />
              </Spot>
              {DEV_FEATURES ? null : (
                <Spot id="me.settings">
                  <Action label="الإعدادات" icon={<GearIcon size={18} color={colors.ink2} />} onPress={() => router.push("/settings" as never)} />
                </Spot>
              )}
              <Action
                label="خروج"
                icon={<ExitIcon size={18} color={colors.ink2} />}
                onPress={() =>
                  Alert.alert("تسجيل الخروج", "تريد الخروج من حسابك؟", [
                    { text: "لا", style: "cancel" },
                    {
                      text: "اخرج",
                      style: "destructive",
                      onPress: () => void signOut().then((moved) => router.replace(moved ? "/" : "/login")),
                    },
                  ])
                }
              />
            </View>
            )}

            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 4 }}>
              <Text style={{ color: colors.groundInk, fontSize: 15, fontWeight: "700" }}>
                لحظاتي <Text style={{ color: colors.groundInk, fontSize: 12, fontWeight: "400" }}>{ar(s?.moments ?? 0)}</Text>
              </Text>
              {/* «أرشيفي» و«سنتك في كتاب» (القاعدة ٢٤٤): بابُهما عند لحظاتك لا بعد آخرها. */}
              <Spot id="me.archive">
              <Pressable
                onPress={() => router.push("/me/archive" as never)}
                hitSlop={8}
                style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, height: 32, borderRadius: 16, backgroundColor: colors.goldSoft }}
              >
                <BookIcon size={14} color={colors.clayInk} />
                <Text style={{ color: colors.clayInk, fontSize: 12.5, fontWeight: "700" }}>{DEV_FEATURES ? "المعرض وكتاب سنتي" : "أرشيفي وكتاب سنتي"}</Text>
              </Pressable>
              </Spot>
            </View>
          </>
        }
        renderSectionHeader={({ section }) => (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 16 }}>
            <View style={{ width: SPINE_W, alignItems: "center", justifyContent: "center", alignSelf: "stretch" }}>
              <SpineThread top={-16} bottom={-16} />
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.groundInk, opacity: 0.45 }} />
            </View>
            <Text style={{ color: colors.groundInk, fontSize: 15, fontWeight: "700" }}>{section.title}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 20 }}>
            <MomentCard moment={item} viewerId={me.id} isPlus={me.isPlus} />
          </View>
        )}
        ListEmptyComponent={
          mine.isLoading ? (
            <Spinner style={{ marginTop: 24 }} color={colors.clay} />
          ) : (
            <View style={{ marginHorizontal: 20, borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, paddingVertical: 32, paddingHorizontal: 16 }}>
              <Text style={{ color: colors.muted, fontSize: 13, textAlign: "center" }}>
                ما نشرت شي بعد. اضغط الزائد في «اللحظات».
              </Text>
            </View>
          )
        }
      />
      {pull.overlay}
      </View>

    </SafeAreaView>
  );
}
