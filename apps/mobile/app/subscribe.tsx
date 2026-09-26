import { useEffect, useState } from "react";
import { View, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { Text } from "../components/type";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ScreenHeader } from "../components/screen-header";
import { BookIcon, CameraIcon, CircleIcon, MicIcon, SparkIcon, StoreIcon, WithIcon } from "../components/icons";
import { TagPill } from "../components/name-tag";
import { SUPPORTER_TAG } from "@athar/shared";
import { api } from "../lib/api";
import { billingReady, buy, openManage, plans, restore, testStore, type Plan } from "../lib/billing";
import { useSession } from "../lib/session";
import { colors } from "../theme/tokens";

const PERKS = [
  /*
    ما يُرى بجانب الاسم أوّلاً: النجمةُ توثيقاً، ووسمُ «داعم» — والرسمُ هو
    الشيءُ نفسه كما يظهر في الخطّ الزمنيّ لا أيقونةٌ عنه.
  */
  {
    title: "نجمة التوثيق",
    body: "بجانب اسمك في كل مكان — في اللحظات والتعليقات والأصدقاء",
    icon: <SparkIcon size={18} color={colors.clay} />,
  },
  {
    title: "وسم «داعم»",
    body: "يظهر بجانب اسمك ما دام اشتراكك قائماً",
    icon: <TagPill tag={SUPPORTER_TAG} size={10} />,
  },
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
    // **بقرار المالك**: الأثرُ المشترك من مزايا الاشتراك.
    title: "آثارنا",
    body: "كلُّ لحظةٍ جمعتك بصديقٍ بالإشارة «مع» — في خطٍّ واحد لكما",
    icon: <WithIcon size={18} color={colors.gold} />,
  },
  {
    title: "دوائر منفصلة",
    body: "العائلة، الشلة، الشغل — كل وحدة بخصوصيتها",
    // النجمةُ صارت للتوثيق، فللدوائر رسمُها.
    icon: <CircleIcon size={18} color={colors.gold} />,
  },
  {
    title: "رسالة صوتية دقيقتان",
    body: "٢٠ ثانية للجميع · لك ١٢٠ ثانية في كل محادثة",
    icon: <MicIcon size={18} color={colors.gold} />,
  },
  {
    title: "صورة عرض متحركة",
    body: "GIF أو WebP متحركة · من ١٢٠×١٢٠ إلى ٣٢٠×٣٢٠ · حتى ٣ ميغابايت",
    icon: <CameraIcon size={18} color={colors.gold} />,
  },
  {
    title: "١٠٠٠ نقطة شهرياً في المتجر",
    body: "وخصم ٢٠٪ على كل شي · إطارات حصرية",
    icon: <StoreIcon size={18} color={colors.gold} />,
  },
];

/**
 * آثار+.
 *
 * الوضع الفاتح كبقية التطبيق: صفحةٌ داكنة وحدها تُقرأ شاشةً غريبة عن
 * التطبيق الذي جاءت منه.
 */
/**
 * الشراء يمرّ بالمتجر، والتفعيل يأتي من الخادم.
 *
 * فبعد أن يقول المتجر «تمّ» ننتظر حدث RevenueCat يصل إلى خادمنا —
 * ثوانٍ في العادة. ولذلك نسأل عن الحساب بضع مرّاتٍ متباعدة بدل أن
 * نُصدّق الجهاز ونفتح المزايا بأنفسنا.
 */
async function waitForPlus(ask: () => Promise<void>, isPlus: () => boolean) {
  for (const wait of [0, 1500, 3000, 5000]) {
    if (wait) await new Promise((done) => setTimeout(done, wait));
    await ask();
    if (isPlus()) return true;
  }
  return false;
}

export default function Subscribe() {
  const { me, refresh } = useSession();
  const router = useRouter();
  const client = useQueryClient();

  const [offers, setOffers] = useState<Plan[] | null>(null);
  const [note, setNote] = useState<string | null>(null);

  // باقاتُ المتجر بأسعاره — تُقرأ مرّةً عند فتح الشاشة.
  useEffect(() => {
    if (!billingReady()) return;
    plans()
      .then(setOffers)
      .catch(() => setNote("تعذّر جلب الباقات من المتجر"));
  }, []);

  const done = async () => {
    await refresh();
    void client.invalidateQueries({ queryKey: ["store"] });
    void client.invalidateQueries({ queryKey: ["me"] });
  };

  const act = useMutation({
    mutationFn: async (planId: string) => {
      const result = await buy(planId);
      if (result.cancelled) return;
      if (!result.active) throw new Error("لم يكتمل الشراء");
      const live = await waitForPlus(done, () => Boolean(useSession.getState().me?.isPlus));
      if (!live) {
        setNote("تمّ الشراء — التفعيل خلال دقيقة. اسحب للتحديث إن تأخّر.");
        return;
      }
      router.back();
    },
    onError: (problem) => setNote(problem instanceof Error ? problem.message : "تعذّر الشراء"),
  });

  const recover = useMutation({
    mutationFn: async () => {
      const active = await restore();
      await done();
      setNote(active ? "استُعيد اشتراكك" : "لا مشترياتٍ لهذا الحساب");
    },
  });

  /* تفعيلٌ بلا دفع — للتجربة وحدها، ومغلقٌ على الخادم ما لم يُفتح هناك. */
  const fake = useMutation({
    mutationFn: (plan: "MONTHLY" | "YEARLY") =>
      api("/v1/plus", { method: "POST", body: JSON.stringify({ plan }) }),
    onSuccess: async () => {
      await done();
      router.back();
    },
    onError: (problem) => setNote(problem instanceof Error ? problem.message : "تعذّر التفعيل"),
  });

  return (
    <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScreenHeader title="آثار+" back="/" />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 30 }}>
        <View style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.goldSoft, marginBottom: 16 }}>
          <SparkIcon size={14} color={colors.gold} />
          <Text face="latin" style={{ color: colors.goldInk, fontSize: 12, fontWeight: "700" }}>ATHAR+</Text>
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
          <View style={{ paddingTop: 16, gap: 10 }}>
            <Text style={{ color: colors.muted, fontSize: 13 }}>أنت مشترك في آثار+ حالياً.</Text>
            {/* الإلغاء يجري في المتجر — لا آبل ولا جوجل تسمح به من داخل التطبيق. */}
            <Pressable
              onPress={() => void openManage()}
              style={{ height: 50, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line }}
            >
              <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "600" }}>
                إدارة الاشتراك في المتجر
              </Text>
            </Pressable>
          </View>
        ) : offers && offers.length > 0 ? (
          <View style={{ gap: 12, paddingTop: 8 }}>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {offers.map((offer) => (
                <Pressable
                  key={offer.id}
                  onPress={() => act.mutate(offer.id)}
                  disabled={act.isPending}
                  style={{
                    flex: 1,
                    borderRadius: 16,
                    borderWidth: offer.yearly ? 1.5 : 1,
                    borderColor: offer.yearly ? colors.gold : colors.line,
                    backgroundColor: offer.yearly ? colors.goldSoft : "transparent",
                    paddingVertical: 16,
                    paddingHorizontal: 12,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: offer.yearly ? colors.goldInk : colors.muted, fontSize: 11.5, marginBottom: 6 }}>
                    {offer.yearly ? "سنوي" : "شهري"}
                  </Text>
                  {/* السعر كما يقوله المتجر: بعملة المشتري وبضريبة بلده. */}
                  {/* `writingDirection` بدل `dir`: النصّ سعرٌ قد يبدأ برمز عملة لاتيني. */}
                  <Text style={{ color: colors.ink, fontSize: 22, fontWeight: "700", writingDirection: "auto" }}>
                    {offer.price}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* المتجر التجريبي يُقال صراحةً: شراءٌ وهميّ لا يُحسب. */}
            {testStore() ? (
              <Text style={{ color: colors.clayInk, fontSize: 11, textAlign: "center" }}>
                متجرٌ تجريبيّ — الشراء هنا وهميّ ولا يُخصم منه شيء
              </Text>
            ) : null}

            <Pressable
              onPress={() => recover.mutate()}
              disabled={recover.isPending}
              style={{ height: 44, alignItems: "center", justifyContent: "center" }}
            >
              {recover.isPending ? (
                <ActivityIndicator color={colors.muted} />
              ) : (
                <Text style={{ color: colors.clayInk, fontSize: 12.5, fontWeight: "600" }}>
                  استعادة المشتريات
                </Text>
              )}
            </Pressable>
          </View>
        ) : billingReady() ? (
          <View style={{ paddingTop: 16, alignItems: "center" }}>
            <ActivityIndicator color={colors.gold} />
          </View>
        ) : (
          /*
            بلا مفاتيح المتجر (معاينة الويب، أو نسخةٌ لم تُربط بعد):
            لا نرسم أسعاراً كاذبة — وزرّ التجربة يبقى، والخادم يردّه ما
            لم يُفتح هناك صراحةً.
          */
          <View style={{ paddingTop: 12, gap: 10 }}>
            <Text style={{ color: colors.muted, fontSize: 12.5, lineHeight: 24 }}>
              الاشتراك يتمّ من داخل التطبيق على الجوّال عبر App Store أو Google Play.
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable
                onPress={() => fake.mutate("MONTHLY")}
                disabled={fake.isPending}
                style={{ flex: 1, borderRadius: 16, borderWidth: 1, borderColor: colors.line, paddingVertical: 14, alignItems: "center" }}
              >
                <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600" }}>تجربة: شهري</Text>
              </Pressable>
              <Pressable
                onPress={() => fake.mutate("YEARLY")}
                disabled={fake.isPending}
                style={{ flex: 1, borderRadius: 16, borderWidth: 1, borderColor: colors.line, paddingVertical: 14, alignItems: "center" }}
              >
                <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600" }}>تجربة: سنوي</Text>
              </Pressable>
            </View>
          </View>
        )}

        {note ? (
          <Text style={{ color: colors.clayInk, fontSize: 12, lineHeight: 24, textAlign: "center", paddingTop: 14 }}>
            {note}
          </Text>
        ) : null}

        <Text style={{ color: colors.faint, fontSize: 10.5, lineHeight: 22, textAlign: "center", paddingTop: 20 }}>
          يتجدّد تلقائياً حتى تُلغيه من متجرك · تُخصم القيمة من حساب المتجر
        </Text>

      </ScrollView>
    </SafeAreaView>
  );
}
