import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Text } from "./type";
import { Sheet } from "./sheet";
import { MediaImage } from "./media-image";
import { CheckIcon, SparkIcon } from "./icons";
import { api } from "../lib/api";
import { keys } from "../lib/queries";
import { useSession } from "../lib/session";
import { ar, coinText } from "../lib/format";
import { colors } from "../theme/tokens";
import type { StickerPack } from "../lib/stickers";

/** مجموعةٌ جديدة تدخل «وصل حديثاً» أسبوعين — **بقرار المالك**. */
const FRESH_DAYS = 14;

export const freshPacks = (packs: StickerPack[]) =>
  packs
    .filter((pack) => pack.createdAt && Date.now() - +new Date(pack.createdAt) < FRESH_DAYS * 86_400_000)
    .sort((a, b) => +new Date(b.createdAt!) - +new Date(a.createdAt!));

/** حالُ المجموعة عند القارئ: مملوكة، أو مفتوحةٌ باشتراكه، أو تحتاج اشتراكاً، أو شراءً. */
function stateOf(pack: StickerPack, isPlus: boolean) {
  const price = pack.priceCoins ?? 0;
  if (pack.owned) return "owned" as const;
  if (price > 0) return "buy" as const;
  return isPlus ? ("open" as const) : ("plus" as const);
}

/**
 * بطاقةُ مجموعة ملصقات في المتجر (القاعدة ٢٩٧) — **بقرار المالك**: أوّلُ أربعةٍ منها
 * مربّعاً، فاسمُها وعددُها، فحالُها. والضغطةُ تفتح معاينتها كاملةً لا تشتري (القاعدة ٩٣ب).
 */
function PackCard({ pack, isPlus, width, onPress }: { pack: StickerPack; isPlus: boolean; width: number | `${number}%`; onPress: () => void }) {
  const state = stateOf(pack, isPlus);
  return (
    <Pressable
      onPress={onPress}
      style={{
        width,
        alignItems: "center",
        gap: 8,
        paddingTop: 12,
        paddingBottom: 12,
        paddingHorizontal: 8,
        borderRadius: 16,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.line,
      }}
    >
      <View style={{ width: 72, height: 72, flexDirection: "row", flexWrap: "wrap", gap: 2 }}>
        {pack.stickers.slice(0, 4).map((one) => (
          <MediaImage key={one.id} mediaId={one.mediaId} resizeMode="contain" style={{ width: 35, height: 35 }} />
        ))}
      </View>
      <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 11.5, fontWeight: "500" }}>
        {pack.name}
      </Text>
      <Text style={{ color: colors.faint, fontSize: 10 }}>{ar(pack.stickers.length)} ملصق</Text>
      {state === "owned" ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <CheckIcon size={12} color={colors.clay} />
          <Text style={{ color: colors.clayInk, fontSize: 10.5, fontWeight: "600" }}>مملوكة</Text>
        </View>
      ) : state === "buy" ? (
        <Text style={{ color: colors.clayInk, fontSize: 11, fontWeight: "600" }}>{coinText(pack.priceCoins ?? 0)}</Text>
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <SparkIcon size={12} color={colors.gold} />
          <Text style={{ color: colors.goldInk, fontSize: 10.5, fontWeight: "600" }}>
            {state === "open" ? "مفعّلة لك" : "مع آثار+"}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

/** المعاينة: الملصقاتُ كلّها، ثمّ الفعلُ الذي يناسب حالَها. */
function PackSheet({ pack, isPlus, onClose }: { pack: StickerPack; isPlus: boolean; onClose: () => void }) {
  const router = useRouter();
  const client = useQueryClient();
  const coins = useSession((state) => state.me?.coins ?? 0);
  const refreshSession = useSession((state) => state.refresh);
  const { width, height } = useWindowDimensions();
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null);
  const state = said?.ok ? "owned" : stateOf(pack, isPlus);
  const price = pack.priceCoins ?? 0;
  // النقصُ يُقال قبل الضغط (القاعدة ٩٣ب).
  const short = state === "buy" && coins < price;
  const cell = Math.floor((width - 40 - 3 * 10) / 4);

  const leave = (to: string) => {
    onClose();
    router.push(to as never);
  };
  const buy = async () => {
    if (busy) return;
    setBusy(true);
    setSaid(null);
    try {
      const res = await api<{ ok: string }>(`/v1/stickers/packs/${pack.id}/buy`, { method: "POST" });
      setSaid({ ok: true, text: res.ok });
      // الملكيّةُ من القائمة والرصيدُ من الجلسة والمتجر — كلُّها تغيّر.
      await Promise.all([
        client.invalidateQueries({ queryKey: ["stickers"] }),
        client.invalidateQueries({ queryKey: keys.store }),
        refreshSession(),
      ]);
    } catch (error) {
      setSaid({ ok: false, text: error instanceof Error ? error.message : "تعذّر الشراء" });
    } finally {
      setBusy(false);
    }
  };

  const button = (label: string, onPress: () => void, color: string, ink = colors.onBrand) => (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={{ height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, backgroundColor: color, opacity: busy ? 0.7 : 1 }}
    >
      {busy ? <ActivityIndicator size="small" color={ink} /> : null}
      <Text style={{ color: ink, fontSize: 14, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );

  return (
    <Sheet title={pack.name} onClose={onClose}>
      <Text style={{ color: colors.faint, fontSize: 12, textAlign: "center", marginBottom: 12 }}>
        {ar(pack.stickers.length)} ملصق ·{" "}
        {price > 0 ? "تشتريها مرّة وتبقى لك" : "مع اشتراك آثار+ في التعليقات والمحادثات"}
      </Text>
      <ScrollView style={{ maxHeight: height * 0.45 }} contentContainerStyle={{ flexDirection: "row", flexWrap: "wrap", gap: 10, paddingBottom: 8 }}>
        {pack.stickers.map((one) => (
          <View key={one.id} style={{ width: cell, height: cell, borderRadius: 14, backgroundColor: colors.chip, alignItems: "center", justifyContent: "center" }}>
            <MediaImage mediaId={one.mediaId} resizeMode="contain" style={{ width: cell - 12, height: cell - 12 }} />
          </View>
        ))}
      </ScrollView>

      <View style={{ marginTop: 14, gap: 8 }}>
        {state === "owned" ? (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 46 }}>
            <CheckIcon size={16} color={colors.clay} />
            <Text style={{ color: colors.clayInk, fontSize: 14, fontWeight: "700" }}>
              {said?.ok ? said.text : "مملوكة — تجدها بجانب الإرسال"}
            </Text>
          </View>
        ) : state === "open" ? (
          <Text style={{ color: colors.goldInk, fontSize: 13, fontWeight: "600", textAlign: "center" }}>
            مفعّلة باشتراكك — تجدها بجانب الإرسال
          </Text>
        ) : state === "plus" ? (
          button("اشترك في آثار+", () => leave("/subscribe"), colors.gold, "#fff")
        ) : short ? (
          <>
            <Text style={{ color: colors.faint, fontSize: 12.5, textAlign: "center" }}>
              تحتاج {ar(price)} نقطة — رصيدك {ar(coins)}
            </Text>
            {button("اشحن نقاطك", () => leave("/coins"), colors.gold, "#fff")}
          </>
        ) : (
          button(`اشترِها بـ${coinText(price)}`, buy, colors.clay)
        )}
        {said && !said.ok ? (
          <Text accessibilityRole="alert" style={{ color: colors.clayInk, fontSize: 12.5, textAlign: "center" }}>
            {said.text}
          </Text>
        ) : null}
      </View>
    </Sheet>
  );
}

/** صفٌّ أو شبكةٌ من بطاقات المجموعات، ومعاينةُ ما يُضغط منها. */
export function PackShelf({ packs, isPlus, strip = false }: { packs: StickerPack[]; isPlus: boolean; strip?: boolean }) {
  const { width: screen } = useWindowDimensions();
  const [open, setOpen] = useState<StickerPack | null>(null);
  const tile = Math.round((screen - 40 - 24) / 3.25);
  const cards = packs.map((pack) => (
    <PackCard key={pack.id} pack={pack} isPlus={isPlus} width={strip ? tile : "30.7%"} onPress={() => setOpen(pack)} />
  ));
  return (
    <>
      {strip ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20, marginBottom: 24 }} contentContainerStyle={{ flexDirection: "row", gap: 12, paddingHorizontal: 20 }}>
          {cards}
        </ScrollView>
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>{cards}</View>
      )}
      {open ? <PackSheet pack={open} isPlus={isPlus} onClose={() => setOpen(null)} /> : null}
    </>
  );
}
