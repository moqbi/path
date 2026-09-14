import { useEffect } from "react";
import { I18nManager, View, ActivityIndicator } from "react-native";
import { Slot, useRouter, useSegments } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useSession } from "../lib/session";
import { primeAccess } from "../lib/api";
import { colors } from "../theme/tokens";

/**
 * العربية من اليمين — قراراً لا إعداداً.
 *
 * أثر عربيّ الواجهة كلها، فالاتجاه يُفرض ولا يُترك للغة الجهاز: من
 * جهازُه بالإنجليزية يفتح تطبيقاً عربياً، لا تطبيقاً عربياً مقلوباً.
 */
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

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
        <Gate />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
