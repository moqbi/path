import { Spinner } from "./spinner";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Pressable, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useNavigation, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { create } from "zustand";
import { Text } from "./type";
import { GlassSheet } from "./glass-sheet";
import { useBarSpace } from "./glass-bar";
import { Avatar } from "./avatar";
import { BackIcon, CheckIcon, PlusIcon, TrashIcon, UserIcon } from "./icons";
import { MAX_ACCOUNTS } from "../lib/accounts";
import { useSession } from "../lib/session";
import { ar } from "../lib/format";
import { colors } from "../theme/tokens";

const useAccountsSheet = create<{ open: boolean }>(() => ({ open: false }));

/** نافذةُ الحسابات (القاعدة ٣١٦) — من السهم بجانب الاسم في «أنا». */
export const openAccounts = () => useAccountsSheet.setState({ open: true });

/**
 * سطرٌ زجاجيّ فوق الشريط ثمّ يذهب: «تمّ التبديل إلى فلان» (القاعدة ٣١٦)، و«تمّ تفعيل
 * إشعارات القصص والنوت لفلان» (القاعدة ٣١٩) — بالهيئة نفسها، وجهٌ ثمّ سطر.
 */
const useSwitched = create<{
  face: { name: string; avatarMediaId: string | null; lead: string; at: number; place: "bottom" | "cover" | "top" } | null;
}>(() => ({ face: null }));

/**
 * يعرض السطرَ الزجاجيّ: `lead` قبل الاسم والاسمُ بعده بوزنٍ أثقل. و`place: "cover"` يُطفيه
 * على وسط الغلاف تحت الرأس (القاعدة ٣٣١) — جرسُ الملفّ في أعلاه، فالخبرُ حيث ضُغط.
 */
export function showToast(face: { name: string; avatarMediaId: string | null; lead: string; place?: "bottom" | "cover" | "top" }) {
  useSwitched.setState({ face: { ...face, place: face.place ?? "bottom", at: Date.now() } });
}

/**
 * التبديلُ كما في واتساب — **بقرار المالك**: نقرةٌ تحت الإصبع ساعةَ يُفهم القصد،
 * ونقرةُ نجاحٍ حين يكتمل، وسطرٌ في أسفل الشاشة يقول إلى من.
 */
async function switchTo(id: string): Promise<void> {
  await useSession.getState().switchAccount(id);
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  const me = useSession.getState().me;
  if (me) showToast({ name: me.name, avatarMediaId: me.avatarMediaId, lead: "تم التبديل إلى " });
}

/** في الجذر: يطفو فوق الشريط السفليّ، ويبهت بعد ثانيتين. */
export function SwitchToast() {
  const face = useSwitched((s) => s.face);
  const space = useBarSpace();
  const insets = useSafeAreaInsets();
  const show = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!face) return;
    AccessibilityInfo.announceForAccessibility?.(`${face.lead}${face.name}`);
    show.setValue(0);
    const run = Animated.sequence([
      Animated.timing(show, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.delay(1800),
      Animated.timing(show, { toValue: 0, duration: 260, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]);
    run.start(({ finished }) => finished && useSwitched.setState({ face: null }));
    return () => run.stop();
  }, [face?.at]);

  if (!face) return null;
  // «أعلى» لشاشةٍ بلا شريطٍ سفليّ — «تم تسجيل الدخول بـ…» فوق الاهتمامات (القاعدة ٣٧٤).
  const onCover = face.place === "cover" || face.place === "top";
  // يدخل من جهته: من أسفل فوق الشريط، ومن أعلى على الغلاف.
  const lift = show.interpolate({ inputRange: [0, 1], outputRange: [onCover ? -16 : 16, 0] });
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        // الرأسُ ٥٦ تحت الحافّة، والغلافُ ١٧٦ تحته — فالسطرُ في وسط الغلاف تقريباً.
        ...(face.place === "top"
          ? { top: insets.top + 8 }
          : onCover
            ? { top: insets.top + 56 + 70 }
            : { bottom: space - 4 }),
        alignItems: "center",
        zIndex: 60,
        opacity: show,
        transform: [{ translateY: lift }],
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingVertical: 6,
          paddingLeft: 14,
          paddingRight: 6,
          borderRadius: 22,
          backgroundColor: "rgba(20,24,28,.88)",
          maxWidth: "86%",
          shadowColor: "#000",
          shadowOpacity: 0.25,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        }}
      >
        <Avatar name={face.name} size={26} mediaId={face.avatarMediaId} />
        <Text numberOfLines={1} style={{ color: "#fff", fontSize: 13.5, fontWeight: "600", flexShrink: 1 }}>
          {face.lead}<Text style={{ fontWeight: "800", writingDirection: "auto" }}>{face.name}</Text>
        </Text>
      </View>
    </Animated.View>
  );
}

/**
 * الحساباتُ على الجهاز في نافذةٍ زجاجيّة — **بقرار المالك**، حسابان على الأكثر:
 * النشطُ بعلامة، والآخرُ ضغطةٌ تنقل إليه، و«إضافة حساب» ما دام في الجهاز مكان.
 * وتُركَّب في الجذر (القاعدة ١٣٧).
 */
export function AccountsSheet() {
  const open = useAccountsSheet((s) => s.open);
  if (!open) return null;
  return <Body close={() => useAccountsSheet.setState({ open: false })} />;
}

function Body({ close }: { close: () => void }) {
  const router = useRouter();
  const me = useSession((s) => s.me);
  const accounts = useSession((s) => s.accounts);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // النشطُ أوّلاً وإن لم تُكتب القائمةُ بعد.
  const rows = me
    ? [
        { id: me.id, name: me.name, memberNo: me.memberNo, avatarMediaId: me.avatarMediaId },
        ...accounts.filter((row) => row.id !== me.id),
      ]
    : accounts;

  async function run(key: string, job: () => Promise<void>) {
    setBusy(key);
    setError(null);
    try {
      await job();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "تعذّر ذلك");
    } finally {
      setBusy(null);
    }
  }

  return (
    <GlassSheet
      icon={<UserIcon size={20} color="#fff" />}
      title="الحسابات"
      subtitle={`حسابان على الأكثر — اضغط «أنا» مرّتين للتبديل`}
      onClose={close}
    >
      <View style={{ paddingBottom: 8 }}>
        {rows.map((row) => {
          const active = row.id === me?.id;
          return (
            <Pressable
              key={row.id}
              disabled={active || busy !== null}
              onPress={() =>
                void run(row.id, async () => {
                  await switchTo(row.id);
                  close();
                })
              }
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingVertical: 10,
                paddingHorizontal: 12,
                marginBottom: 8,
                borderRadius: 16,
                backgroundColor: active ? "rgba(255,255,255,.14)" : "rgba(255,255,255,.06)",
              }}
            >
              <Avatar name={row.name} size={44} mediaId={row.avatarMediaId} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ color: "#fff", fontSize: 15, fontWeight: "700", writingDirection: "auto" }}>
                  {row.name}
                </Text>
                <Text style={{ color: "rgba(255,255,255,.55)", fontSize: 11.5 }}>
                  عضوية رقم {ar(row.memberNo)}
                  {active ? " │ المفتوح الآن" : ""}
                </Text>
              </View>
              {busy === row.id ? (
                <Spinner color="#fff" />
              ) : active ? (
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.clay, alignItems: "center", justifyContent: "center" }}>
                  <CheckIcon size={16} color={colors.onBrand} />
                </View>
              ) : (
                <Pressable
                  accessibilityLabel={`إزالة ${row.name} من الجهاز`}
                  hitSlop={8}
                  disabled={busy !== null}
                  onPress={() => void run(`x${row.id}`, () => useSession.getState().removeAccount(row.id))}
                  style={{ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.08)" }}
                >
                  {busy === `x${row.id}` ? <Spinner color="#fff" size="small" /> : <TrashIcon size={16} color="rgba(255,255,255,.75)" />}
                </Pressable>
              )}
            </Pressable>
          );
        })}

        {rows.length < MAX_ACCOUNTS ? (
          <Pressable
            disabled={busy !== null}
            onPress={() =>
              void run("add", async () => {
                await useSession.getState().addAccount();
                close();
                router.replace("/login");
              })
            }
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 16,
              borderWidth: 1,
              borderStyle: "dashed",
              borderColor: "rgba(255,255,255,.25)",
            }}
          >
            <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.1)" }}>
              {busy === "add" ? <Spinner color="#fff" /> : <PlusIcon size={20} color="#fff" />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>إضافة حساب</Text>
              <Text style={{ color: "rgba(255,255,255,.55)", fontSize: 11.5 }}>يبقى هذا الحساب محفوظاً وترجع له بضغطة</Text>
            </View>
          </Pressable>
        ) : null}

        {error ? <Text style={{ color: "#FF9C84", fontSize: 12.5, textAlign: "center", marginTop: 10 }}>{error}</Text> : null}
      </View>
    </GlassSheet>
  );
}

/** في شاشة الدخول: من ضغط «إضافة حساب» ثمّ تراجع يعود إلى حسابه. */
export function BackToParked() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const parked = useSession((s) => s.parked);
  const me = useSession((s) => s.me);
  const [busy, setBusy] = useState(false);
  if (!parked || me) return null;
  return (
    <Pressable
      disabled={busy}
      onPress={async () => {
        setBusy(true);
        try {
          await switchTo(parked.id);
          router.replace("/");
        } catch {
          setBusy(false);
        }
      }}
      style={{
        position: "absolute",
        top: insets.top + 10,
        right: 16,
        zIndex: 5,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingVertical: 6,
        paddingLeft: 12,
        paddingRight: 6,
        borderRadius: 22,
        backgroundColor: "rgba(255,255,255,.12)",
      }}
    >
      <BackIcon size={16} color="#fff" />
      <Avatar name={parked.name} size={28} mediaId={parked.avatarMediaId} />
      {busy ? (
        <Spinner color="#fff" size="small" />
      ) : (
        <Text numberOfLines={1} style={{ color: "#fff", fontSize: 13, fontWeight: "700", maxWidth: 160, writingDirection: "auto" }}>
          {parked.name}
        </Text>
      )}
    </Pressable>
  );
}

/**
 * ضغطتان على «أنا» في أقلّ من ثلث ثانية تنقلان إلى الحساب الآخر — **بقرار المالك**.
 * يُسمع `tabPress` من الشريطين (آبل والزجاجيّ) أيّاً كان التبويبُ المفتوح، فالضغطةُ
 * الأولى من تبويبٍ آخر تفتح «أنا» والثانيةُ تبدّل. وبلا حسابٍ ثانٍ لا يفعل شيئاً،
 * والضغطةُ الواحدة تبقى رجوعاً إلى الأعلى (`useTabTop`).
 */
export function useDoubleTapSwitch(enabled = true) {
  const navigation = useNavigation();
  const last = useRef(0);
  useEffect(() => {
    if (!enabled) return;
    const nav = navigation as unknown as { addListener: (event: "tabPress", run: () => void) => () => void };
    return nav.addListener("tabPress", () => {
      const now = Date.now();
      if (now - last.current > 350) {
        last.current = now;
        return;
      }
      last.current = 0;
      const { me, parked } = useSession.getState();
      if (!me || !parked) return;
      // النقرةُ ساعةَ تُفهم الضغطتان، قبل أن يُسأل الخادم.
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
      void switchTo(parked.id).catch(() => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
        openAccounts();
      });
    });
  }, [navigation, enabled]);
}
