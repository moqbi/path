import { useEffect, useState } from "react";
import { Linking, Modal, Platform, Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { Text } from "./type";
import { SparkIcon } from "./icons";
import { getItem, setItem } from "../lib/store";
import { useSession } from "../lib/session";
import { colors } from "../theme/tokens";

const SEEN = "athr.plusEnded";

/** صفحةُ الاشتراكات في متجر الجهاز — منها يُفعَّل التجديد التلقائيّ. */
const MANAGE =
  Platform.OS === "ios"
    ? "https://apps.apple.com/account/subscriptions"
    : "https://play.google.com/store/account/subscriptions";

/**
 * «انتهى اشتراكك في آثار+» — **بقرار المالك**.
 *
 * تُعرض مرّةً لكل انتهاء: الخادمُ يكتب `plusEndedAt` حين يُنهي الاشتراك
 * (`services/plus.ts`)، والجهازُ يحفظ آخرَ ما عرضه منه — فلا تُعاد مع كل
 * فتح، وانتهاءٌ ثانٍ بعد عودةٍ يُقال من جديد.
 *
 * وتقول ما ذهب لا «انتهى» وحدها: من وجد صورته ثابتةً وإطاره منزوعاً بلا
 * خبرٍ يظنّ التطبيق تعطّل. وبابان للعودة: التجديدُ من شاشة الاشتراك،
 * والتجديدُ التلقائيّ من صفحة اشتراكات المتجر — ذاك لا يُفعَّل من داخلنا.
 */
export function PlusEnded() {
  const me = useSession((s) => s.me);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ended = me && !me.isPlus ? (me.plusEndedAt ?? null) : null;

  useEffect(() => {
    if (!ended) return;
    let live = true;
    void getItem(SEEN)
      .catch(() => null)
      .then((seen) => {
        if (live && seen !== ended) setOpen(true);
      });
    return () => {
      live = false;
    };
  }, [ended]);

  if (!open || !ended) return null;

  const close = () => {
    setOpen(false);
    void setItem(SEEN, ended).catch(() => {});
  };

  return (
    <Modal transparent animationType="fade" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: "rgba(14,26,36,.55)", alignItems: "center", justifyContent: "center", paddingHorizontal: 28 }}>
        <View style={{ width: "100%", maxWidth: 340, borderRadius: 24, backgroundColor: colors.card, padding: 24 }}>
          <View style={{ alignSelf: "center", width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", backgroundColor: colors.goldSoft }}>
            <SparkIcon size={24} color={colors.goldInk} />
          </View>
          <Text style={{ color: colors.ink, fontSize: 17, fontWeight: "700", textAlign: "center", marginTop: 12 }}>
            انتهى اشتراكك في آثار+
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12.5, lineHeight: 22, textAlign: "center", marginTop: 6 }}>
            صارت صورتك المتحرّكة صورةً ثابتة، ونُزع ما كان لمشتركي آثار+ وحدهم —
            وهو باقٍ في إكسسواراتك يعود معك متى جدّدت.
          </Text>

          <Pressable
            onPress={() => {
              close();
              router.push("/subscribe" as never);
            }}
            style={{ height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.clay, marginTop: 18 }}
          >
            <Text style={{ color: colors.onBrand, fontSize: 14, fontWeight: "700" }}>جدّد الاشتراك</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              close();
              void Linking.openURL(MANAGE);
            }}
            style={{ height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line, marginTop: 8 }}
          >
            <Text style={{ color: colors.ink2, fontSize: 13.5, fontWeight: "600" }}>فعّل التجديد التلقائيّ</Text>
          </Pressable>
          <Pressable onPress={close} style={{ height: 42, alignItems: "center", justifyContent: "center", marginTop: 4 }}>
            <Text style={{ color: colors.muted, fontSize: 13 }}>لاحقاً</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
