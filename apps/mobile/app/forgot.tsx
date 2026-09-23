import { useState } from "react";
import { View, Pressable, ActivityIndicator } from "react-native";
import { Text, TextInput } from "../components/type";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation } from "@tanstack/react-query";
import { ScreenHeader } from "../components/screen-header";
import { api } from "../lib/api";
import { colors } from "../theme/tokens";
import { LinearGradient } from "expo-linear-gradient";
import { brandGradient } from "../theme/tokens";

/**
 * «نسيت كلمة المرور»: بريدٌ واحد، ورابطٌ يصل إليه.
 *
 * والرابط يُفتح في المتصفّح على الموقع لا في التطبيق: من نسي كلمته قد
 * يفتح بريده على جهازٍ آخر، وصفحةُ الموقع تعمل في الحالين.
 *
 * والجوابُ واحدٌ وُجد الحساب أو لم يوجد — وإلّا صارت الشاشة وسيلةً
 * لمعرفة أيُّ بريدٍ مسجّلٌ عندنا.
 */
export default function Forgot() {
  const [email, setEmail] = useState("");
  const [said, setSaid] = useState<string | null>(null);

  const ask = useMutation({
    mutationFn: () =>
      api("/v1/auth/forgot", { method: "POST", body: JSON.stringify({ email: email.trim() }) }),
    onSuccess: () =>
      setSaid("إن كان هذا البريد مسجّلاً عندنا فقد أرسلنا إليه رابطاً. تحقّق من بريدك."),
    onError: (problem) =>
      setSaid(problem instanceof Error ? problem.message : "تعذّر الإرسال"),
  });

  return (
    <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScreenHeader title="نسيت كلمة المرور" back="/login" />

      <View style={{ padding: 20, gap: 12, direction: "rtl" }}>
        <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 22, textAlign: "right" }}>
          اكتب بريدك ونرسل لك رابطاً تضبط منه كلمةً جديدة. الرابط يعمل ساعةً واحدة.
        </Text>

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="بريدك"
          placeholderTextColor={colors.faint}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          style={{ height: 50, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, paddingHorizontal: 16, fontSize: 13.5, color: colors.ink, textAlign: "right" }}
        />

        {said ? (
          <Text style={{ color: colors.clayInk, fontSize: 12.5, lineHeight: 21, textAlign: "right" }}>
            {said}
          </Text>
        ) : null}

        <Pressable onPress={() => { setSaid(null); ask.mutate(); }} disabled={ask.isPending}>
          <LinearGradient
            colors={[brandGradient[0], brandGradient[1]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ height: 50, borderRadius: 12, alignItems: "center", justifyContent: "center", opacity: ask.isPending ? 0.6 : 1 }}
          >
            {ask.isPending ? (
              <ActivityIndicator color={colors.onBrand} />
            ) : (
              <Text style={{ color: colors.onBrand, fontSize: 14.5, fontWeight: "700" }}>
                أرسل الرابط
              </Text>
            )}
          </LinearGradient>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
