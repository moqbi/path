import { Pressable, View } from "react-native";
import { create } from "zustand";
import Svg, { Circle, Path } from "react-native-svg";
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
 * شارةُ الاهتمامات (القاعدة ٣٨٣) — **بقرار المالك**: حلقتان متداخلتان بخطٍّ رفيع ورأسٍ مستدير،
 * الأولى بحبر الأرضيّة والثانية باللمسة، وموضعُ التقائهما عدسةٌ مملوءةٌ باللمسة شفيفة — ما يجمع
 * اثنين. وفي «أنا» الثانيةُ قوسٌ ناقص (`open`): اهتماماتُك تنتظر من يلتقي بها.
 */
function Rings({ open }: { open?: boolean }) {
  const ink = colors.groundInk;
  const tint = colors.clay;
  // حلقتان نصفُ قطرهما ٧٫٥ ومركزاهما ١١ و٢١ على سطرٍ ارتفاعُه ٢٢.
  const lens = "M16 5.41 A7.5 7.5 0 0 1 16 16.59 A7.5 7.5 0 0 1 16 5.41 Z";
  return (
    <Svg width={32} height={22} viewBox="0 0 32 22">
      <Path d={lens} fill={tint} opacity={0.32} />
      <Circle cx={11} cy={11} r={7.5} stroke={ink} strokeWidth={2} fill="none" />
      {open ? (
        // قوسٌ من الثانية تنقصه ربعُها البعيد.
        <Path d="M21 3.5 A7.5 7.5 0 1 0 28.5 11" stroke={tint} strokeWidth={2} strokeLinecap="round" fill="none" />
      ) : (
        <Circle cx={21} cy={11} r={7.5} stroke={tint} strokeWidth={2} fill="none" />
      )}
    </Svg>
  );
}

/** سطرُ الاهتمامات على الأرضيّة — واحدٌ لملفّ الصديق و«أنا»، بلا عدد (القاعدة ٣٨٣). */
function InterestsLine({ label, a11y, open, onPress }: { label: string; a11y: string; open?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={onPress}
      style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14, paddingHorizontal: 4 }}
    >
      <Rings open={open} />
      <Text style={{ flex: 1, color: colors.groundInk, fontSize: 14, fontWeight: "700" }}>{label}</Text>
      <Svg width={16} height={16} viewBox="0 0 24 24">
        <Path d="M15 5 8 12l7 7" stroke={colors.groundInk} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.6} />
      </Svg>
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
      label={count ? "اهتماماتي" : "اختر اهتماماتك"}
      open
      a11y={count ? "اهتماماتي" : "اختر اهتماماتك"}
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
  return (
    <InterestsLine
      label={shared ? "اهتماماتكم المشتركة" : `اهتمامات ${name}`}
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
