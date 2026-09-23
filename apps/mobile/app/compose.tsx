import { useEffect, useState } from "react";
import { View, Pressable, ScrollView, Image, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { Text, TextInput } from "../components/type";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as Picker from "expo-image-picker";
import * as Location from "expo-location";
import { useQueryClient } from "@tanstack/react-query";
import { ScreenHeader } from "../components/screen-header";
import { PeopleSheet, PickerButton, type Friend } from "../components/people-sheet";
import { CloseIcon, LockIcon, PinIcon, WithIcon } from "../components/icons";
import { api } from "../lib/api";
import { uploadFile } from "../lib/upload";
import { maybeAskToRate } from "../lib/rate";
import { useCircle } from "../lib/queries";
import { ar } from "../lib/format";
import { SourceSheet } from "../components/source-sheet";
import { takeShot } from "../lib/capture";
import { colors } from "../theme/tokens";

type Kind = "PHOTO" | "THOUGHT" | "PLACE" | "MUSIC";

/** حدّ نصّ اللحظة: ما زاد عن هذا يصير مقالاً لا لحظة. */
const TEXT_MAX = 250;

const HINT: Record<Kind, string> = {
  PHOTO: "اكتب شي عن الصورة…",
  THOUGHT: "وش في بالك؟",
  PLACE: "اكتب شي عن المكان… (اختياري)",
  MUSIC: "",
};

export default function Compose() {
  const params = useLocalSearchParams<{ kind?: string }>();
  const kind = (["PHOTO", "THOUGHT", "PLACE", "MUSIC"].includes(params.kind ?? "")
    ? params.kind
    : "THOUGHT") as Kind;

  const router = useRouter();
  const client = useQueryClient();
  const circle = useCircle();

  const friends: Friend[] = circle.data?.members ?? [];
  const groups = circle.data?.groups ?? [];

  const [text, setText] = useState("");
  const [musicUrl, setMusicUrl] = useState("");
  const [picture, setPicture] = useState<{ uri: string; width: number; height: number; mime: string } | null>(null);
  const [asking, setAsking] = useState(false);
  const [withIds, setWithIds] = useState<string[]>([]);
  const [audience, setAudience] = useState("CIRCLE");
  const [viewers, setViewers] = useState<string[]>([]);
  const [sheet, setSheet] = useState<"with" | "viewers" | null>(null);

  const [wantPlace, setWantPlace] = useState(kind === "PLACE");
  const [fix, setFix] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(kind === "PLACE");
  const [geoError, setGeoError] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * المكان يأتي من الجهاز لا من لوحة المفاتيح.
   *
   * في لحظة المكان يُطلب الإذن فور فتح الشاشة — لحظةُ مكانٍ بلا إحداثيات
   * ليست لحظة مكان. وفي غيرها لا يُطلب إلا إذا ضُغط زرّ الموقع: إذنٌ
   * يُطلب بلا سبب يُرفض بلا تفكير.
   */
  useEffect(() => {
    if (!wantPlace || fix) return;
    let alive = true;

    (async () => {
      setLocating(true);
      setGeoError(null);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (!alive) return;

      if (status !== "granted") {
        setLocating(false);
        setGeoError("لازم تسمح بالوصول لموقعك عشان تضيف مكاناً.");
        return;
      }

      try {
        const here = await Location.getCurrentPositionAsync({});
        if (!alive) return;
        setFix({ lat: here.coords.latitude, lng: here.coords.longitude });
      } catch {
        if (alive) setGeoError("تعذّر تحديد موقعك. جرّب مرة ثانية.");
      } finally {
        if (alive) setLocating(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [wantPlace, fix]);

  /*
    العودة من الكاميرا: اللقطة تنتظر في `lib/capture`، وتُقرأ مرّةً
    وتُمحى. و`useFocusEffect` لأنّ هذه الشاشة لم تُبنَ من جديد — هي
    قائمةٌ تحت الكاميرا بحالتها كلّها، فلا `useEffect` يُنبّهها.
  */
  useFocusEffect(() => {
    const shot = takeShot();
    if (shot && !shot.video) {
      setPicture({ uri: shot.uri, width: shot.width, height: shot.height, mime: shot.mime });
    }
  });

  async function pickImage() {
    setAsking(false);
    const { status } = await Picker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      setError("لازم تسمح بالوصول لألبومك.");
      return;
    }
    const result = await Picker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      // يُصغَّر قبل الرفع: ميغاباياتٌ لا تُرسل ليُعاد تصغيرها على الخادم.
      allowsEditing: false,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setPicture({
      uri: asset.uri,
      width: asset.width,
      height: asset.height,
      mime: asset.mimeType ?? "image/jpeg",
    });
  }

  const ready =
    kind === "MUSIC"
      ? musicUrl.trim().length > 6
      : kind === "THOUGHT"
        ? text.trim().length > 0
        : kind === "PLACE"
          ? !!fix
          : !!picture || text.trim().length > 0;

  async function publish() {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);

    try {
      const mediaId = picture
        ? await uploadFile(picture.uri, picture.mime, "MOMENT", picture)
        : undefined;

      // بابٌ واحد لكل الأنواع، والأغنية رابطٌ فيه لا مساراً على حدة.
      await api("/v1/moments", {
        method: "POST",
        body: JSON.stringify({
          kind,
          text: text.trim() || undefined,
          mediaId,
          musicUrl: kind === "MUSIC" ? musicUrl.trim() : undefined,
          with: withIds.length ? withIds : undefined,
          audience: audience === "CIRCLE" || audience === "PICKED" ? audience : "GROUP",
          audienceGroupId: audience !== "CIRCLE" && audience !== "PICKED" ? audience : undefined,
          viewers: audience === "PICKED" ? viewers : undefined,
          lat: fix?.lat,
          lng: fix?.lng,
        }),
      });

      await client.invalidateQueries({ queryKey: ["feed"] });
      await client.invalidateQueries({ queryKey: ["me"] });
      router.replace("/");

      /*
        لحظةٌ نُشرت: هنا يُسأل عن التقييم إن اكتملت شروطه (`lib/rate.ts`)
        — لا عند الإقلاع. من سُئل وهو يفعل شيئاً أحبّه أجاب، ومن سُئل
        وهو يبحث عن زرّ أغلق. ولا يُنتظر: السؤال بعد الانتقال لا قبله.
      */
      void maybeAskToRate();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "تعذّر النشر");
    } finally {
      setBusy(false);
    }
  }

  const summary = (ids: string[], empty: string) =>
    ids.length === 0
      ? empty
      : friends
          .filter((f) => ids.includes(f.id))
          .map((f) => f.name)
          .join("، ");

  const chip = (on: boolean) => ({
    minHeight: 44,
    justifyContent: "center" as const,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: on ? colors.claySoft : colors.card,
    borderColor: on ? colors.clay : colors.line,
  });

  return (
    <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: colors.paper }}>
      {/* الرأس كبقية الشاشات: العلامة ثم فاصل ثم «لحظة» — لا اسم نوعٍ عارٍ. */}
      <ScreenHeader title="لحظة" back="/" />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 16 }}>
          {kind === "PHOTO" ? (
            <View style={{ marginBottom: 16 }}>
              <View
                style={{
                  height: 200,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: colors.line,
                  backgroundColor: colors.chip,
                  overflow: "hidden",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 10,
                }}
              >
                {picture ? (
                  <Image source={{ uri: picture.uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                ) : (
                  <Text style={{ color: colors.muted, fontSize: 12.5 }}>ما اخترت صورة بعد</Text>
                )}
              </View>
              <Pressable
                onPress={() => setAsking(true)}
                style={{ height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card }}
              >
                <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "600" }}>
                  {picture ? "غيّر الصورة" : "صورة اللحظة"}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {kind === "MUSIC" ? (
            <View style={{ marginBottom: 16 }}>
              <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 23, marginBottom: 10 }}>
                الصق رابط الأغنية من سبوتيفاي أو يوتيوب أو ساوندكلاود — يُقرأ اسمها تلقائياً،
                ومن يضغط عليها يسمعها.
              </Text>
              <TextInput
                value={musicUrl}
                onChangeText={setMusicUrl}
                placeholder="https://open.spotify.com/track/..."
                placeholderTextColor={colors.faint}
                autoCapitalize="none"
                keyboardType="url"
                style={{ height: 52, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, paddingHorizontal: 16, fontSize: 13, color: colors.ink }}
              />
            </View>
          ) : (
            <>
              <TextInput
                value={text}
                onChangeText={(value) => setText(value.slice(0, TEXT_MAX))}
                placeholder={HINT[kind]}
                placeholderTextColor={colors.faint}
                multiline
                numberOfLines={4}
                style={{
                  minHeight: 108,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: colors.line,
                  backgroundColor: colors.card,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  fontSize: 13.5,
                  lineHeight: 23,
                  color: colors.ink,
                  textAlignVertical: "top",
                  // النصّ عربيّ فيبدأ من اليمين: `textarea` على الويب لا
                  // يتبع اتجاه المستند وحده.
                  textAlign: "right",
                }}
              />
              {/* العدّاد يظهر حين يقترب الحدّ: قبل ذلك رقمٌ لا يفيد. */}
              <Text
                style={{
                  marginTop: 6,
                  fontSize: 11,
                  textAlign: "left",
                  color:
                    text.length >= TEXT_MAX
                      ? colors.live
                      : text.length > TEXT_MAX - 50
                        ? colors.muted
                        : "transparent",
                }}
              >
                {ar(text.length)} / {ar(TEXT_MAX)}
              </Text>
            </>
          )}

          {/* الموقع: إجباريٌّ في لحظة المكان، اختياريٌّ في اللحظة والصورة. */}
          {kind === "MUSIC" ? null : !wantPlace ? (
            <Pressable
              onPress={() => setWantPlace(true)}
              style={{ flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", minHeight: 44, paddingHorizontal: 16, marginTop: 16, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card }}
            >
              <PinIcon size={15} color={colors.ink2} />
              <Text style={{ color: colors.ink2, fontSize: 13, fontWeight: "600" }}>أضف موقعك</Text>
            </Pressable>
          ) : (
            <View style={{ marginTop: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, overflow: "hidden" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 16 }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.liveSoft }}>
                  <PinIcon size={20} color={colors.live} />
                </View>
                <View style={{ flex: 1 }}>
                  {locating ? (
                    <Text style={{ color: colors.muted, fontSize: 13.5 }}>نحدّد موقعك…</Text>
                  ) : fix ? (
                    <>
                      <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "600" }}>موقعك حُدّد</Text>
                      <Text style={{ color: colors.muted, fontSize: 11.5, marginTop: 2 }}>
                        يُكتب اسم المكان من الإحداثيات عند النشر.
                      </Text>
                    </>
                  ) : (
                    <Text style={{ color: colors.live, fontSize: 13, lineHeight: 22 }}>{geoError}</Text>
                  )}
                </View>
                {kind === "PLACE" ? null : (
                  <Pressable
                    accessibilityLabel="احذف الموقع"
                    onPress={() => {
                      setWantPlace(false);
                      setFix(null);
                      setGeoError(null);
                      setLocating(false);
                    }}
                    style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line }}
                  >
                    <CloseIcon size={15} color={colors.muted} />
                  </Pressable>
                )}
              </View>
            </View>
          )}

          {/* «مع مين؟» زرٌّ يفتح القائمة، لا جدارُ أسماء. */}
          {friends.length > 0 && kind !== "MUSIC" ? (
            <View style={{ marginTop: 20 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <WithIcon size={14} color={colors.faint} />
                <Text style={{ color: colors.faint, fontSize: 11.5, fontWeight: "600" }}>مع مين؟</Text>
              </View>
              <PickerButton
                label={summary(withIds, "اختر من أصدقائك")}
                count={withIds.length}
                onOpen={() => setSheet("with")}
              />
            </View>
          ) : null}

          {/* من يراها: الاختيار هنا يسبق النشر لأن الخصوصية لا تُصلَّح بعده. */}
          <View style={{ marginTop: 20 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <LockIcon size={14} color={colors.faint} />
              <Text style={{ color: colors.faint, fontSize: 11.5, fontWeight: "600" }}>مين يشوفها؟</Text>
            </View>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {[
                { id: "CIRCLE", label: "كل أصدقائي" },
                ...groups.map((g) => ({ id: g.id, label: g.name })),
                { id: "PICKED", label: "أشخاص أختارهم" },
              ].map((option) => {
                const on = audience === option.id;
                return (
                  <Pressable
                    key={option.id}
                    onPress={() => {
                      setAudience(option.id);
                      if (option.id === "PICKED") setSheet("viewers");
                    }}
                    style={chip(on)}
                  >
                    <Text style={{ fontSize: 13, color: on ? colors.clayInk : colors.ink }}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {audience === "PICKED" ? (
              <View style={{ marginTop: 12 }}>
                <PickerButton
                  label={summary(viewers, "اختر من يراها")}
                  count={viewers.length}
                  onOpen={() => setSheet("viewers")}
                />
              </View>
            ) : null}
          </View>

          {error ? (
            <Text accessibilityRole="alert" style={{ color: colors.live, fontSize: 12.5, marginTop: 14 }}>
              {error}
            </Text>
          ) : null}
        </ScrollView>

        <View style={{ paddingHorizontal: 20, paddingBottom: 26, paddingTop: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12 }}>
            <LockIcon size={14} color={colors.faint} />
            <Text style={{ color: colors.faint, fontSize: 11.5 }}>
              {audience === "CIRCLE"
                ? "يشوفها أصدقاؤك فقط"
                : audience === "PICKED"
                  ? `يشوفها ${viewers.length ? `${ar(viewers.length)} اخترتهم` : "من تختارهم"}`
                  : `يشوفها تصنيف ${groups.find((g) => g.id === audience)?.name ?? ""}`}
            </Text>
          </View>

          <Pressable
            onPress={publish}
            disabled={!ready || busy}
            style={{
              height: 54,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.clay,
              opacity: !ready || busy ? 0.45 : 1,
            }}
          >
            {busy ? (
              <ActivityIndicator color={colors.onBrand} />
            ) : (
              <Text style={{ color: colors.onBrand, fontSize: 15.5, fontWeight: "700" }}>انشر</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {sheet ? (
        <PeopleSheet
          title={sheet === "with" ? "مع مين؟" : "مين يشوفها؟"}
          friends={friends}
          picked={sheet === "with" ? withIds : viewers}
          onToggle={(id) =>
            sheet === "with"
              ? setWithIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
              : setViewers((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
          }
          onClose={() => setSheet(null)}
        />
      ) : null}

      <SourceSheet
        open={asking}
        onClose={() => setAsking(false)}
        onCamera={() => {
          setAsking(false);
          router.push("/camera?mode=picture" as never);
        }}
        onLibrary={() => void pickImage()}
      />
    </SafeAreaView>
  );
}
