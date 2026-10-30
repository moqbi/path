import { Pressable, View } from "react-native";
import { create } from "zustand";
import Svg, { Circle } from "react-native-svg";
import { interestOf } from "@athar/shared";
import { Text } from "./type";
import { GlassSheet, SheetScrollView } from "./glass-sheet";
import { ar } from "../lib/format";
import { colors } from "../theme/tokens";

export type FriendInterests = { shared: string[]; theirs: string[]; mineCount: number };

const useInterestsSheet = create<{ open: { name: string; data: FriendInterests } | null }>(() => ({ open: null }));

/** يفتح نافذةَ الاهتمامات المشتركة (القاعدة ٣٧٤) — من ملفّ الصديق. */
export const openInterests = (name: string, data: FriendInterests) =>
  useInterestsSheet.setState({ open: { name, data } });

const glassChip = { backgroundColor: "rgba(255,255,255,.1)", borderColor: "rgba(255,255,255,.16)" } as const;

function Chip({ id, strong }: { id: string; strong?: boolean }) {
  const one = interestOf(id);
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

/** دائرتان متداخلتان — ما يجمع اثنين. */
function Venn({ color }: { color: string }) {
  return (
    <Svg width={28} height={20} viewBox="0 0 28 20">
      <Circle cx={10} cy={10} r={8} stroke={color} strokeWidth={1.6} fill="none" />
      <Circle cx={18} cy={10} r={8} stroke={color} strokeWidth={1.6} fill="none" />
    </Svg>
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
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={shared ? `${shared} اهتمامات مشتركة` : `اهتمامات ${name}`}
      onPress={() => openInterests(name, data)}
      style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14, paddingHorizontal: 4 }}
    >
      <Venn color={colors.groundInk} />
      <Text style={{ flex: 1, color: colors.groundInk, fontSize: 14, fontWeight: "600" }}>
        {shared ? "اهتماماتكم المشتركة" : `اهتمامات ${name}`}
      </Text>
      <View style={{ height: 32, paddingHorizontal: 16, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.chip }}>
        <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "700" }}>
          {ar(count)} {count === 1 ? "اهتمام" : count === 2 ? "اهتمامان" : count <= 10 ? "اهتمامات" : "اهتماماً"}
        </Text>
      </View>
    </Pressable>
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
            : "اختر اهتماماتك من «تعديل الملف» لترى ما يجمعكما"
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
