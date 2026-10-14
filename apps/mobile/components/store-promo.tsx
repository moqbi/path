import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { Text } from "./type";
import { MediaImage } from "./media-image";
import { Preview } from "./store-grid";
import { useTourOn } from "./tour";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { coinText } from "../lib/format";
import type { StoreItem } from "../lib/queries";
import { colors } from "../theme/tokens";

type Promo = StoreItem & { promoText: string | null; promoMediaId?: string | null };

/**
 * بطاقةُ إعلان الصنف عند فتح التطبيق (القاعدة ٢٦٧) — **بقرار المالك**.
 *
 * يفعّلها المشرفُ من صفحة الصنف في اللوحة، فتظهر لكل حسابٍ مرّةً في وسط
 * الشاشة: الصورة، والاسم، وسطرُ المشرف، والسعر، وبابٌ إلى الصنف في المتجر،
 * و«إغلاق». والخادمُ يحفظ ما رآه (`promoSeenAt`) فلا تعود على جهازٍ آخر.
 *
 * **طبقةٌ في الجذر لا `Modal`** (القاعدة ١٧٣): نافذةُ إذن التنبيهات تُطلب مع
 * الدخول، وآبل تعرض نافذةً واحدة فوق الشاشة فتسقط الثانية بصمت. وتنتظر
 * الجولةَ حتى تنتهي — شاشتان تتكلّمان معاً لا تُقرأ أيٌّ منهما.
 */
export function StorePromo() {
  const me = useSession((s) => s.me);
  const touring = useTourOn();
  const router = useRouter();
  const [item, setItem] = useState<Promo | null>(null);

  useEffect(() => {
    if (!me) return;
    let live = true;
    void api<{ item: Promo | null }>("/v1/store/promo")
      .then((row) => {
        if (live && row.item) setItem(row.item);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [me?.id]);

  if (!item || touring) return null;

  const done = () => {
    setItem(null);
    void api("/v1/store/promo/seen", { method: "POST" }).catch(() => {});
  };
  const open = () => {
    done();
    router.push(`/store?item=${item.id}` as never);
  };
  const cheapest = item.plans?.length ? Math.min(...item.plans.map((one) => one.priceCoins)) : item.priceCoins;

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
      <Pressable accessibilityLabel="إغلاق" onPress={done} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
      <View style={{ width: "100%", maxWidth: 340, borderRadius: 24, backgroundColor: colors.card, overflow: "hidden" }}>
        {/* صورةُ الإعلان أوّلاً بملء مكانها (القاعدة ٢٧٢)، وإلّا صورةُ الصنف. */}
        <View style={{ height: item.promoMediaId ? 260 : 220, alignItems: "center", justifyContent: "center", backgroundColor: colors.paper, padding: item.promoMediaId ? 0 : 20 }}>
          {item.promoMediaId ? (
            <MediaImage mediaId={item.promoMediaId} style={{ width: "100%", height: "100%" }} resizeMode="contain" />
          ) : item.mediaId ? (
            <MediaImage
              mediaId={item.mediaId}
              style={{ width: "100%", height: "100%" }}
              resizeMode={item.kind === "THEME" || item.kind === "BACKGROUND" ? "cover" : "contain"}
            />
          ) : (
            <View style={{ width: 140 }}>
              <Preview item={item} />
            </View>
          )}
        </View>
        <View style={{ padding: 22, gap: 6 }}>
          <Text style={{ color: colors.clayInk, fontSize: 11.5, fontWeight: "700" }}>جديد في المتجر</Text>
          <Text style={{ color: colors.ink, fontSize: 19, fontWeight: "700", writingDirection: "auto" }}>{item.name}</Text>
          {item.promoText ? (
            <Text style={{ color: colors.ink2, fontSize: 13.5, lineHeight: 23 }}>{item.promoText}</Text>
          ) : null}
          <Text style={{ color: colors.muted, fontSize: 12.5, marginTop: 2 }}>
            {item.plans?.length ? `من ${coinText(cheapest)}` : coinText(cheapest)}
            {item.plusOnly ? " · لمشتركي آثار+" : ""}
          </Text>
          <Pressable
            onPress={open}
            style={{ marginTop: 14, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.clay }}
          >
            <Text style={{ color: colors.onBrand, fontSize: 14.5, fontWeight: "700" }}>اعرضه في المتجر</Text>
          </Pressable>
          <Pressable onPress={done} style={{ height: 44, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: colors.muted, fontSize: 13.5, fontWeight: "600" }}>إغلاق</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
