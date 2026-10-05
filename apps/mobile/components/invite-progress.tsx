import { View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Text } from "./type";
import { api } from "../lib/api";
import { ar } from "../lib/format";
import { colors } from "../theme/tokens";

type Status = {
  enabled: boolean;
  every: number;
  coins: number;
  memberNo: number;
  joined: number;
  qualified: number;
  rewards: number;
  left: number;
};

/**
 * برنامجُ الدعوات تحت رمز المشاركة (القاعدة ٢٤٣): كم دعوتَ، وكم بقي على
 * المكافأة التالية. والدعوةُ بالرابط وحده — لا حقلَ يُكتب فيه رقم.
 * والبرنامجُ موقوفٌ من اللوحة = لا شيء هنا.
 */
export function InviteProgress() {
  const status = useQuery({ queryKey: ["invites"], queryFn: () => api<Status>("/v1/invites") });
  const s = status.data;
  if (!s?.enabled) return null;

  const done = s.qualified % s.every;

  return (
    <View style={{ marginTop: 14, gap: 10 }}>
      <View style={{ backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.goldLine, padding: 14 }}>
        <Text style={{ color: colors.ink, fontSize: 14.5, fontWeight: "800" }}>
          ادعُ أصدقاءك — {ar(s.coins)} نقطة لكل {ar(s.every)}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4, lineHeight: 19 }}>
          شارك رابط ملفك أو رمزه: من يفتحه ثمّ يسجّل يُحسب لك حين ينشر أوّل لحظة من جواله.
        </Text>

        <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.goldSoft, marginTop: 12, overflow: "hidden" }}>
          <View style={{ width: `${(done / s.every) * 100}%`, height: "100%", backgroundColor: colors.clay }} />
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
          <Text style={{ color: colors.ink2, fontSize: 12, fontWeight: "600" }}>
            {ar(done)} من {ar(s.every)} — باقي {ar(s.left)}
          </Text>
          <Text style={{ color: colors.faint, fontSize: 11.5 }}>
            سجّل برقمك {ar(s.joined)}{s.rewards ? ` · نلت ${ar(s.rewards * s.coins)} نقطة` : ""}
          </Text>
        </View>
      </View>

    </View>
  );
}
