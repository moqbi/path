import { Pressable, View } from "react-native";
import { create } from "zustand";
import Svg, { Path } from "react-native-svg";
import { router } from "expo-router";
import { interestOf } from "@athar/shared";
import { Text } from "./type";
import { GlassSheet, SheetScrollView } from "./glass-sheet";
import { ar } from "../lib/format";
import { colors } from "../theme/tokens";
import { useInterestCatalog } from "../lib/interests";

export type FriendInterests = { shared: string[]; theirs: string[]; mineCount: number };

const useInterestsSheet = create<{ open: { name: string; data: FriendInterests } | null }>(() => ({ open: null }));

/** يفتح نافذةَ الاهتمامات المشتركة (القاعدة ٣٧٤) — من ملفّ الصديق. */
export const openInterests = (name: string, data: FriendInterests) =>
  useInterestsSheet.setState({ open: { name, data } });

const glassChip = { backgroundColor: "rgba(255,255,255,.1)", borderColor: "rgba(255,255,255,.16)" } as const;

function Chip({ id, strong }: { id: string; strong?: boolean }) {
  const { index } = useInterestCatalog();
  const one = interestOf(id, index);
  if (!one) return null;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: 11,
        height: 32,
        borderRadius: 16,
        borderWidth: 1,
        ...(strong ? { backgroundColor: colors.clay, borderColor: colors.clay } : glassChip),
      }}
    >
      <Text style={{ fontSize: 13 }}>{one.emoji}</Text>
      <Text style={{ color: strong ? colors.onBrand : "#fff", fontSize: 12.5, fontWeight: "700" }}>{one.label}</Text>
    </View>
  );
}

/**
 * شارةُ الاهتمامات (القاعدة ٣٨٢): قرصٌ بلون اللمسة فيه ثلاثُ نجماتٍ رباعيّة — بقرار المالك بدل
 * الدائرتين المتداخلتين، تُقرأ رسمَ مخطّطٍ لا شارة.
 */
function Spark() {
  return (
    <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.clay }}>
      <Svg width={18} height={18} viewBox="0 0 24 24">
        <Path d="M10 3.5c.6 3.7 2.3 5.4 6 6-3.7.6-5.4 2.3-6 6-.6-3.7-2.3-5.4-6-6 3.7-.6 5.4-2.3 6-6Z" fill={colors.onBrand} />
        <Path d="M18 13.5c.3 1.9 1.1 2.7 3 3-1.9.3-2.7 1.1-3 3-.3-1.9-1.1-2.7-3-3 1.9-.3 2.7-1.1 3-3Z" fill={colors.onBrand} opacity={0.9} />
        <Path d="M18.5 2.5c.2 1.2.8 1.8 2 2-1.2.2-1.8.8-2 2-.2-1.2-.8-1.8-2-2 1.2-.2 1.8-.8 2-2Z" fill={colors.onBrand} opacity={0.75} />
      </Svg>
    </View>
  );
}

const countLabel = (count: number) =>
  `${ar(count)} ${count === 1 ? "اهتمام" : count === 2 ? "اهتمامان" : count <= 10 ? "اهتمامات" : "اهتماماً"}`;

/** سطرُ الاهتمامات على الأرضيّة — واحدٌ لملفّ الصديق و«أنا». */
function InterestsLine({ label, pill, a11y, onPress }: { label: string; pill: string; a11y: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={onPress}
      style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14, paddingHorizontal: 4 }}
    >
      <Spark />
      <Text style={{ flex: 1, color: colors.groundInk, fontSize: 14, fontWeight: "700" }}>{label}</Text>
      <View style={{ height: 32, paddingHorizontal: 16, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.chip }}>
        <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "700" }}>{pill}</Text>
      </View>
    </Pressable>
  );
}

/**
 * «اهتماماتي» في «أنا» (القاعدة ٣٨٢) — **بقرار المالك** في موضع سطر ملفّ الصديق نفسه لا في
 * «تعديل الملف»، والضغطُ يفتح القائمةَ نفسها (`/interests?edit=1`).
 */
export function MyInterests({ count }: { count: number }) {
  return (
    <InterestsLine
      label="اهتماماتي"
      pill={count ? countLabel(count) : "اختر"}
      a11y={count ? `اهتماماتي، ${count}` : "اختر اهتماماتك"}
      onPress={() => router.push("/interests?edit=1" as never)}
    />
  );
}

/**
 * الاهتمامات في ملفّ الصديق (القاعدة ٣٧٤) — **برسم المالك**: سطرٌ على الأرضيّة بين سطر العضويّة
 * والشريحتين، في طرف البداية دائرتان متداخلتان و«اهتماماتكم المشتركة»، وفي الآخر قرصٌ بعددها.
 * والضغطُ يفتح النافذةَ الزجاجيّة. ولا يُرسم شيءٌ لصديقٍ لم يختر اهتماماته.
 */
export function SharedInterests({ name, data }: { name: string; data: FriendInterests | undefined }) {
  if (!data || data.shared.length + data.theirs.length === 0) return null;
  const shared = data.shared.length;
  const count = shared || data.theirs.length;
  return (
    <InterestsLine
      label={shared ? "اهتماماتكم المشتركة" : `اهتمامات ${name}`}
      pill={countLabel(count)}
      a11y={shared ? `${shared} اهتمامات مشتركة` : `اهتمامات ${name}`}
      onPress={() => openInterests(name, data)}
    />
  );
}

/** النافذةُ نفسها — مركّبةٌ في الجذر (القاعدة ١٣٧). */
export function InterestsSheet() {
  const open = useInterestsSheet((s) => s.open);
  if (!open) return null;
  const { name, data } = open;
  const close = () => useInterestsSheet.setState({ open: null });
  return (
    <GlassSheet
      title={data.shared.length ? "اهتمامات مشتركة" : `اهتمامات ${name}`}
      subtitle={
        data.shared.length
          ? `${ar(data.shared.length)} من اهتماماتك تجمعك مع ${name}`
          : data.mineCount
            ? `ما فيه اهتمام يجمعك مع ${name} بعد`
            : "اختر اهتماماتك من «أنا» لترى ما يجمعكما"
      }
      onClose={close}
    >
      <SheetScrollView name="interests" contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 12, gap: 16 }}>
        {data.shared.length ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {data.shared.map((id) => (
              <Chip key={id} id={id} strong />
            ))}
          </View>
        ) : null}
        {data.theirs.length ? (
          <View style={{ gap: 10 }}>
            <Text style={{ color: "rgba(255,255,255,.7)", fontSize: 12.5, fontWeight: "700" }}>
              {data.shared.length ? `ويحبّ ${name} أيضاً` : `يحبّ ${name}`}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {data.theirs.map((id) => (
                <Chip key={id} id={id} />
              ))}
            </View>
          </View>
        ) : null}
      </SheetScrollView>
    </GlassSheet>
  );
}
