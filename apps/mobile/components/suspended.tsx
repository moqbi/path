import { View, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "./type";
import { AthrMark } from "./brand";
import { useSession } from "../lib/session";
import { colors } from "../theme/tokens";

/**
 * شاشة الإيقاف المؤقّت.
 *
 * تحلّ محلّ التطبيق كلّه ما دام الإيقاف قائماً: من مُنع من الكتابة يبقى
 * له أن يقرأ، لكنّ تطبيقاً يعمل نصفه ويردّ الخادمُ فيه خطأً مع كل ضغطة
 * يُقرأ عطلاً لا عقوبة — والوضوح أرحم.
 *
 * وثلاثةٌ تُقال: أنّه موقوف، ومتى ينتهي، ولماذا. إيقافٌ بلا مدّةٍ يُقرأ
 * حذفاً للحساب، وبلا سببٍ يُقرأ خطأً في التطبيق فيُراسل الدعم عبثاً.
 */
export function Suspended({ until, reason }: { until: string; reason: string | null }) {
  const signOut = useSession((state) => state.signOut);

  /*
    تاريخٌ يُقرأ لا طابعُ ISO، وميلاديٌّ بالعربية كبقية التطبيق:
    `ar-SA` وحدها تُخرجه هجرياً فتختلف الشاشة عن كل تاريخٍ آخر فيه.
  */
  const when = new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(until));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 28, direction: "rtl" }}>
        <View style={{ alignItems: "center" }}>
          <AthrMark size={64} />

          <View
            style={{
              marginTop: 26,
              paddingHorizontal: 14,
              paddingVertical: 7,
              borderRadius: 999,
              backgroundColor: colors.liveSoft,
            }}
          >
            <Text style={{ color: colors.live, fontSize: 12.5, fontWeight: "700" }}>
              حسابك موقوف مؤقّتاً
            </Text>
          </View>

          <Text
            face="display"
            style={{ marginTop: 18, color: colors.ink, fontSize: 21, fontWeight: "700", textAlign: "center" }}
          >
            يعود حسابك
          </Text>
          <Text
            style={{ marginTop: 6, color: colors.ink, fontSize: 15.5, fontWeight: "600", textAlign: "center", lineHeight: 26 }}
          >
            {when}
          </Text>

          {reason ? (
            <View
              style={{
                marginTop: 20,
                width: "100%",
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.line,
                backgroundColor: colors.card,
                padding: 14,
              }}
            >
              <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "700", marginBottom: 4 }}>
                السبب
              </Text>
              <Text style={{ color: colors.ink2, fontSize: 13.5, lineHeight: 24 }}>{reason}</Text>
            </View>
          ) : null}

          <Text
            style={{ marginTop: 20, color: colors.muted, fontSize: 12, textAlign: "center", lineHeight: 22 }}
          >
            لحظاتك وأصدقاؤك ورصيدك كما هي — لا يُحذف شيء. ويعود كلّ شيء
            في وقته من نفسه.
          </Text>

          <Pressable
            onPress={() => void signOut()}
            style={{
              marginTop: 26,
              height: 46,
              paddingHorizontal: 22,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.line,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: colors.ink2, fontSize: 13.5, fontWeight: "600" }}>خروج</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
