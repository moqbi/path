import { useEffect } from "react";
import { I18nManager, Platform, View, ActivityIndicator } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import {
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_600SemiBold,
  IBMPlexSansArabic_700Bold,
} from "@expo-google-fonts/ibm-plex-sans-arabic";
import { Tajawal_400Regular, Tajawal_700Bold } from "@expo-google-fonts/tajawal";
import { Montserrat_500Medium, Montserrat_700Bold } from "@expo-google-fonts/montserrat";
import { useSession } from "../lib/session";
import { primeAccess } from "../lib/api";
import { markFirstSeen } from "../lib/rate";
import { Suspended } from "../components/suspended";
import { colors } from "../theme/tokens";

/**
 * العربية من اليمين — قراراً لا إعداداً، وفي البيئات الثلاث معاً.
 *
 * آثار عربيّ الواجهة كلها، فالاتجاه يُفرض ولا يُترك للغة الجهاز: من
 * جهازُه بالإنجليزية يفتح تطبيقاً عربياً، لا تطبيقاً عربياً مقلوباً.
 *
 * وثلاثة أبواب لا باب واحد:
 * - `I18nManager` للجهاز، ويحتاج إعادة تشغيلٍ أولى لتُقلب الشاشة.
 * - `direction: "rtl"` على جذر الشجرة: يقلبها فوراً بلا انتظار إعادة
 *   التشغيل، وهو ما يقرؤه Yoga في الترتيب.
 * - `dir="rtl"` على المستند في معاينة الويب: `I18nManager` هناك قشرةٌ
 *   فارغة (`isRTL` ثابتٌ على false في react-native-web)، فبدونها تُرسم
 *   المعاينة يساراً-يميناً بينما الجهاز يمينٌ-يسار — وهذا ما كان يجعل
 *   كل صفٍّ يُكتب معكوساً (`row-reverse`) ليبدو صحيحاً في المعاينة
 *   وينقلب على الجهاز.
 * وشريط التبويبات يتبع هذه الأبواب نفسها: أصنافه في حاويةٍ داخلية
 * (`flexDirection: row`) لا نملك نمطها، فلا يُقلب بنمطٍ نمرّره — يُقلب
 * باتجاه المستند على الويب وبـ`I18nManager` على الجهاز.
 *
 * **و`left`/`right` تبقى يساراً ويميناً** (`swapLeftAndRightInRTL(false)`):
 * React Native يقلب الاثنين — ومعهما `textAlign` — من نفسه حين يكون
 * الاتجاه من اليمين، وهذا قلبٌ ثانٍ فوق قلب Yoga. والشجرة كلّها مكتوبةٌ
 * على مقاس الويب، حيث `right: 20` في نمطٍ على جذرٍ `rtl` يمينٌ حقيقيّ لا
 * يُقلب. فبالقلب التلقائي طار زرّ النشر إلى اليسار وطارت أصنافه معه خارج
 * الشاشة (فلا يظهر إلا واحد)، وطار بابا العدسات، وانزاح نصّ «تعديل
 * الملف» و«إكسسواراتي» و«الخصوصية» إلى اليسار.
 *
 * وإطفاؤه هنا لا في كل ملفّ: البديل كتابة `start`/`end` في ستّين موضعاً،
 * وهي لا تعني شيئاً في معاينة الويب فينفرط ما بين البيئتين.
 */
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);
// `react-native-web` قشرةٌ ناقصة: لا `swapLeftAndRightInRTL` فيها أصلاً،
// ونداؤُها هناك يرمي قبل أن يُضبط اتجاه المستند في السطر التالي — فتسقط
// المعاينة كلّها. والقلب لا يوجد على الويب فلا شيء يُطفأ.
I18nManager.swapLeftAndRightInRTL?.(false);

if (Platform.OS === "web" && typeof document !== "undefined") {
  document.documentElement.dir = "rtl";
  document.documentElement.lang = "ar";
}

const client = new QueryClient({
  defaultOptions: {
    queries: {
      // شبكةُ الجوّال تتقطّع: محاولةٌ واحدة إضافية تكفي، والمزيد يُبقي
      // الشاشة دوّارةً بلا خبر.
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

function Gate() {
  const { me, ready, restore } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    void primeAccess().then(restore);
    // ختمُ أوّل فتحٍ لطلب التقييم: يُكتب مرّةً ولا يزيد (`lib/rate.ts`).
    void markFirstSeen();
  }, [restore]);

  useEffect(() => {
    if (!ready) return;
    const inApp = segments[0] === "(tabs)" || segments[0] === "m" || segments[0] === "u";
    if (!me && inApp) router.replace("/login");
    if (me && segments[0] === "login") router.replace("/");
  }, [me, ready, segments, router]);

  /*
    الموقوف مؤقّتاً يرى سبب وقفه لا تطبيقاً يردّ خطأً مع كل ضغطة.

    والفحص هنا لا في كل شاشة: الحقل يأتي مع `/v1/me` أصلاً، فلا
    استعلامَ زائد — وشرطٌ واحد في الجذر أوثق من ثلاثين شرطاً موزّعة
    يُنسى أحدها.
  */
  const held =
    me?.suspendedUntil && new Date(me.suspendedUntil) > new Date() ? me.suspendedUntil : null;
  if (held) return <Suspended until={held} reason={me?.suspendedReason ?? null} />;

  // قبل أن نعرف: لا شاشةَ دخولٍ تومض لمن هو داخلٌ أصلاً.
  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.paper }}>
        <ActivityIndicator color={colors.clay} />
      </View>
    );
  }

  /*
    مكدّسٌ لا `Slot`.

    `Slot` يعرض الشاشة الحاليّة بلا تاريخ: `canGoBack()` يردّ «لا» دائماً،
    فكلُّ رجوعٍ كان يسقط على الوجهة المكتوبة في الرأس — ومعظمها «/» —
    فيرجع من أيّ شاشةٍ إلى اللحظات لا إلى ما قبلها. والمكدّس يحفظ الطريق،
    ومعه تعمل إيماءةُ الرجوع من الحافة وزرُّ الرجوع في أندرويد.
  */
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        /*
          الاتجاه يُعاد فرضُه على حاوية كل شاشة.

          الجذر يحمله، لكنّ الوراثة لم تصل إلى كل شجرةٍ على الجهاز: صفوف
          `flexWrap` في «إكسسواراتي» كانت ترتصّ من اليسار، ونصوصٌ معها —
          والمعاينة على الويب تعرضها صحيحة، فلا يُكشف إلا على جهاز.
          وتكراره هنا لا يضرّ حيث وصلت الوراثة، ويحسمها حيث لم تصل.
        */
        contentStyle: { backgroundColor: colors.paper, direction: "rtl" },
      }}
    />
  );
}

export default function RootLayout() {
  /*
    خطوط العلامة قبل أوّل حرف.

    بلا هذا يرسم أندرويد بـRoboto وآبل بـSF Pro، فيخرج التطبيق بثلاثة
    وجوهٍ على ثلاث شاشات — والعلامةُ لا تُترك لخطٍّ يختاره الجهاز.
    والأوزان مذكورةٌ بأعيانها: كلُّ وزنٍ ملفٌّ وعائلةٌ مستقلّة، وما لا
    يُحمَّل هنا يسقط نصّه إلى خطّ النظام (`theme/fonts.ts`).

    والفشل (`error`) لا يحبس الشاشة: خطٌّ لم يُفكّ خيرٌ منه تطبيقٌ لا
    يُفتح — يُرسم بخطّ النظام ويُقرأ.
  */
  const [fontsReady, fontsError] = useFonts({
    IBMPlexSansArabic_400Regular,
    IBMPlexSansArabic_500Medium,
    IBMPlexSansArabic_600SemiBold,
    IBMPlexSansArabic_700Bold,
    Tajawal_400Regular,
    Tajawal_700Bold,
    Montserrat_500Medium,
    Montserrat_700Bold,
  });

  if (!fontsReady && !fontsError) {
    return <View style={{ flex: 1, backgroundColor: colors.paper }} />;
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={client}>
        <View style={{ flex: 1, direction: "rtl" }}>
          <Gate />
        </View>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
