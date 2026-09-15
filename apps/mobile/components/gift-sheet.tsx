import { useState } from "react";
import { View, Text, Pressable, Modal, ScrollView, ActivityIndicator } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MediaImage } from "./media-image";
import { firstColor } from "./avatar";
import { CloseIcon, GiftIcon, SparkIcon } from "./icons";
import { api } from "../lib/api";
import { keys, useStore, type StoreItem } from "../lib/queries";
import { ar, coinText } from "../lib/format";
import { colors } from "../theme/tokens";

/**
 * الإهداء: المتجر يُفتح في نافذة فوق ملف صاحبك، لا في شاشة تُغادر مكانك.
 *
 * تختار الإطار فيُخصم من رصيدك ويصل إليه في لحظته — بلا سلّة ولا خطوات.
 * وما يملكه أصلاً يُعرض مطفأً: لا نبيعك ما لن ينفعه. والخصم بسعرك أنت:
 * أنت الدافع.
 */
export function GiftButton({
  friendId,
  friendName,
  friendIsPlus,
  friendOwned,
}: {
  friendId: string;
  friendName: string;
  friendIsPlus: boolean;
  friendOwned: string[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={{ flexDirection: "row", alignItems: "center", gap: 6, height: 42, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card }}
      >
        <GiftIcon size={16} color={colors.ink2} />
        <Text style={{ color: colors.ink2, fontSize: 13, fontWeight: "600" }}>إهداء</Text>
      </Pressable>

      {open ? (
        <Sheet
          friendId={friendId}
          friendName={friendName}
          friendIsPlus={friendIsPlus}
          friendOwned={friendOwned}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function Sheet({
  friendId,
  friendName,
  friendIsPlus,
  friendOwned,
  onClose,
}: {
  friendId: string;
  friendName: string;
  friendIsPlus: boolean;
  friendOwned: string[];
  onClose: () => void;
}) {
  const store = useStore();
  const client = useQueryClient();
  const [note, setNote] = useState<{ ok?: string; error?: string } | null>(null);
  const [sent, setSent] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const gift = useMutation({
    mutationFn: (itemId: string) =>
      api<{ ok?: string }>(`/v1/store/${itemId}/gift`, {
        method: "POST",
        body: JSON.stringify({ to: friendId }),
      }),
    onSuccess: (data, itemId) => {
      setNote({ ok: data.ok ?? `وصلته الهدية` });
      setSent((list) => [...list, itemId]);
      void client.invalidateQueries({ queryKey: keys.store });
      void client.invalidateQueries({ queryKey: keys.user(friendId) });
    },
    onError: (problem) =>
      setNote({ error: problem instanceof Error ? problem.message : "تعذّر الإهداء" }),
    onSettled: () => setBusy(null),
  });

  const isPlus = store.data?.isPlus ?? false;
  const coins = store.data?.coins ?? 0;
  const items = (store.data?.items ?? []).filter((item) => item.kind === "FRAME");
  const has = new Set([...friendOwned, ...sent]);
  const price = (item: StoreItem) =>
    isPlus ? Math.round(item.priceCoins * 0.8) : item.priceCoins;

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(14,26,36,.55)" }} onPress={onClose} />

      <View style={{ maxHeight: "82%", backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 28 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: colors.ink, fontSize: 15.5, fontWeight: "700" }}>
              أهدِ {friendName}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 11.5, marginTop: 2 }}>
              يُخصم من رصيدك ويصله في لحظته
            </Text>
          </View>

          <Pressable
            onPress={onClose}
            accessibilityLabel="إغلاق"
            style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line }}
          >
            <CloseIcon size={16} color={colors.muted} />
          </Pressable>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.goldLine, backgroundColor: colors.goldSoft, marginBottom: 12 }}>
          <SparkIcon size={14} color={colors.goldInk} />
          <Text style={{ color: colors.goldInk, fontSize: 12, fontWeight: "600" }}>
            رصيدك {coinText(coins)}
          </Text>
        </View>

        {note?.error ? (
          <Text accessibilityRole="alert" style={{ color: colors.clayInk, fontSize: 12.5, fontWeight: "500", backgroundColor: colors.claySoft, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 12 }}>
            {note.error}
          </Text>
        ) : null}
        {note?.ok ? (
          <Text style={{ color: colors.goldInk, fontSize: 12.5, fontWeight: "500", backgroundColor: colors.goldSoft, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 12 }}>
            {note.ok}
          </Text>
        ) : null}

        {store.isLoading ? <ActivityIndicator color={colors.clay} /> : null}

        <ScrollView contentContainerStyle={{ flexDirection: "row", flexWrap: "wrap", gap: 12, paddingBottom: 8 }}>
          {items.map((item) => {
            const already = has.has(item.id);
            // ما يُكتسب بالوقت لا يُهدى، ولا صنفُ «آثار+» لمن ليس مشتركاً.
            const locked = item.earnedAfterDays !== null || (item.plusOnly && !friendIsPlus);

            return (
              <Pressable
                key={item.id}
                disabled={already || locked || busy !== null}
                onPress={() => {
                  setNote(null);
                  setBusy(item.id);
                  gift.mutate(item.id);
                }}
                style={{
                  width: "31%",
                  alignItems: "center",
                  gap: 8,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: colors.line,
                  backgroundColor: colors.paper,
                  paddingHorizontal: 8,
                  paddingTop: 14,
                  paddingBottom: 12,
                  opacity: already || locked ? 0.55 : 1,
                }}
              >
                <View style={{ width: 58, height: 58, borderRadius: 29, padding: item.mediaId ? 0 : 3, overflow: "hidden", backgroundColor: firstColor(item.spec, colors.chip) }}>
                  {item.mediaId ? (
                    <MediaImage mediaId={item.mediaId} style={{ width: 58, height: 58 }} />
                  ) : (
                    <View style={{ flex: 1, borderRadius: 26, backgroundColor: colors.card }} />
                  )}
                </View>

                <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 11.5, fontWeight: "500" }}>
                  {item.name}
                </Text>
                <Text style={{ color: colors.clayInk, fontSize: 10.5, fontWeight: "600" }}>
                  {already
                    ? "عنده"
                    : item.earnedAfterDays !== null
                      ? `يُكتسب بـ${ar(item.earnedAfterDays)} يوم`
                      : item.plusOnly && !friendIsPlus
                        ? "لمشتركي آثار+"
                        : busy === item.id
                          ? "…"
                          : coinText(price(item))}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}
