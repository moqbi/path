import { useState } from "react";
import { View, Pressable, ScrollView, ActivityIndicator, Platform } from "react-native";
import { Text, TextInput } from "../../components/type";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useMutation } from "@tanstack/react-query";
import { ScreenHeader } from "../../components/screen-header";
import { api } from "../../lib/api";
import { useSession } from "../../lib/session";
import { brandGradient, colors } from "../../theme/tokens";

const DEVICES = ["iPhone", "Android"] as const;

/**
 * فريقُ التجارب — من داخل التطبيق بنموذج `/beta` في الموقع نفسه: بريدُ
 * الدعوة، والجهاز، وملاحظةٌ اختيارية. والدعوةُ تُرسل بيدٍ من TestFlight
 * وGoogle Play (القاعدة ١٨٠ب)، ويصل الطلبُ صندوقَ الدعم.
 */
export default function Beta() {
  const { me } = useSession();
  const [email, setEmail] = useState(me?.email ?? "");
  // الجهازُ الذي في اليد هو الغالب — ويُغيَّر إن كان يريد الآخر.
  const [device, setDevice] = useState<(typeof DEVICES)[number]>(
    Platform.OS === "android" ? "Android" : "iPhone",
  );
  const [note, setNote] = useState("");
  const [said, setSaid] = useState<{ ok?: string; error?: string } | null>(null);

  const send = useMutation({
    mutationFn: () =>
      api<{ ok: string }>("/v1/me/beta", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), device, note: note.trim() || undefined }),
      }),
    onSuccess: (answer) => setSaid({ ok: answer.ok }),
    onError: (problem) =>
      setSaid({ error: problem instanceof Error ? problem.message : "تعذّر الإرسال" }),
  });

  const field = {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    paddingHorizontal: 16,
    fontSize: 13,
    color: colors.ink,
  } as const;

  return (
    <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: colors.ground }}>
      <ScreenHeader title="فريق التجارب" back="/settings" />

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, padding: 16 }}>
          <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "600", marginBottom: 4 }}>
            جرّب آثار قبل الجميع
          </Text>
          <Text style={{ color: colors.muted, fontSize: 11.5, lineHeight: 19, marginBottom: 14 }}>
            نرسل لك دعوةً إلى النسخ التجريبية عبر TestFlight على الآيفون أو Google Play على
            أندرويد، وملاحظاتك تصلنا قبل أن تصل النسخة للناس.
          </Text>

          <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600", marginBottom: 4 }}>بريدك</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={200}
            style={{ ...field, height: 46, textAlign: "left", writingDirection: "ltr" }}
          />
          <Text style={{ color: colors.faint, fontSize: 10.5, marginTop: 4, marginBottom: 12 }}>
            بريدُ حسابك في آبل أو قوقل — إليه تُرسَل الدعوة.
          </Text>

          <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600", marginBottom: 6 }}>جهازك</Text>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
            {DEVICES.map((option) => {
              const on = device === option;
              return (
                <Pressable
                  key={option}
                  onPress={() => setDevice(option)}
                  style={{ flex: 1, height: 46, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center", borderColor: on ? colors.clay : colors.line, backgroundColor: on ? colors.card : colors.paper }}
                >
                  <Text face="latin" style={{ color: on ? colors.clayInk : colors.ink2, fontSize: 13.5, fontWeight: "600" }}>
                    {option}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600", marginBottom: 4 }}>
            ملاحظة (اختياري)
          </Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            multiline
            maxLength={600}
            style={{ ...field, height: 84, paddingTop: 12, textAlignVertical: "top", marginBottom: 12 }}
          />

          <Pressable
            onPress={() => {
              setSaid(null);
              if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) setSaid({ error: "اكتب بريداً صحيحاً" });
              else send.mutate();
            }}
            disabled={send.isPending}
          >
            <LinearGradient
              colors={[brandGradient[0], brandGradient[1]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", opacity: send.isPending ? 0.5 : 1 }}
            >
              {send.isPending ? (
                <ActivityIndicator color={colors.onBrand} />
              ) : (
                <Text style={{ color: colors.onBrand, fontSize: 14, fontWeight: "700" }}>انضم</Text>
              )}
            </LinearGradient>
          </Pressable>

          {said?.error ? (
            <Text style={{ color: colors.live, fontSize: 12, marginTop: 8 }}>{said.error}</Text>
          ) : null}
          {said?.ok ? (
            <Text style={{ color: colors.clayInk, fontSize: 12, marginTop: 8 }}>{said.ok}</Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
