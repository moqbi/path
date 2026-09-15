import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ScreenHeader } from "../components/screen-header";
import { BookIcon, CameraIcon, MicIcon, SparkIcon, StoreIcon } from "../components/icons";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { colors } from "../theme/tokens";

const PERKS = [
  {
    title: "تفاعل بأي إيموجي",
    body: "الخمسة الأساسية تبقى للجميع · لك كل كيبوردك",
    icon: <Text style={{ fontSize: 17 }}>😊</Text>,
  },
  {
    title: "أرشيف بلا نهاية",
    body: "المجاني يحفظ ٦ أشهر · أنت تحفظ كل شي وتصدّره",
    icon: <BookIcon size={18} color={colors.gold} />,
  },
  {
    title: "دوائر منفصلة",
    body: "العائلة، الشلة، الشغل — كل وحدة بخصوصيتها",
    icon: <SparkIcon size={18} color={colors.gold} />,
  },
  {
    title: "رسالة صوتية دقيقتان",
    body: "٢٠ ثانية للجميع · لك ١٢٠ ثانية في كل محادثة",
    icon: <MicIcon size={18} color={colors.gold} />,
  },
  {
    title: "صورة عرض متحركة",
    body: "GIF أو WebP متحركة · من ١٢٠×١٢٠ إلى ١٠٢٤×١٠٢٤ · حتى ٣ ميغابايت",
    icon: <CameraIcon size={18} color={colors.gold} />,
  },
  {
    title: "٣٠ ر.س رصيد شهري في المتجر",
    body: "وخصم ٢٠٪ على كل شي · إطارات حصرية",
    icon: <StoreIcon size={18} color={colors.gold} />,
  },
];

/**
 * أثر+.
 *
 * الوضع الفاتح كبقية التطبيق: صفحةٌ داكنة وحدها تُقرأ شاشةً غريبة عن
 * التطبيق الذي جاءت منه.
 */
export default function Subscribe() {
  const { me, refresh } = useSession();
  const router = useRouter();
  const client = useQueryClient();

  const act = useMutation({
    mutationFn: (plan: "MONTHLY" | "YEARLY" | null) =>
      plan
        ? api("/v1/plus", { method: "POST", body: JSON.stringify({ plan }) })
        : api("/v1/plus", { method: "DELETE" }),
    onSuccess: async () => {
      await refresh();
      void client.invalidateQueries({ queryKey: ["store"] });
      void client.invalidateQueries({ queryKey: ["me"] });
      router.back();
    },
  });

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScreenHeader title="أثر+" back="/" />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 30 }}>
        <View style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.goldSoft, marginBottom: 16 }}>
          <SparkIcon size={14} color={colors.gold} />
          <Text style={{ color: colors.goldInk, fontSize: 12, fontWeight: "700" }}>ATHR+</Text>
        </View>

        <Text style={{ color: colors.ink, fontSize: 30, fontWeight: "700", lineHeight: 42, marginBottom: 10 }}>
          أصدقاؤك يبقون ١٥٠{"\n"}
          <Text style={{ color: colors.clayInk }}>وكل شي غيرها يكبر</Text>
        </Text>
        <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 26, marginBottom: 22 }}>
          لا نبيع أصدقاء إضافيين. نبيع ذاكرة أطول وتعبيراً أوسع.
        </Text>

        {PERKS.map((perk) => (
          <View key={perk.title} style={{ flexDirection: "row", gap: 14, marginBottom: 18 }}>
            <View style={{ width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.goldSoft }}>
              {perk.icon}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "600", marginBottom: 2 }}>
                {perk.title}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 21 }}>{perk.body}</Text>
            </View>
          </View>
        ))}

        {me?.isPlus ? (
          <View style={{ paddingTop: 16 }}>
            <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 12 }}>
              أنت مشترك في أثر+ حالياً.
            </Text>
            <Pressable
              onPress={() => act.mutate(null)}
              disabled={act.isPending}
              style={{ height: 50, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line }}
            >
              {act.isPending ? (
                <ActivityIndicator color={colors.muted} />
              ) : (
                <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "600" }}>إلغاء الاشتراك</Text>
              )}
            </Pressable>
          </View>
        ) : (
          <View style={{ flexDirection: "row", gap: 10, paddingTop: 8 }}>
            <Pressable
              onPress={() => act.mutate("MONTHLY")}
              disabled={act.isPending}
              style={{ flex: 1, borderRadius: 16, borderWidth: 1, borderColor: colors.line, paddingVertical: 16, paddingHorizontal: 12, alignItems: "center" }}
            >
              <Text style={{ color: colors.muted, fontSize: 11.5, marginBottom: 6 }}>شهري</Text>
              <Text style={{ color: colors.ink, fontSize: 26, fontWeight: "700" }}>٢٥</Text>
              <Text style={{ color: colors.faint, fontSize: 11 }}>ريال / شهر</Text>
            </Pressable>

            <Pressable
              onPress={() => act.mutate("YEARLY")}
              disabled={act.isPending}
              style={{ flex: 1, borderRadius: 16, borderWidth: 1.5, borderColor: colors.gold, backgroundColor: colors.goldSoft, paddingVertical: 16, paddingHorizontal: 12, alignItems: "center" }}
            >
              <View style={{ position: "absolute", top: -10, alignSelf: "center", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: colors.gold }}>
                <Text style={{ color: colors.onBrand, fontSize: 9.5, fontWeight: "700" }}>وفّر ٣٣٪</Text>
              </View>
              <Text style={{ color: colors.goldInk, fontSize: 11.5, marginBottom: 6 }}>سنوي</Text>
              <Text style={{ color: colors.ink, fontSize: 26, fontWeight: "700" }}>١٩٩</Text>
              <Text style={{ color: colors.faint, fontSize: 11 }}>ريال / سنة</Text>
            </Pressable>
          </View>
        )}

        <Text style={{ color: colors.faint, fontSize: 10.5, lineHeight: 22, textAlign: "center", paddingTop: 20 }}>
          في النسخة الحقيقية يمر الدفع عبر متجر آبل أو جوجل إلزامياً · هنا تفعيل تجريبي فقط
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
