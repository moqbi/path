import { useState } from "react";
import { View, Pressable, TextInput, ActivityIndicator } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  canClaim: boolean;
};

/**
 * برنامجُ الدعوات تحت رمز المشاركة (القاعدة ٢٤٣): كم دعوتَ، وكم بقي على
 * المكافأة التالية، و«من دعاك؟» لمن سجّل حديثاً بمزوّدٍ بلا نموذج.
 * والبرنامجُ موقوفٌ من اللوحة = لا شيء هنا.
 */
export function InviteProgress() {
  const client = useQueryClient();
  const status = useQuery({ queryKey: ["invites"], queryFn: () => api<Status>("/v1/invites") });
  const [no, setNo] = useState("");
  const [error, setError] = useState<string | null>(null);

  const claim = useMutation({
    mutationFn: (memberNo: number) =>
      api("/v1/invites/claim", { method: "POST", body: JSON.stringify({ memberNo }) }),
    onSuccess: () => {
      setError(null);
      void client.invalidateQueries({ queryKey: ["invites"] });
    },
    onError: (problem) => setError(problem instanceof Error ? problem.message : "تعذّر الحفظ"),
  });

  const s = status.data;
  if (!s?.enabled) return null;

  const done = s.qualified % s.every;
  const latin = no.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).trim();

  return (
    <View style={{ marginTop: 14, gap: 10 }}>
      <View style={{ backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.goldLine, padding: 14 }}>
        <Text style={{ color: colors.ink, fontSize: 14.5, fontWeight: "800" }}>
          ادعُ أصدقاءك — {ar(s.coins)} نقطة لكل {ar(s.every)}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4, lineHeight: 19 }}>
          يكتب صديقك رقم عضويتك ({ar(s.memberNo)}) عند التسجيل، ويُعدّ حين ينشر أوّل لحظة له.
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

      {s.canClaim ? (
        <View style={{ backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.line, padding: 14 }}>
          <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "700" }}>أحدٌ دعاك إلى آثار؟</Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            <TextInput
              value={no}
              onChangeText={setNo}
              placeholder="رقم عضويته"
              placeholderTextColor={colors.faint}
              keyboardType="number-pad"
              maxLength={9}
              style={{
                flex: 1,
                height: 42,
                borderRadius: 21,
                paddingHorizontal: 14,
                backgroundColor: colors.paper,
                color: colors.ink,
                textAlign: "right",
              }}
            />
            <Pressable
              disabled={!latin || claim.isPending}
              onPress={() => claim.mutate(Number(latin))}
              style={{
                height: 42,
                paddingHorizontal: 18,
                borderRadius: 21,
                backgroundColor: latin ? colors.night : colors.chip,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {claim.isPending ? (
                <ActivityIndicator color={colors.chromeInk} />
              ) : (
                <Text style={{ color: colors.chromeInk, fontSize: 13.5, fontWeight: "700" }}>سجّله</Text>
              )}
            </Pressable>
          </View>
          {error ? <Text style={{ color: colors.live, fontSize: 12, marginTop: 6 }}>{error}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}
