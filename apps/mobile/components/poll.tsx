import { useEffect, useRef, useState } from "react";
import { View, Pressable, ActivityIndicator, Animated, Easing } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Text } from "./type";
import { CheckIcon } from "./icons";
import { api } from "../lib/api";
import { ar } from "../lib/format";
import { colors } from "../theme/tokens";

/** نتيجةُ الاستطلاع كما يردّها `/v1/moments/:id/poll` — الأعدادُ بعد التصويت أو لصاحبه أو بعد انتهائه. */
type PollState = {
  options: string[];
  /** اختياريّان لخادمٍ قبل المدّة. */
  endsAt?: string | null;
  closed?: boolean;
  mine: number | null;
  counts: number[] | null;
  total: number | null;
};

/** «باقي ٣ أيام» — وما دون اليوم ساعات، وما دون الساعة «أقلّ من ساعة». */
function leftText(endsAt: string): string {
  const ms = new Date(endsAt).getTime() - Date.now();
  const hours = Math.ceil(ms / 3_600_000);
  if (hours <= 1) return "باقي أقل من ساعة";
  if (hours < 24) return `باقي ${hours === 2 ? "ساعتين" : `${ar(hours)} ${hours <= 10 ? "ساعات" : "ساعة"}`}`;
  const days = Math.ceil(hours / 24);
  return `باقي ${days === 1 ? "يوم" : days === 2 ? "يومين" : `${ar(days)} ${days <= 10 ? "أيام" : "يوماً"}`}`;
}

/**
 * شريطُ الخيار يمتدّ إلى نسبته ولا يقفز إليها (القاعدة ٢٩٠): من الصفر حين تنكشف
 * النتيجة، ومن موضعه حين تتغيّر الأصوات — والرقمُ يعدّ معه.
 */
function Bar({ pct, leading }: { pct: number; leading: boolean }) {
  const width = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(width, {
      toValue: pct,
      duration: 750,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [pct, width]);
  return (
    <Animated.View
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        right: 0,
        width: width.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] }),
        backgroundColor: leading ? colors.clay : colors.chip,
        opacity: leading ? 0.55 : 1,
      }}
    />
  );
}

function CountUp({ value, bold }: { value: number; bold: boolean }) {
  const anim = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = anim.addListener(({ value: v }) => setShown(Math.round(v)));
    Animated.timing(anim, { toValue: value, duration: 750, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => anim.removeListener(id);
  }, [value, anim]);
  return (
    <Text style={{ color: colors.ink, fontSize: 12.5, fontWeight: bold ? "800" : "600" }}>{ar(shown)}٪</Text>
  );
}

/**
 * استطلاعُ المشرف على خاطرته (القاعدتان ٢٨٩ و٢٩٠).
 *
 * التصويتُ سرّيّ: لا أسماء، أعدادٌ وحدها. قبل التصويت أزرارٌ بلا أرقام، وبعده
 * شريطٌ لكلّ خيارٍ يمتدّ إلى نسبته والأعلى بلون اللمسة، ويُسأل الخادمُ كلّ ربع
 * دقيقة فتتحرّك الأشرطةُ مع الأصوات. وبانتهاء مدّته يُقفل والنتيجةُ للجميع.
 */
export function Poll({
  momentId,
  options,
  endsAt,
  author,
}: {
  momentId: string;
  options: string[];
  endsAt?: string | null;
  author: boolean;
}) {
  const client = useQueryClient();
  const key = ["poll", momentId];
  const state = useQuery({
    queryKey: key,
    queryFn: () => api<PollState>(`/v1/moments/${momentId}/poll`),
    // النتيجةُ حيّةٌ ما دام مفتوحاً وقد انكشفت لقارئها.
    refetchInterval: (query) => {
      const data = query.state.data;
      return data && data.counts && !data.closed ? 15_000 : false;
    },
  });
  const vote = useMutation({
    mutationFn: (choice: number) =>
      api<PollState>(`/v1/moments/${momentId}/poll`, { method: "POST", body: JSON.stringify({ choice }) }),
    onSuccess: (data) => client.setQueryData(key, data),
  });

  const data = state.data;
  const end = data?.endsAt ?? endsAt ?? null;
  const closed = data?.closed ?? (end ? new Date(end).getTime() <= Date.now() : false);
  const counts = data?.counts ?? null;
  const total = data?.total ?? 0;
  const mine = vote.isPending ? vote.variables : (data?.mine ?? null);
  const top = counts && total > 0 ? Math.max(...counts) : -1;

  const status = vote.error
    ? (vote.error as Error).message
    : closed
      ? `انتهى الاستطلاع · ${ar(total)} ${total === 1 ? "صوت" : "أصوات"}`
      : counts
        ? `${ar(total)} ${total === 1 ? "صوت" : "أصوات"}${end ? ` · ${leftText(end)}` : ""}${author ? "" : " · اضغط خياراً آخر لتغيير صوتك"}`
        : `اختر لترى النتيجة${end ? ` · ${leftText(end)}` : ""}`;

  return (
    <View style={{ gap: 8, marginBottom: 10 }}>
      {(data?.options ?? options).map((label, index) => {
        const count = counts?.[index] ?? 0;
        const pct = counts && total > 0 ? Math.round((count / total) * 100) : 0;
        const leading = counts !== null && total > 0 && count === top;
        const chosen = mine === index;

        return (
          <Pressable
            key={index}
            accessibilityRole="button"
            accessibilityState={{ selected: chosen, disabled: closed }}
            accessibilityLabel={counts ? `${label}، ${pct}٪` : label}
            disabled={author || closed || vote.isPending || chosen}
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
            {counts ? <Bar pct={pct} leading={leading} /> : null}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10 }}>
              {chosen ? <CheckIcon size={15} color={colors.ink} /> : null}
              <Text style={{ flex: 1, minWidth: 0, color: colors.ink, fontSize: 13.5, fontWeight: leading || chosen ? "700" : "500" }}>
                {label}
              </Text>
              {counts ? <CountUp value={pct} bold={leading} /> : null}
            </View>
          </Pressable>
        );
      })}

      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {state.isLoading || vote.isPending ? <ActivityIndicator size="small" color={colors.muted} /> : null}
        <Text style={{ color: closed ? colors.ink2 : colors.muted, fontSize: 11.5, fontWeight: closed ? "700" : "400" }}>
          {status}
        </Text>
      </View>
    </View>
  );
}
