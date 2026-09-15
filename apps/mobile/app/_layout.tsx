import { useEffect } from "react";
import { I18nManager, Platform, View, ActivityIndicator } from "react-native";
import { Slot, useRouter, useSegments } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useSession } from "../lib/session";
import { primeAccess } from "../lib/api";
import { colors } from "../theme/tokens";

/**
 * العربية من اليمين — قراراً لا إعداداً، وفي البيئات الثلاث معاً.
 *
 * أثر عربيّ الواجهة كلها، فالاتجاه يُفرض ولا يُترك للغة الجهاز: من
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
 */
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

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
  }, [restore]);

  useEffect(() => {
    if (!ready) return;
    const inApp = segments[0] === "(tabs)" || segments[0] === "m" || segments[0] === "u";
    if (!me && inApp) router.replace("/login");
    if (me && segments[0] === "login") router.replace("/");
  }, [me, ready, segments, router]);

  // قبل أن نعرف: لا شاشةَ دخولٍ تومض لمن هو داخلٌ أصلاً.
  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.paper }}>
        <ActivityIndicator color={colors.clay} />
      </View>
    );
  }

  return <Slot />;
}

export default function RootLayout() {
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
