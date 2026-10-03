import { useRef, useState } from "react";
import { View, Pressable, Modal, ScrollView, ActivityIndicator, PanResponder, Animated, Dimensions } from "react-native";
import { Text } from "./type";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MediaImage } from "./media-image";
import { firstColor } from "./avatar";
import { CloseIcon, GiftIcon, SparkIcon } from "./icons";
import { api } from "../lib/api";
import { keys, useStore, type StoreItem } from "../lib/queries";
import { ar, coinText, daysLabel } from "../lib/format";
import { colors } from "../theme/tokens";
import { billingReady, buyGift, prices } from "../lib/billing";

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
  grow,
}: {
  friendId: string;
  friendName: string;
  friendIsPlus: boolean;
  friendOwned: string[];
  /** يملأ مكانه في صفّ أزرار الملف بمقاس أزرار «أنا». */
  grow?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          height: grow ? 46 : 42,
          flexGrow: grow ? 1 : 0,
          paddingHorizontal: 14,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.line,
          backgroundColor: colors.card,
        }}
      >
        <GiftIcon size={16} color={colors.ink2} />
        <Text style={{ color: grow ? colors.ink : colors.ink2, fontSize: grow ? 13.5 : 13, fontWeight: "600" }}>إهداء</Text>
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

  /*
    الصنفُ المختار ومدّتُه: الضغطةُ تختار ولا تُهدي — صنفٌ بمُددٍ يحتاج أن
    تُختار مدّتُه، وما بلا مُددٍ يُهدى من الزرّ نفسه تحت الشبكة.
  */
  const [pick, setPick] = useState<StoreItem | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [kind, setKind] = useState<"FRAME" | "CHARM" | "THEME">("FRAME");

  const gift = useMutation({
    mutationFn: ({ itemId, plan }: { itemId: string; plan?: string }) =>
      api<{ ok?: string }>(`/v1/store/${itemId}/gift`, {
        method: "POST",
        body: JSON.stringify(plan ? { to: friendId, plan } : { to: friendId }),
      }),
    onSuccess: (data, { itemId }) => {
      setNote({ ok: data.ok ?? `وصلته الهدية` });
      setSent((list) => [...list, itemId]);
      setPick(null);
      void client.invalidateQueries({ queryKey: keys.store });
      void client.invalidateQueries({ queryKey: keys.user(friendId) });
    },
    onError: (problem) =>
      setNote({ error: problem instanceof Error ? problem.message : "تعذّر الإهداء" }),
    onSettled: () => setBusy(null),
  });

  /*
    السحبُ يُغلق — **بقرار المالك**: إلى أسفل من أيّ مكانٍ في النافذة، والنافذةُ
    تتبع الإصبع؛ وما لم يبلغ الحدّ يعود. كان الالتقاطُ في طور الصعود فتأخذ القائمةُ
    السحبةَ قبله فلا يُغلق إلا الرأس. والالتقاطُ الآن في طور الهبوط، **وما دامت
    القائمةُ في أعلاها** — وإلّا فالسحبةُ لها تمرّ بها إلى أعلى. والأفقيُّ يُغلق
    كرجوع الشاشات (القاعدة ١٦٢).
  */
  const drag = useRef(new Animated.Value(0)).current;
  const atTop = useRef(true);
  const height = Dimensions.get("window").height;
  const dismiss = () =>
    Animated.timing(drag, { toValue: height, duration: 200, useNativeDriver: true }).start(onClose);
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_e, g) =>
        (atTop.current && g.dy > 8 && g.dy > Math.abs(g.dx) * 1.5) ||
        (Math.abs(g.dx) > 24 && Math.abs(g.dx) > Math.abs(g.dy) * 2),
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_e, g) => {
        if (Math.abs(g.dy) >= Math.abs(g.dx)) drag.setValue(Math.max(0, g.dy));
      },
      onPanResponderRelease: (_e, g) => {
        if (g.dy > 110 || g.vy > 1 || Math.abs(g.dx) > 80 || Math.abs(g.vx) > 0.8) dismiss();
        else Animated.spring(drag, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
      },
      onPanResponderTerminate: () => Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start(),
    }),
  ).current;

  /*
    آثار+ هديةً — **بقرار المالك** (القاعدة ٢٣٤): مثبّتٌ فوق المتجر، ويُدفع بمالٍ
    حقيقيّ من نافذة آبل لا بالنقاط. والمُدَدُ من الخادم (ما له منتجٌ في المتجر)
    والسعرُ من المتجر نفسه؛ وما لا سعرَ له لا يُعرض.
  */
  const plusPlans = useQuery({
    queryKey: ["plus-gift-plans"],
    queryFn: async () => {
      const { plans } = await api<{ plans: { plan: "month" | "year"; sku: string; days: number; label: string }[] }>(
        "/v1/plus/gift",
      );
      const priced = await prices(plans.map((one) => one.sku));
      return plans.filter((one) => priced[one.sku]).map((one) => ({ ...one, price: priced[one.sku]! }));
    },
    enabled: billingReady(),
    staleTime: 10 * 60_000,
  });
  const giftPlus = async (plan: "month" | "year") => {
    setNote(null);
    setBusy(`plus-${plan}`);
    try {
      const { sku } = await api<{ id: string; sku: string }>("/v1/plus/gift", {
        method: "POST",
        body: JSON.stringify({ to: friendId, plan }),
      });
      const result = await buyGift(sku);
      if (result.bought) {
        setNote({ ok: `تمّ الشراء — يصل آثار+ إلى ${friendName} خلال دقيقة` });
      } else if (!result.cancelled) {
        setNote({ error: "تعذّر فتح المتجر — أعد المحاولة" });
      }
    } catch (problem) {
      setNote({ error: problem instanceof Error ? problem.message : "تعذّر الإهداء" });
    } finally {
      setBusy(null);
    }
  };

  const isPlus = store.data?.isPlus ?? false;
  const coins = store.data?.coins ?? 0;
  /*
    المتجرُ كلُّه لا الإطارات وحدها — **بقرار المالك**: الإطاراتُ والتمائمُ
    والثيمات، كلٌّ في شريحته، وداخلها أقسامٌ بمجموعاتها كالمتجر.
  */
  const KINDS = [
    { key: "FRAME", label: "الإطارات", kinds: ["FRAME"] },
    { key: "CHARM", label: "التمائم", kinds: ["CHARM"] },
    { key: "THEME", label: "الثيمات", kinds: ["THEME", "BACKGROUND"] },
  ] as const;
  const tab = KINDS.find((row) => row.key === kind)!;
  const items = (store.data?.items ?? []).filter((item) => (tab.kinds as readonly string[]).includes(item.kind));
  const collections = (store.data?.collections ?? []).filter((one) => (tab.kinds as readonly string[]).includes(one.kind));
  const known = new Set(collections.map((one) => one.id));
  const sections = [
    ...collections.map((one) => ({ title: one.name, items: items.filter((item) => item.collectionId === one.id) })),
    { title: collections.length ? `${tab.label} الأخرى` : "", items: items.filter((item) => !item.collectionId || !known.has(item.collectionId)) },
  ].filter((row) => row.items.length > 0);
  const has = new Set([...friendOwned, ...sent]);
  const price = (item: { priceCoins: number }) =>
    isPlus ? Math.round(item.priceCoins * 0.8) : item.priceCoins;
  const plans = pick?.plans ?? [];
  const plan = plans.find((one) => one.id === planId) ?? plans[0] ?? null;
  const pickPrice = pick ? price(plan ? { priceCoins: plan.priceCoins } : pick) : 0;

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(14,26,36,.55)" }} onPress={onClose} />

      <Animated.View
        {...pan.panHandlers}
        style={{ maxHeight: "82%", backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 28, transform: [{ translateY: drag }] }}
      >
        {/* مقبضٌ يقول إنّ النافذة تُسحب. */}
        <View style={{ width: 44, height: 4, borderRadius: 2, backgroundColor: colors.line, alignSelf: "center", marginBottom: 12 }} />
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

        {plusPlans.data && plusPlans.data.length > 0 ? (
          <View
            style={{
              borderRadius: 18,
              borderWidth: 1,
              borderColor: colors.goldLine,
              backgroundColor: colors.goldSoft,
              padding: 14,
              marginBottom: 14,
              gap: 10,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <SparkIcon size={18} color={colors.goldInk} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "700" }}>أهدِه آثار+</Text>
                <Text style={{ color: colors.goldInk, fontSize: 11.5, marginTop: 1 }}>
                  {friendIsPlus ? "تُضاف إلى اشتراكه القائم" : "اشتراكٌ يبدأ في لحظته"} · يُدفع من حسابك في المتجر
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {plusPlans.data.map((one) => (
                <Pressable
                  key={one.plan}
                  disabled={busy !== null}
                  onPress={() => void giftPlus(one.plan)}
                  style={{
                    flex: 1,
                    height: 52,
                    borderRadius: 14,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: colors.card,
                    borderWidth: 1,
                    borderColor: colors.goldLine,
                    opacity: busy && busy !== `plus-${one.plan}` ? 0.5 : 1,
                  }}
                >
                  {busy === `plus-${one.plan}` ? (
                    <ActivityIndicator color={colors.goldInk} />
                  ) : (
                    <>
                      <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "700" }}>
                        {one.plan === "year" ? "سنة" : "شهر"}
                      </Text>
                      <Text style={{ color: colors.goldInk, fontSize: 12, fontWeight: "600", marginTop: 1 }}>{one.price}</Text>
                    </>
                  )}
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
          {KINDS.map((row) => {
            const on = row.key === kind;
            return (
              <Pressable
                key={row.key}
                onPress={() => {
                  setKind(row.key);
                  setPick(null);
                }}
                style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: on ? colors.clay : colors.line, backgroundColor: on ? colors.clay : colors.card }}
              >
                <Text style={{ color: on ? colors.onBrand : colors.ink2, fontSize: 12.5, fontWeight: "600" }}>{row.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: 8 }}
          scrollEventThrottle={16}
          onScroll={(event) => {
            atTop.current = event.nativeEvent.contentOffset.y <= 0;
          }}
        >
          {sections.length === 0 && !store.isLoading ? (
            <Text style={{ color: colors.muted, fontSize: 12.5, textAlign: "center", marginTop: 16 }}>ما فيه {tab.label} بعد.</Text>
          ) : null}
          {sections.map((section) => (
            <View key={section.title || "all"} style={{ marginBottom: 12 }}>
              {section.title ? (
                <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "700", marginBottom: 8 }}>{section.title}</Text>
              ) : null}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {section.items.map((item) => {
            const already = has.has(item.id) && !(item.plans?.length);
            // ما يُكتسب بالوقت لا يُهدى، ولا صنفُ «آثار+» لمن ليس مشتركاً.
            const locked = item.earnedAfterDays !== null || (item.plusOnly && !friendIsPlus);
            const chosen = pick?.id === item.id;

            return (
              <Pressable
                key={item.id}
                disabled={already || locked || busy !== null}
                onPress={() => {
                  setNote(null);
                  setPick(item);
                  setPlanId(item.plans?.[0]?.id ?? null);
                }}
                style={{
                  width: "31%",
                  alignItems: "center",
                  gap: 8,
                  borderRadius: 16,
                  borderWidth: chosen ? 2 : 1,
                  borderColor: chosen ? colors.clay : colors.line,
                  backgroundColor: colors.paper,
                  paddingHorizontal: 8,
                  paddingTop: 14,
                  paddingBottom: 12,
                  opacity: already || locked ? 0.55 : 1,
                }}
              >
                <View style={{ width: 58, height: 58, borderRadius: item.kind === "CHARM" ? 0 : 29, padding: item.mediaId ? 0 : 3, overflow: "hidden", backgroundColor: item.mediaId && item.kind === "CHARM" ? "transparent" : firstColor(item.spec, colors.chip) }}>
                  {item.mediaId ? (
                    <MediaImage mediaId={item.mediaId} resizeMode={item.kind === "CHARM" || item.kind === "FRAME" ? "contain" : "cover"} style={{ width: 58, height: 58 }} />
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
                          : item.plans?.length
                            ? `من ${coinText(price({ priceCoins: Math.min(...item.plans.map((one) => one.priceCoins)) }))}`
                            : coinText(price(item))}
                </Text>
              </Pressable>
            );
          })}
              </View>
            </View>
          ))}
        </ScrollView>

        {/* الصنفُ المختار: مدّتُه إن كان له مُدَد، ثمّ «أهدِ». */}
        {pick ? (
          <View style={{ borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12, gap: 8 }}>
            <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "700" }}>{pick.name}</Text>
            {plans.length > 0 ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {plans.map((one) => {
                  const on = plan?.id === one.id;
                  return (
                    <Pressable
                      key={one.id}
                      onPress={() => setPlanId(one.id)}
                      style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: on ? colors.clay : colors.line, backgroundColor: on ? colors.claySoft : colors.card }}
                    >
                      <Text style={{ color: colors.ink, fontSize: 12, fontWeight: on ? "700" : "500" }}>
                        {daysLabel(one.days)} · {coinText(price({ priceCoins: one.priceCoins }))}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
            <Pressable
              disabled={busy !== null}
              onPress={() => {
                setBusy(pick.id);
                gift.mutate({ itemId: pick.id, plan: plan?.id });
              }}
              style={{ height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.clay, opacity: busy ? 0.6 : 1 }}
            >
              <Text style={{ color: colors.onBrand, fontSize: 14, fontWeight: "700" }}>
                {busy ? "نُهدي…" : `أهدِ بـ${coinText(pickPrice)}`}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </Animated.View>
    </Modal>
  );
}
