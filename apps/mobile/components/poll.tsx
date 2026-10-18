import { View, Pressable, ActivityIndicator } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Text } from "./type";
import { CheckIcon } from "./icons";
import { api } from "../lib/api";
import { ar } from "../lib/format";
import { colors } from "../theme/tokens";

/** نتيجةُ الاستطلاع كما يردّها `/v1/moments/:id/poll` — الأعدادُ بعد التصويت أو لصاحبه. */
type PollState = { options: string[]; mine: number | null; counts: number[] | null; total: number | null };

/**
 * استطلاعُ المشرف على خاطرته (القاعدة ٢٨٩).
 *
 * قبل التصويت أزرارٌ بلا أرقام — من يرى النسبَ قبل أن يختار يتبع الأغلبيّة —
 * وبعده شريطٌ لكلّ خيارٍ بنسبته، والأعلى بلون اللمسة. والضغطُ على خيارٍ آخر
 * يبدّل الصوت. والخياراتُ تُرسم من اللحظة فوراً، والأعدادُ تُجلب بعدها.
 */
export function Poll({ momentId, options, author }: { momentId: string; options: string[]; author: boolean }) {
  const client = useQueryClient();
  const key = ["poll", momentId];
  const state = useQuery({ queryKey: key, queryFn: () => api<PollState>(`/v1/moments/${momentId}/poll`) });
  const vote = useMutation({
    mutationFn: (choice: number) =>
      api<PollState>(`/v1/moments/${momentId}/poll`, { method: "POST", body: JSON.stringify({ choice }) }),
    onSuccess: (data) => client.setQueryData(key, data),
  });

  const data = state.data;
  const counts = data?.counts ?? null;
  const total = data?.total ?? 0;
  const mine = vote.isPending ? vote.variables : (data?.mine ?? null);
  const top = counts && total > 0 ? Math.max(...counts) : -1;

  return (
    <View style={{ gap: 8, marginBottom: 10 }}>
      {(data?.options ?? options).map((label, index) => {
        const count = counts?.[index] ?? 0;
        const pct = counts && total > 0 ? Math.round((count / total) * 100) : 0;
        const leading = counts !== null && count === top;
        const chosen = mine === index;

        return (
          <Pressable
            key={index}
            accessibilityRole="button"
            accessibilityState={{ selected: chosen }}
            accessibilityLabel={counts ? `${label}، ${pct}٪` : label}
            disabled={author || vote.isPending || chosen}
            onPress={() => vote.mutate(index)}
            style={{
              minHeight: 44,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: chosen ? colors.clay : colors.line,
              backgroundColor: colors.paper,
              overflow: "hidden",
              justifyContent: "center",
            }}
          >
            {counts ? (
              <View
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  right: 0,
                  width: `${pct}%`,
                  backgroundColor: leading ? colors.clay : colors.chip,
                  opacity: leading ? 0.55 : 1,
                }}
              />
            ) : null}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10 }}>
              {chosen ? <CheckIcon size={15} color={colors.ink} /> : null}
              <Text style={{ flex: 1, minWidth: 0, color: colors.ink, fontSize: 13.5, fontWeight: leading || chosen ? "700" : "500" }}>
                {label}
              </Text>
              {counts ? (
                <Text style={{ color: colors.ink, fontSize: 12.5, fontWeight: leading ? "800" : "600" }}>{ar(pct)}٪</Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}

      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {state.isLoading || vote.isPending ? <ActivityIndicator size="small" color={colors.muted} /> : null}
        <Text style={{ color: colors.muted, fontSize: 11.5 }}>
          {vote.error
            ? (vote.error as Error).message
            : counts
              ? `${ar(total)} ${total === 1 ? "صوت" : "أصوات"}${author ? "" : " · اضغط خياراً آخر لتغيير صوتك"}`
              : "اختر لترى النتيجة"}
        </Text>
      </View>
    </View>
  );
}
