import { useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Text } from "./type";
import { MediaImage } from "./media-image";
import { Spinner } from "./spinner";
import { CheckIcon, SparkIcon } from "./icons";
import { api } from "../lib/api";
import { keys } from "../lib/queries";
import { useSession } from "../lib/session";
import { ar, coinText } from "../lib/format";
import { colors } from "../theme/tokens";
import type { StickerPack } from "../lib/stickers";

/**
 * بطاقةُ إعلان مجموعة ملصقاتٍ جديدة عند الفتح (القاعدة ٣٣٥) — **بقرار المالك**،
 * بهيئة بطاقة الصنف (القاعدة ٢٦٧): ملصقاتُها، فاسمُها، ثمّ حالُها.
 * المجانيّةُ «حصرياً لمشتركي آثار+» وزرُّ الاشتراك لمن ليس مشتركاً، والمدفوعةُ
 * سعرُها وزرُّ شرائها — والملصقاتُ ظاهرةٌ فوقه فما يُشترى يُرى قبل شرائه
 * (القاعدة ٩٣ب). والنقصُ يُقال قبل الضغط ومعه بابُ الشحن.
 */
export function PackPromo({ pack, onClose }: { pack: StickerPack; onClose: () => void }) {
  const router = useRouter();
  const client = useQueryClient();
  const me = useSession((state) => state.me);
  const refreshSession = useSession((state) => state.refresh);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null);

  const price = pack.priceCoins ?? 0;
  const coins = me?.coins ?? 0;
  const isPlus = Boolean(me?.isPlus);
  const owned = pack.owned || said?.ok;
  const short = price > 0 && !owned && coins < price;

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
      style={{ marginTop: 14, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, backgroundColor: color, opacity: busy ? 0.7 : 1 }}
    >
      {busy ? <Spinner size="small" color={ink} /> : null}
      <Text style={{ color: ink, fontSize: 14.5, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );

  const shown = pack.stickers.slice(0, 8);

  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(14,26,36,.55)",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 28,
      }}
    >
      <Pressable accessibilityLabel="إغلاق" onPress={onClose} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
      <View style={{ width: "100%", maxWidth: 340, borderRadius: 24, backgroundColor: colors.card, overflow: "hidden" }}>
        <View style={{ backgroundColor: colors.paper, padding: 18, flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 }}>
          {shown.map((one) => (
            <MediaImage key={one.id} mediaId={one.mediaId} resizeMode="contain" style={{ width: 64, height: 64 }} />
          ))}
        </View>
        <View style={{ padding: 22, gap: 6 }}>
          <Text style={{ color: colors.clayInk, fontSize: 11.5, fontWeight: "700" }}>ملصقات جديدة</Text>
          <Text style={{ color: colors.ink, fontSize: 19, fontWeight: "700", writingDirection: "auto" }}>{pack.name}</Text>
          <Text style={{ color: colors.muted, fontSize: 12.5 }}>
            {ar(pack.stickers.length)} ملصق للتعليقات والمحادثات
          </Text>
          {price > 0 ? (
            <Text style={{ color: colors.clayInk, fontSize: 13.5, fontWeight: "700", marginTop: 2 }}>
              {coinText(price)} · تشتريها مرّة وتبقى لك
            </Text>
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
              <SparkIcon size={14} color={colors.gold} />
              <Text style={{ color: colors.goldInk, fontSize: 13.5, fontWeight: "700" }}>حصرياً لمشتركي آثار+</Text>
            </View>
          )}

          {owned ? (
            <View style={{ marginTop: 14, height: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <CheckIcon size={16} color={colors.clay} />
              <Text style={{ color: colors.clayInk, fontSize: 14, fontWeight: "700" }}>
                {said?.ok ? said.text : "عندك — تجدها بجانب الإرسال"}
              </Text>
            </View>
          ) : price === 0 ? (
            isPlus ? (
              <Text style={{ marginTop: 14, color: colors.goldInk, fontSize: 13.5, fontWeight: "600", textAlign: "center" }}>
                مفعّلة باشتراكك — تجدها بجانب الإرسال
              </Text>
            ) : (
              button("اشترك في آثار+", () => leave("/subscribe"), colors.gold, "#fff")
            )
          ) : short ? (
            <>
              <Text style={{ marginTop: 10, color: colors.faint, fontSize: 12.5, textAlign: "center" }}>
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
          <Pressable onPress={onClose} style={{ height: 44, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: colors.muted, fontSize: 13.5, fontWeight: "600" }}>إغلاق</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
