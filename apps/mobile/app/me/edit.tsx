import { useRef, useState } from "react";
import { View, Pressable, ScrollView, ActivityIndicator, PanResponder, KeyboardAvoidingView, Platform } from "react-native";
import { Text, TextInput } from "../../components/type";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import * as Picker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { ScreenHeader } from "../../components/screen-header";
import { CoverLayer } from "../../components/cover";
import { Avatar, type Frame } from "../../components/avatar";
import { CameraIcon, CheckIcon, CloseIcon } from "../../components/icons";
import { api } from "../../lib/api";
import { uploadFile } from "../../lib/upload";
import { keys } from "../../lib/queries";
import { useSession } from "../../lib/session";
import { brandGradient, colors } from "../../theme/tokens";
import { BIO_MAX } from "@athar/shared";
import { ar } from "../../lib/format";

const COVER_H = 132;

/** شرط الصورة المتحركة — نصّ `ANIMATED.rule` في الويب حرفاً بحرف. */
const ANIMATED_RULE = "GIF أو WebP متحركة · من ١٢٠×١٢٠ إلى ١٠٢٤×١٠٢٤ · حتى ٣ ميغابايت";

/**
 * تعديل الملف: بابٌ واحد فيه الغلاف ثم الصورة ثم البيانات.
 *
 * كانت أدوات التحرير مبعثرة في الويب — أيقونةٌ على الغلاف وأيقونةٌ على
 * الصورة وصفحةٌ ثالثة — فاجتمعت كلّها هنا: الملف يُقرأ نظيفاً، والتحرير
 * بابٌ يُفتح ويُغلق.
 */
export default function EditProfile() {
  const router = useRouter();
  const client = useQueryClient();
  const me = useSession((state) => state.me);
  const refresh = useSession((state) => state.refresh);

  const [name, setName] = useState(me?.name ?? "");
  const [handle, setHandle] = useState(me?.handle ?? "");
  const [bio, setBio] = useState(me?.bio ?? "");
  const [city, setCity] = useState(me?.city ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pictureError, setPictureError] = useState<string | null>(null);

  if (!me) return null;

  async function save() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await api("/v1/me", {
        method: "PATCH",
        // الحقول الثلاثة نصوصٌ لا `null`: الخادم يقرأ الفارغ فراغاً
        // ويمسحه بنفسه، و`null` يرفضه المدقّق قبل أن يصل إليه.
        body: JSON.stringify({
          name: name.trim(),
          handle: handle.trim(),
          bio: bio.trim(),
          city: city.trim(),
        }),
      });
      await refresh();
      await client.invalidateQueries({ queryKey: keys.me });
      // النافذة تُغلق نفسها بعد الحفظ — لا تحويلَ من الإجراء.
      router.back();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "تعذّر الحفظ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScreenHeader title="تعديل الملف" back="/me" />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ paddingBottom: 40, direction: "rtl" }} keyboardShouldPersistTaps="handled">
          <Text style={{ color: colors.muted, fontSize: 11.5, paddingHorizontal: 20, paddingTop: 14, textAlign: "right" }}>
            الغلاف والصورة وبياناتك في مكانٍ واحد
          </Text>

          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, textAlign: "right" }}>
            الغلاف
          </Text>

          <CoverEditor
            mediaId={me.coverMediaId}
            spec={me.background?.spec ?? null}
            initialY={me.coverY}
            onChanged={async () => {
              await refresh();
              await client.invalidateQueries({ queryKey: keys.me });
            }}
          />

          <View style={{ flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 20, paddingTop: 16 }}>
            <AvatarEditor
              name={me.name}
              size={72}
              mediaId={me.avatarMediaId}
              frame={me.frame}
              charm={me.charm}
              onError={setPictureError}
              onChanged={async () => {
                await refresh();
                await client.invalidateQueries({ queryKey: keys.me });
              }}
            />

            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: colors.ink, fontSize: 12.5, fontWeight: "600" }}>
                صورة العرض
              </Text>
              <Text style={{ color: colors.muted, fontSize: 11.5, lineHeight: 19, marginTop: 2 }}>
                اضغط الكاميرا على حافة صورتك لتغييرها.
              </Text>

              {/* الشرط والخطأ هنا لا تحت الصورة: تحتها يركبان على النموذج. */}
              {pictureError ? (
                <Text accessibilityRole="alert" style={{ color: colors.live, fontSize: 11, lineHeight: 18, marginTop: 4 }}>
                  {pictureError}
                </Text>
              ) : me.isPlus ? (
                <Text style={{ color: colors.faint, fontSize: 11, lineHeight: 18, marginTop: 4 }}>
                  صورة متحركة؟ {ANIMATED_RULE}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={{ paddingHorizontal: 20, paddingTop: 16, gap: 12 }}>
            <Field label="الاسم">
              <TextInput value={name} onChangeText={setName} maxLength={40} style={INPUT} />
            </Field>

            <Field label="المعرّف">
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ color: colors.muted, fontSize: 15 }}>@</Text>
                <TextInput
                  value={handle}
                  onChangeText={setHandle}
                  maxLength={20}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="mohammed"
                  placeholderTextColor={colors.faint}
                  style={[INPUT, { flex: 1, minWidth: 0, textAlign: "left" }]}
                />
              </View>
              <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4, textAlign: "right" }}>
                حروف إنجليزية وأرقام و_ ، من ٣ إلى ٢٠ حرفاً. يظهر تحت اسمك.
              </Text>
            </Field>

            <Field
              label="نبذة"
              hint={`${ar(BIO_MAX - bio.length)} `}
              warn={bio.length >= BIO_MAX}
            >
              <TextInput
                value={bio}
                onChangeText={setBio}
                maxLength={BIO_MAX}
                multiline
                numberOfLines={3}
                placeholder="سطرٌ عنك…"
                placeholderTextColor={colors.faint}
                style={[INPUT, { height: 92, paddingTop: 12, textAlignVertical: "top", lineHeight: 22 }]}
              />
            </Field>

            <Field label="المدينة">
              <TextInput
                value={city}
                onChangeText={setCity}
                maxLength={40}
                placeholder="الرياض"
                placeholderTextColor={colors.faint}
                style={INPUT}
              />
            </Field>

            {error ? (
              <Text accessibilityRole="alert" style={{ color: colors.live, fontSize: 12.5, textAlign: "right" }}>
                {error}
              </Text>
            ) : null}

            <Pressable onPress={save} disabled={saving} style={{ marginTop: 4, opacity: saving ? 0.6 : 1 }}>
              <LinearGradient
                colors={[brandGradient[0], brandGradient[1]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ height: 50, borderRadius: 12, alignItems: "center", justifyContent: "center" }}
              >
                {saving ? (
                  <ActivityIndicator color={colors.onBrand} />
                ) : (
                  <Text style={{ color: colors.onBrand, fontSize: 14.5, fontWeight: "700" }}>احفظ</Text>
                )}
              </LinearGradient>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const INPUT = {
  height: 48,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: colors.line,
  backgroundColor: colors.card,
  paddingHorizontal: 16,
  fontSize: 13.5,
  color: colors.ink,
  textAlign: "right",
} as const;

function Field({
  label,
  children,
  hint,
  warn,
}: {
  label: string;
  children: React.ReactNode;
  /** عدّادٌ في طرف السطر — ما بقي من الحروف. */
  hint?: string;
  warn?: boolean;
}) {
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Text
          style={{ flex: 1, minWidth: 0, color: colors.ink2, fontSize: 12.5, fontWeight: "600", textAlign: "right" }}
        >
          {label}
        </Text>
        {hint ? (
          <Text style={{ color: warn ? colors.live : colors.muted, fontSize: 11 }}>{hint}</Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/**
 * الغلاف وأزراره: تغييره، وضبط موضعه، وإزالته.
 *
 * وضع الضبط يسحب الصورة عمودياً فيتحرّك موضعها داخل الإطار، ويُحفظ
 * الموضع نسبةً مئوية — والملف لا يُقصّ: الصورة تبقى كما رُفعت، وما
 * يُحفظ هو أيّ جزءٍ منها يُرى. والسحب ١٪ لكل بكسلين كما في الويب.
 */
function CoverEditor({
  mediaId,
  spec,
  initialY,
  onChanged,
}: {
  mediaId: string | null;
  spec: string | null;
  initialY: number;
  onChanged: () => Promise<void>;
}) {
  const [y, setY] = useState(initialY);
  const [adjusting, setAdjusting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const start = useRef(initialY);
  const live = useRef(initialY);

  const drag = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        start.current = live.current;
      },
      onPanResponderMove: (_event, gesture) => {
        const next = Math.min(100, Math.max(0, Math.round(start.current - gesture.dy / 2)));
        live.current = next;
        setY(next);
      },
    }),
  ).current;

  async function pick() {
    setError(null);
    const granted = await Picker.requestMediaLibraryPermissionsAsync();
    if (!granted.granted) return setError("لازم تسمح بالوصول لألبومك.");

    const result = await Picker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];

    setBusy(true);
    try {
      const uploaded = await uploadFile(asset.uri, asset.mimeType ?? "image/jpeg", "COVER", asset);
      await api("/v1/me/cover/image", { method: "PUT", body: JSON.stringify({ mediaId: uploaded }) });
      await onChanged();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "تعذّر رفع الغلاف");
    } finally {
      setBusy(false);
    }
  }

  async function savePosition() {
    setAdjusting(false);
    setBusy(true);
    try {
      await api("/v1/me/cover", { method: "PUT", body: JSON.stringify({ y }) });
      await onChanged();
    } catch {
      /* الموضع يبقى على الشاشة كما ضبطه صاحبه */
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await api("/v1/me/cover", { method: "DELETE" });
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <View>
      <View
        style={{ height: COVER_H, overflow: "hidden" }}
        {...(adjusting ? drag.panHandlers : {})}
      >
        <CoverLayer mediaId={mediaId} spec={spec} height={COVER_H} y={y} />

        {adjusting ? (
          <>
            <View style={{ position: "absolute", inset: 0, backgroundColor: "rgba(14,26,36,.25)" }} pointerEvents="none" />
            <Text
              pointerEvents="none"
              style={{ position: "absolute", left: 0, right: 0, top: COVER_H / 2 - 10, textAlign: "center", color: "#fff", fontSize: 12.5, fontWeight: "600" }}
            >
              اسحب الصورة لأعلى أو لأسفل
            </Text>

            {/* أسفل اليسار: الوسط تحجبه صورة العرض فلا يُضغط. */}
            <View style={{ position: "absolute", bottom: 12, left: 12, flexDirection: "row", gap: 8 }}>
              <Chip onPress={savePosition} bright icon={<CheckIcon size={14} color={colors.onBrand} />}>
                احفظ الموضع
              </Chip>
              <Chip
                onPress={() => {
                  setY(initialY);
                  live.current = initialY;
                  setAdjusting(false);
                }}
              >
                إلغاء
              </Chip>
            </View>
          </>
        ) : (
          <View style={{ position: "absolute", top: 14, right: 14, flexDirection: "row", gap: 8 }}>
            <Chip onPress={pick} icon={<CameraIcon size={14} color="#f7f5ef" />}>
              الغلاف
            </Chip>

            {mediaId ? (
              <>
                <Chip onPress={() => setAdjusting(true)}>اضبط</Chip>
                <Chip onPress={remove} label="أزل الغلاف" round>
                  <CloseIcon size={15} color="#f7f5ef" />
                </Chip>
              </>
            ) : null}
          </View>
        )}

        {busy ? (
          <View style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(14,26,36,.35)" }}>
            <ActivityIndicator color="#f7f5ef" />
          </View>
        ) : null}
      </View>

      {error ? (
        <Text accessibilityRole="alert" style={{ color: colors.live, fontSize: 11.5, paddingHorizontal: 20, paddingTop: 6, textAlign: "right" }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

function Chip({
  children,
  onPress,
  icon,
  bright,
  round,
  label,
}: {
  children: React.ReactNode;
  onPress: () => void;
  icon?: React.ReactNode;
  bright?: boolean;
  round?: boolean;
  label?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        borderRadius: 999,
        paddingHorizontal: round ? 0 : 12,
        paddingVertical: round ? 0 : 8,
        width: round ? 36 : undefined,
        height: round ? 36 : undefined,
        backgroundColor: bright ? colors.clay : "rgba(14,26,36,.55)",
      }}
    >
      {icon}
      {round ? (
        children
      ) : (
        <Text style={{ color: bright ? colors.onBrand : "#f7f5ef", fontSize: 11, fontWeight: "600" }}>
          {children}
        </Text>
      )}
    </Pressable>
  );
}

/**
 * صورة العرض وزرّها.
 *
 * الزرّ على يمين الصورة: اليسار مقعد التميمة في كل مكان. والصورة
 * المتحركة من مزايا آثار+ — تُرفع بملفها كما هي، فلا `canvas` يقتل حركتها.
 */
function AvatarEditor({
  name,
  size,
  mediaId,
  frame,
  charm,
  onError,
  onChanged,
}: {
  name: string;
  size: number;
  mediaId: string | null;
  frame: Frame;
  charm?: { spec: string; mediaId: string | null } | null;
  /** الخطأ يُرفع إلى عمود الوصف — تحت الصورة يركب على النموذج. */
  onError: (message: string | null) => void;
  onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const setError = onError;

  async function pick() {
    setError(null);
    const granted = await Picker.requestMediaLibraryPermissionsAsync();
    if (!granted.granted) return setError("لازم تسمح بالوصول لألبومك.");

    const result = await Picker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];

    setBusy(true);
    try {
      const uploaded = await uploadFile(asset.uri, asset.mimeType ?? "image/jpeg", "AVATAR", asset);
      await api("/v1/me/avatar", { method: "PUT", body: JSON.stringify({ mediaId: uploaded }) });
      await onChanged();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "تعذّر رفع الصورة");
    } finally {
      setBusy(false);
    }
  }

  return (
    // الصندوق بمقاس الصورة تماماً: شرطُ الصورة المتحركة تحته مرفوعٌ من
    // السياق (`absolute`) كما في الويب، وإلا مدّ العمودَ إلى عرضه هو
    // فطار زرّ الكاميرا عن حافة الصورة وضاق نصّها المجاور.
    <View style={{ width: size, height: size }}>
      <View style={{ width: size, height: size }}>
        <Avatar name={name} size={size} frame={frame} mediaId={mediaId} charm={charm} />

        <Pressable
          onPress={pick}
          accessibilityRole="button"
          accessibilityLabel="غيّر صورتك"
          style={{
            position: "absolute",
            bottom: -4,
            right: -4,
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 2,
            borderColor: colors.paper,
            backgroundColor: colors.clay,
          }}
        >
          {busy ? (
            <ActivityIndicator size="small" color={colors.onBrand} />
          ) : (
            <CameraIcon size={16} color={colors.onBrand} />
          )}
        </Pressable>
      </View>

    </View>
  );
}
