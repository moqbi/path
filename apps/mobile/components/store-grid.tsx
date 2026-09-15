import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MediaImage } from "./media-image";
import { firstColor } from "./avatar";
import { CheckIcon, LockIcon } from "./icons";
import { api } from "../lib/api";
import { keys, type StoreItem } from "../lib/queries";
import { ar, riyals } from "../lib/format";
import { colors } from "../theme/tokens";

/**
 * معاينة الصنف تتبع نوعه.
 *
 * الإطار حلقةٌ حول وجه، والثيم مساحةُ لون، والتميمة قطعةٌ صغيرة —
 * وعرضُها كلِّها مربّعاً واحداً كان يجعل الإطار يُقرأ قرصاً والتميمة
 * لطخة.
 */
function Preview({ item }: { item: StoreItem }) {
  const paint = firstColor(item.spec, colors.chip);

  if (item.kind === "FRAME") {
    return (
      <View style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: paint, padding: 3 }}>
        {item.mediaId ? (
          <MediaImage mediaId={item.mediaId} style={{ width: 56, height: 56, borderRadius: 28 }} />
        ) : (
          <View style={{ flex: 1, borderRadius: 28, backgroundColor: colors.card }} />
        )}
      </View>
    );
  }

  if (item.kind === "CHARM") {
    return (
      <View style={{ width: 52, height: 52, marginVertical: 5, alignItems: "center", justifyContent: "center" }}>
        {item.mediaId ? (
          <MediaImage mediaId={item.mediaId} resizeMode="contain" style={{ width: 52, height: 52 }} />
        ) : (
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: paint }} />
        )}
      </View>
    );
  }

  return (
    <View style={{ width: "100%", height: 62, borderRadius: 12, backgroundColor: paint, overflow: "hidden" }}>
      {item.mediaId ? <MediaImage mediaId={item.mediaId} style={{ width: "100%", height: 62 }} /> : null}
    </View>
  );
}

/**
 * شبكة الأصناف.
 *
 * ما تملكه يُلبَس من هنا كما يُلبَس من ملفك، والملبوس يُقال «ملبوس» لا
 * يُخفى. والمنعُ يُشرَح: «رصيدك لا يكفي» أو «باقي ٥ أيام» — لا زرٌّ
 * ميّتٌ بلا سبب.
 */
export function StoreGrid({
  items,
  owned,
  isPlus,
  credit,
  daysHere,
  equipped,
}: {
  items: StoreItem[];
  owned: string[];
  isPlus: boolean;
  credit: number;
  daysHere: number;
  equipped: { frame: string | null; theme: string | null; charm: string | null };
}) {
  const client = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    void client.invalidateQueries({ queryKey: keys.store });
    void client.invalidateQueries({ queryKey: keys.me });
    void client.invalidateQueries({ queryKey: ["me"] });
    void client.invalidateQueries({ queryKey: ["feed"] });
  };

  const buy = useMutation({
    mutationFn: (id: string) => api<{ ok: string }>(`/v1/store/${id}/buy`, { method: "POST" }),
    onSuccess: refresh,
    onError: (problem: Error) => setError(problem.message),
  });
  const wear = useMutation({
    mutationFn: (id: string) => api(`/v1/store/${id}/equip`, { method: "POST" }),
    onSuccess: refresh,
    onError: (problem: Error) => setError(problem.message),
  });
  const strip = useMutation({
    mutationFn: (kind: string) =>
      api("/v1/store/unequip", { method: "POST", body: JSON.stringify({ kind }) }),
    onSuccess: refresh,
    onError: (problem: Error) => setError(problem.message),
  });

  const ownedSet = new Set(owned);
  const price = (item: StoreItem) =>
    isPlus ? Math.round(item.priceHalalas * 0.8) : item.priceHalalas;

  const wornId = (item: StoreItem) =>
    item.kind === "FRAME" ? equipped.frame : item.kind === "CHARM" ? equipped.charm : equipped.theme;

  const pending = buy.isPending || wear.isPending || strip.isPending;

  function act(item: StoreItem) {
    setError(null);

    if (ownedSet.has(item.id)) {
      if (wornId(item) === item.id) {
        strip.mutate(item.kind === "FRAME" ? "FRAME" : item.kind === "CHARM" ? "CHARM" : "BACKGROUND");
        return;
      }
      wear.mutate(item.id);
      return;
    }

    if (item.plusOnly && !isPlus) return setError("هذا الصنف لمشتركي أثر+");
    if (item.earnedAfterDays !== null && daysHere < item.earnedAfterDays) {
      return setError(
        `يُكتسب بعد ${ar(item.earnedAfterDays)} يوم — باقي ${ar(item.earnedAfterDays - daysHere)}`,
      );
    }
    if (credit < price(item)) return setError("رصيدك لا يكفي");
    buy.mutate(item.id);
  }

  if (items.length === 0) {
    return (
      <View style={{ marginBottom: 24, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, paddingVertical: 32, paddingHorizontal: 16 }}>
        <Text style={{ color: colors.muted, fontSize: 12.5, textAlign: "center" }}>
          ما فيه أصناف هنا بعد.
        </Text>
      </View>
    );
  }

  return (
    <>
      {error ? (
        <View style={{ marginBottom: 12, borderRadius: 12, backgroundColor: colors.claySoft, paddingHorizontal: 16, paddingVertical: 12 }}>
          <Text accessibilityRole="alert" style={{ color: colors.clayInk, fontSize: 12.5, fontWeight: "600" }}>
            {error}
          </Text>
        </View>
      ) : null}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
        {items.map((item) => {
          const have = ownedSet.has(item.id);
          const worn = have && wornId(item) === item.id;
          const locked =
            (item.plusOnly && !isPlus) ||
            (item.earnedAfterDays !== null && daysHere < item.earnedAfterDays);

          return (
            <Pressable
              key={item.id}
              disabled={pending}
              onPress={() => act(item)}
              style={{
                width: "30.7%",
                alignItems: "center",
                gap: 10,
                paddingTop: 14,
                paddingBottom: 12,
                paddingHorizontal: 8,
                borderRadius: 16,
                backgroundColor: colors.card,
                borderWidth: worn ? 1.5 : 1,
                borderColor: worn ? colors.clay : colors.line,
                opacity: pending ? 0.6 : 1,
              }}
            >
              {item.earnedAfterDays !== null ? (
                <View style={{ position: "absolute", top: -8, alignSelf: "center", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2, backgroundColor: colors.gold }}>
                  <Text style={{ color: colors.card, fontSize: 9.5, fontWeight: "600" }}>يُكتسب</Text>
                </View>
              ) : item.limited ? (
                <View style={{ position: "absolute", top: -8, alignSelf: "center", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2, backgroundColor: colors.live }}>
                  <Text style={{ color: "#fff", fontSize: 9.5, fontWeight: "600" }}>محدودة</Text>
                </View>
              ) : null}

              <Preview item={item} />

              <Text style={{ color: colors.ink, fontSize: 11.5, fontWeight: "500" }} numberOfLines={1}>
                {item.name}
              </Text>

              {worn ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <CheckIcon size={12} color={colors.clay} />
                  <Text style={{ color: colors.clayInk, fontSize: 10.5, fontWeight: "600" }}>ملبوس</Text>
                </View>
              ) : have ? (
                <Text style={{ color: colors.clayInk, fontSize: 10.5, fontWeight: "600" }}>ألبسه</Text>
              ) : locked ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <LockIcon size={11} color={colors.faint} />
                  <Text style={{ color: colors.faint, fontSize: 10.5 }}>
                    {item.earnedAfterDays !== null ? `${ar(item.earnedAfterDays)} يوم` : "أثر+"}
                  </Text>
                </View>
              ) : (
                <Text style={{ color: colors.clayInk, fontSize: 11, fontWeight: "600" }}>
                  {riyals(price(item))}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </>
  );
}
