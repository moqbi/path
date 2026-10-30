import { useEffect, useRef, useState } from "react";
import { Animated, Easing, LayoutAnimation, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { INTERESTS, INTERESTS_MAX, INTERESTS_MIN, cleanInterests, interestOf } from "@athar/shared";
import { Text } from "../components/type";
import { AthrMark } from "../components/brand";
import { SceneGround } from "../components/login-scene";
import { showToast } from "../components/accounts-sheet";
import { Spinner } from "../components/spinner";
import { BackIcon, CheckIcon } from "../components/icons";
import { api } from "../lib/api";
import { ar } from "../lib/format";
import { useSession } from "../lib/session";
import { colors } from "../theme/tokens";

const AMBER = "#F6B93B";
const GLASS = "rgba(255,255,255,.08)";
const GLASS_LINE = "rgba(255,255,255,.14)";

/**
 * اختيارُ الاهتمامات (القاعدة ٣٧٤) — **بقرار المالك**، بعد الدخول وبهيئة شاشته (أرضيّةُ
 * الإطلاق ونجومُها): التصنيفاتُ ظاهرة، والضغطُ على أحدها يفتح قائمتَه تحته، وفي
 * الأسفل ما اختير بعدّادٍ من عشرة. من ثلاثةٍ إلى عشرة، و«تخطّي» يختم القرار بلا اختيار.
 * و`?edit=1` من «تعديل الملف»: رجوعٌ لا تخطٍّ، و«احفظ».
 */
export default function Interests() {
  const { edit, welcome } = useLocalSearchParams<{ edit?: string; welcome?: string }>();
  const editing = edit === "1";
  const router = useRouter();
  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/me/edit" as never));
  const insets = useSafeAreaInsets();
  const me = useSession((s) => s.me);
  const refresh = useSession((s) => s.refresh);
  const [picked, setPicked] = useState<string[]>(() => cleanInterests(me?.interests ?? []));
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const enter = useRef(new Animated.Value(0)).current;

  // «تم تسجيل الدخول بـ…» بهيئة «تمّ التبديل» (القاعدة ٣١٦) — بعد الدخول وحده.
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    if (!editing && welcome === "1" && me) showToast({ name: me.name, avatarMediaId: me.avatarMediaId, lead: "تم تسجيل الدخول بـ", place: "top" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (id: string) => {
    setProblem(null);
    setPicked((now) => {
      if (now.includes(id)) return now.filter((one) => one !== id);
      if (now.length >= INTERESTS_MAX) {
        setProblem(`اختر ${ar(INTERESTS_MAX)} اهتمامات على الأكثر`);
        return now;
      }
      return [...now, id];
    });
  };

  const expand = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.create(220, "easeInEaseOut", "opacity"));
    setOpen((now) => (now === id ? null : id));
  };

  const done = () => {
    if (editing) goBack();
    else router.replace("/" as never);
  };

  const save = async (skip = false) => {
    if (busy) return;
    if (!skip && picked.length > 0 && picked.length < INTERESTS_MIN) {
      setProblem(`اختر ${ar(INTERESTS_MIN)} اهتمامات على الأقل`);
      return;
    }
    setBusy(true);
    try {
      await api("/v1/me/interests", { method: "PUT", body: JSON.stringify(skip ? { ids: [], skip: true } : { ids: picked }) });
      await refresh().catch(() => {});
      done();
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "تعذّر الحفظ");
    } finally {
      setBusy(false);
    }
  };

  const ready = picked.length >= INTERESTS_MIN || (editing && picked.length === 0);

  return (
    <View style={{ flex: 1, backgroundColor: "#09151c" }}>
      {/* من «تعديل الملف» يُرجع بالسحب، وبعد الدخول لا رجوعَ إلى شاشة الدخول. */}
      <Stack.Screen options={{ gestureEnabled: editing }} />
      <SceneGround />

      <Animated.View
        style={{
          flex: 1,
          opacity: enter,
          transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
        }}
      >
        {/* الرأس: الرجوعُ أو «تخطّي» في طرفٍ والعلامةُ في الآخر (القاعدة ٣٣٠). */}
        <View
          style={{
            paddingTop: insets.top + (editing ? 6 : 46),
            paddingHorizontal: 20,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {editing ? (
            <Pressable accessibilityLabel="رجوع" onPress={goBack} hitSlop={10} style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: GLASS }}>
              <BackIcon size={18} color="#fff" />
            </Pressable>
          ) : (
            <AthrMark size={28} />
          )}
          {editing ? (
            <AthrMark size={28} />
          ) : (
            <Pressable accessibilityRole="button" onPress={() => void save(true)} disabled={busy} hitSlop={10} style={{ paddingHorizontal: 14, height: 34, borderRadius: 17, justifyContent: "center", backgroundColor: GLASS, borderWidth: 1, borderColor: GLASS_LINE }}>
              <Text style={{ color: "rgba(255,255,255,.85)", fontSize: 13, fontWeight: "700" }}>تخطّي</Text>
            </Pressable>
          )}
        </View>

        <View style={{ paddingHorizontal: 22, paddingTop: 18, gap: 6 }}>
          <Text style={{ color: AMBER, fontSize: 12.5, fontWeight: "800", letterSpacing: 0.4 }}>اختيار اهتماماتك</Text>
          <Text style={{ color: "#fff", fontSize: 26, fontWeight: "800" }}>ما الأشياء التي تحبها؟</Text>
          <Text style={{ color: "rgba(255,255,255,.7)", fontSize: 14 }}>
            اختر من {ar(INTERESTS_MIN)} إلى {ar(INTERESTS_MAX)} اهتمامات تعبّر عنك
          </Text>
        </View>

        <ScrollView
          style={{ flex: 1, marginTop: 14 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 10 }}
          showsVerticalScrollIndicator={false}
        >
          {INTERESTS.map((group) => {
            const isOpen = open === group.id;
            const count = group.items.filter((item) => picked.includes(item.id)).length;
            return (
              <View
                key={group.id}
                style={{
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: isOpen ? "rgba(246,185,59,.45)" : GLASS_LINE,
                  backgroundColor: isOpen ? "rgba(255,255,255,.1)" : GLASS,
                  overflow: "hidden",
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isOpen }}
                  onPress={() => expand(group.id)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, height: 56 }}
                >
                  <Text style={{ fontSize: 22 }}>{group.emoji}</Text>
                  <Text style={{ flex: 1, color: "#fff", fontSize: 15.5, fontWeight: "700" }}>{group.label}</Text>
                  {count ? (
                    <View style={{ minWidth: 24, height: 24, paddingHorizontal: 7, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: AMBER }}>
                      <Text style={{ color: "#0E1A24", fontSize: 12, fontWeight: "800" }}>{ar(count)}</Text>
                    </View>
                  ) : null}
                  <Text style={{ color: "rgba(255,255,255,.6)", fontSize: 18, transform: [{ rotate: isOpen ? "-90deg" : "0deg" }] }}>‹</Text>
                </Pressable>
                {isOpen ? (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 14, paddingBottom: 14 }}>
                    {group.items.map((item) => {
                      const on = picked.includes(item.id);
                      return (
                        <Pressable
                          key={item.id}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: on }}
                          onPress={() => toggle(item.id)}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 5,
                            height: 36,
                            paddingHorizontal: 14,
                            borderRadius: 18,
                            borderWidth: 1,
                            borderColor: on ? AMBER : GLASS_LINE,
                            backgroundColor: on ? AMBER : "rgba(255,255,255,.06)",
                          }}
                        >
                          {on ? <CheckIcon size={13} color="#0E1A24" /> : null}
                          <Text style={{ color: on ? "#0E1A24" : "#fff", fontSize: 13.5, fontWeight: "700" }}>{item.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            );
          })}
        </ScrollView>

        {/* اهتماماتك المختارة وعدّادُها، ثمّ الزرّ — حيث يصل الإبهام. */}
        <View
          style={{
            paddingTop: 12,
            paddingBottom: insets.bottom + 14,
            paddingHorizontal: 16,
            gap: 10,
            borderTopWidth: 1,
            borderTopColor: GLASS_LINE,
            backgroundColor: "rgba(9,21,28,.82)",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ color: "#fff", fontSize: 13.5, fontWeight: "800" }}>اهتماماتك المختارة</Text>
            <Text style={{ color: picked.length >= INTERESTS_MIN ? AMBER : "rgba(255,255,255,.6)", fontSize: 13, fontWeight: "800" }}>
              {ar(picked.length)} / {ar(INTERESTS_MAX)}
            </Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, minHeight: 32 }}>
            {picked.length === 0 ? (
              <Text style={{ color: "rgba(255,255,255,.5)", fontSize: 12.5, alignSelf: "center" }}>اضغط تصنيفاً واختر منه</Text>
            ) : (
              picked.map((id) => {
                const one = interestOf(id);
                if (!one) return null;
                return (
                  <Pressable
                    key={id}
                    accessibilityLabel={`إزالة ${one.label}`}
                    onPress={() => toggle(id)}
                    style={{ flexDirection: "row", alignItems: "center", gap: 4, height: 32, paddingHorizontal: 10, borderRadius: 16, backgroundColor: "rgba(246,185,59,.16)", borderWidth: 1, borderColor: "rgba(246,185,59,.4)" }}
                  >
                    <Text style={{ fontSize: 12 }}>{one.emoji}</Text>
                    <Text style={{ color: "#fff", fontSize: 12.5, fontWeight: "700" }}>{one.label}</Text>
                    <Text style={{ color: "rgba(255,255,255,.6)", fontSize: 13 }}> ×</Text>
                  </Pressable>
                );
              })
            )}
          </ScrollView>
          {problem ? <Text style={{ color: colors.live, fontSize: 12.5, fontWeight: "600" }}>{problem}</Text> : null}
          <Pressable
            accessibilityRole="button"
            onPress={() => void save()}
            disabled={!ready || busy}
            style={{
              height: 50,
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: ready ? AMBER : "rgba(255,255,255,.12)",
            }}
          >
            {busy ? (
              <Spinner size="small" color="#0E1A24" />
            ) : (
              <Text style={{ color: ready ? "#0E1A24" : "rgba(255,255,255,.55)", fontSize: 15, fontWeight: "800" }}>
                {editing
                  ? "احفظ"
                  : ready
                    ? "متابعة"
                    : `اختر ${ar(INTERESTS_MIN - picked.length)} ${INTERESTS_MIN - picked.length === 1 ? "اهتماماً" : "اهتمامات"} بعد`}
              </Text>
            )}
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}
