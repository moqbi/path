import { useEffect, useState } from "react";
import { AppState, Linking, Platform, Pressable, View } from "react-native";
import Constants from "expo-constants";
import { Text } from "./type";
import { api } from "../lib/api";
import { getItem, setItem } from "../lib/store";
import { colors } from "../theme/tokens";

type Version = { ios: { latest: string | null; url: string | null; min: string | null } };

/** «٠٫١٫١٠» بعد «٠٫١٫٩» — أرقامٌ لا نصوص. نسخةُ `newer` في الخادم. */
function newer(a: string, b: string): boolean {
  const left = a.split(".").map(Number);
  const right = b.split(".").map(Number);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const x = left[i] ?? 0;
    const y = right[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
}

const LATER = "athr.update.later";
/** «لاحقاً» تُسكت النافذةَ ثلاثة أيام لهذا الإصدار وحده. */
const QUIET_MS = 3 * 86_400_000;

/**
 * نافذةُ التحديث (القاعدة ٤٣٢) — **بقرار المالك**: نسخةٌ أحدثُ في المتجر تُقال لصاحب
 * القديمة. والخادمُ يسأل المتجرَ لا الجهاز، ويقول أدنى إصدارٍ يُقبل (`MIN_IOS_VERSION`):
 * ما دونه نافذةٌ لا تُغلق — تحديثٌ لا مفرّ منه، لما يكسره الخادمُ في نسخةٍ قديمة.
 * وما فوقه يُقال مرّةً ويُسكَت بـ«لاحقاً» ثلاثة أيام. وتحديثاتُ OTA لا تمرّ هنا: تلك
 * تُطبَّق وحدها (القاعدة ٢٧٥). **طبقةٌ في الجذر لا `Modal`** (القاعدة ١٧٣).
 */
export function UpdatePrompt() {
  const [offer, setOffer] = useState<{ url: string; latest: string; forced: boolean } | null>(null);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    const mine = Constants.nativeAppVersion;
    if (!mine) return;
    let asked = 0;
    const check = async () => {
      if (Date.now() - asked < 3_600_000) return;
      asked = Date.now();
      try {
        const { ios } = await api<Version>("/v1/site/app-version");
        if (!ios.url) return;
        const forced = Boolean(ios.min && newer(ios.min, mine));
        if (forced) return setOffer({ url: ios.url, latest: ios.latest ?? ios.min!, forced: true });
        if (!ios.latest || !newer(ios.latest, mine)) return setOffer(null);
        const later = (await getItem(LATER).catch(() => null)) ?? "";
        const [version, at] = later.split(":");
        if (version === ios.latest && Date.now() - Number(at) < QUIET_MS) return;
        setOffer({ url: ios.url, latest: ios.latest, forced: false });
      } catch {
        /* لا يقين — لا نافذة */
      }
    };
    void check();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void check();
    });
    return () => sub.remove();
  }, []);

  if (!offer) return null;
  const later = () => {
    void setItem(LATER, `${offer.latest}:${Date.now()}`).catch(() => undefined);
    setOffer(null);
  };

  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 70,
        elevation: 70,
        backgroundColor: "rgba(14,26,36,.6)",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 28,
      }}
    >
      {offer.forced ? null : <Pressable accessibilityLabel="لاحقاً" onPress={later} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />}
      <View style={{ width: "100%", maxWidth: 340, borderRadius: 24, backgroundColor: colors.card, padding: 22, gap: 8 }}>
        <Text style={{ color: colors.clayInk, fontSize: 11.5, fontWeight: "700" }}>من آثار</Text>
        <Text style={{ color: colors.ink, fontSize: 19, fontWeight: "700" }}>
          {offer.forced ? "حدّث التطبيق لتكمل" : "نسخة جديدة متاحة"}
        </Text>
        <Text style={{ color: colors.ink2, fontSize: 14, lineHeight: 24 }}>
          {offer.forced
            ? `نسختك قديمة ولا تعمل مع آخر تحديثات آثار. حدّثها إلى ${offer.latest} من المتجر.`
            : `الإصدار ${offer.latest} في المتجر — فيه ميزات وإصلاحات جديدة.`}
        </Text>
        <Pressable
          onPress={() => void Linking.openURL(offer.url)}
          style={{ marginTop: 8, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.clay }}
        >
          <Text style={{ color: colors.onBrand, fontSize: 15, fontWeight: "700" }}>حدّث الآن</Text>
        </Pressable>
        {offer.forced ? null : (
          <Pressable onPress={later} style={{ height: 40, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: colors.muted, fontSize: 13.5, fontWeight: "600" }}>لاحقاً</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
