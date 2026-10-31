import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text, TextInput } from "./type";
import { Spinner } from "./spinner";
import { AvatarEditor } from "../app/me/edit";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { useHandleCheck } from "../lib/handle";
import { colors } from "../theme/tokens";

const AMBER = "#F6B93B";
const GLASS = "rgba(255,255,255,.08)";
const GLASS_LINE = "rgba(255,255,255,.14)";
const HANDLE = /^[a-z0-9_]{3,20}$/;

const FIELD = {
  height: 48,
  borderRadius: 14,
  paddingHorizontal: 14,
  backgroundColor: GLASS,
  borderWidth: 1,
  borderColor: GLASS_LINE,
  color: "#fff",
  fontSize: 15,
} as const;

/**
 * الخطوةُ الأولى بعد الدخول (القاعدة ٣٧٦): صورةُ العرض والاسمُ والمعرّف بهيئة شاشة
 * الاهتمامات، ثمّ «متابعة» إليها. الاسمُ مكتوبٌ سلفاً (من التسجيل أو المزوّد)، والصورةُ
 * والمعرّفُ اختياريّان — «تخطّي» في الرأس يمضي إلى الاهتمامات بلا حفظ.
 */
export function ProfileStep({ onDone }: { onDone: () => void }) {
  const me = useSession((s) => s.me);
  const insets = useSafeAreaInsets();
  const refresh = useSession((s) => s.refresh);
  const [name, setName] = useState(me?.name ?? "");
  const [handle, setHandle] = useState(me?.handle ?? "");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [pictureError, setPictureError] = useState<string | null>(null);
  const check = useHandleCheck(handle, me?.handle);
  // اقتراحُ المعرّف (القاعدة ٣٧٧): لمن لا معرّفَ له يُكتب أوّلُ اقتراحٍ في الحقل مرّةً،
  // ولا يُكتب فوق ما كتبه بيده.
  const touched = useRef(Boolean(me?.handle));
  useEffect(() => {
    if (!touched.current && !handle && check.suggestions[0]) {
      touched.current = true;
      setHandle(check.suggestions[0]);
    }
  }, [check.suggestions, handle]);
  if (!me) return null;

  const clean = handle.trim().replace(/^@/, "").toLowerCase();
  const handleBad = clean.length > 0 && !HANDLE.test(clean);
  const ready = name.trim().length > 0 && !handleBad && check.status !== "bad";

  const save = async () => {
    if (busy || !ready) return;
    setBusy(true);
    setProblem(null);
    try {
      // `bio` يُرسَل كما هو: الخادمُ يقرأ غيابَه فراغاً فيمحوه. والمدينةُ والجنسُ يُتركان.
      await api("/v1/me", {
        method: "PATCH",
        body: JSON.stringify({ name: name.trim(), handle: clean, bio: me.bio ?? "" }),
      });
      await refresh().catch(() => {});
      onDone();
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "تعذّر الحفظ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 18, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: 6 }}>
          <Text style={{ color: AMBER, fontSize: 12.5, fontWeight: "800", letterSpacing: 0.4 }}>ملفّك الشخصي</Text>
          <Text style={{ color: "#fff", fontSize: 26, fontWeight: "800" }}>عرّف دائرتك بك</Text>
          <Text style={{ color: "rgba(255,255,255,.7)", fontSize: 14 }}>صورتك واسمك أوّل ما يراه أصدقاؤك</Text>
        </View>

        <View style={{ alignItems: "center", marginTop: 28 }}>
          <AvatarEditor
            name={name.trim() || me.name}
            size={124}
            mediaId={me.avatarMediaId}
            frame={me.frame}
            charm={me.charm}
            onError={setPictureError}
            onChanged={async () => {
              await refresh().catch(() => {});
            }}
          />
          <Text style={{ color: pictureError ? colors.live : AMBER, fontSize: 12.5, fontWeight: "700", marginTop: 14, textAlign: "center" }}>
            {pictureError ?? (me.avatarMediaId ? "اضغط الكاميرا لتغييرها" : "اضغط الكاميرا واختر صورة من ألبومك")}
          </Text>
        </View>

        <View style={{ marginTop: 24, padding: 16, gap: 14, borderRadius: 22, backgroundColor: "rgba(255,255,255,.06)", borderWidth: 1, borderColor: GLASS_LINE }}>
          <View style={{ gap: 6 }}>
            <Text style={{ color: "rgba(255,255,255,.65)", fontSize: 12, fontWeight: "700" }}>الاسم</Text>
            <TextInput value={name} onChangeText={setName} maxLength={40} placeholder="اسمك" placeholderTextColor="rgba(255,255,255,.35)" style={FIELD} />
          </View>
          <View style={{ gap: 6 }}>
            <Text style={{ color: "rgba(255,255,255,.65)", fontSize: 12, fontWeight: "700" }}>المعرّف — به يجدك أصدقاؤك (اختياري)</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ color: "rgba(255,255,255,.6)", fontSize: 15 }}>@</Text>
              <TextInput
                value={handle}
                onChangeText={(next) => {
                  touched.current = true;
                  setHandle(next);
                }}
                maxLength={21}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="noura"
                placeholderTextColor="rgba(255,255,255,.35)"
                style={[FIELD, { flex: 1, minWidth: 0, textAlign: "left" }]}
              />
            </View>
            <Text
              style={{
                color: handleBad || check.status === "bad" ? colors.live : check.status === "ok" && clean ? "#7DD3A0" : "rgba(255,255,255,.5)",
                fontSize: 11.5,
                fontWeight: check.status === "ok" ? "700" : "400",
              }}
            >
              {!clean || check.status === "idle"
                ? "حروف إنجليزية وأرقام و_ ، من ٣ إلى ٢٠"
                : check.status === "checking"
                  ? "نتحقّق…"
                  : check.status === "ok"
                    ? "متاح ✓"
                    : check.error}
            </Text>
            {check.suggestions.length && check.status !== "ok" ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {check.suggestions.map((one) => (
                  <Pressable
                    key={one}
                    accessibilityRole="button"
                    accessibilityLabel={`استعمل ${one}`}
                    onPress={() => {
                      touched.current = true;
                      setHandle(one);
                    }}
                    style={{ height: 30, paddingHorizontal: 12, borderRadius: 15, justifyContent: "center", backgroundColor: "rgba(246,185,59,.14)", borderWidth: 1, borderColor: "rgba(246,185,59,.4)" }}
                  >
                    <Text style={{ color: "#fff", fontSize: 12.5, fontWeight: "700" }}>@{one}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: insets.bottom + 14, gap: 8 }}>
        {problem ? <Text style={{ color: colors.live, fontSize: 12.5, fontWeight: "600" }}>{problem}</Text> : null}
        <Pressable
          accessibilityRole="button"
          onPress={() => void save()}
          disabled={!ready || busy}
          style={{ height: 50, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: ready ? AMBER : "rgba(255,255,255,.12)" }}
        >
          {busy ? (
            <Spinner size="small" color="#0E1A24" />
          ) : (
            <Text style={{ color: ready ? "#0E1A24" : "rgba(255,255,255,.55)", fontSize: 15, fontWeight: "800" }}>متابعة</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
