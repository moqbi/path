import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { AthrLockup } from "../components/brand";
import { useSession } from "../lib/session";
import { colors } from "../theme/tokens";

const TAGLINE = "دائرتك الصغيرة، بلا ضجيج";

export default function Login() {
  const router = useRouter();
  const signIn = useSession((s) => s.signIn);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
      router.replace("/");
    } catch (problem) {
      // رسالةٌ واحدة للحالتين: أيُّ بريدٍ مسجَّل ليس خبراً يُعطى.
      setError(problem instanceof Error ? problem.message : "تعذّر الدخول");
    } finally {
      setBusy(false);
    }
  }

  const field = {
    height: 52,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 14.5,
    color: colors.ink,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
  } as const;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: colors.paper }}
    >
      <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 28, gap: 10 }}>
        <View style={{ alignItems: "center", marginBottom: 26 }}>
          <AthrLockup size={44} />
          <Text style={{ color: colors.muted, fontSize: 13, marginTop: 10 }}>{TAGLINE}</Text>
        </View>

        <TextInput
          style={field}
          value={email}
          onChangeText={setEmail}
          placeholder="البريد"
          placeholderTextColor={colors.faint}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="emailAddress"
        />
        <TextInput
          style={field}
          value={password}
          onChangeText={setPassword}
          placeholder="كلمة المرور"
          placeholderTextColor={colors.faint}
          secureTextEntry
          textContentType="password"
          onSubmitEditing={submit}
        />

        {error ? (
          <Text accessibilityRole="alert" style={{ color: colors.live, fontSize: 12.5 }}>
            {error}
          </Text>
        ) : null}

        <Pressable
          onPress={submit}
          disabled={busy}
          style={{
            height: 54,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.clay,
            opacity: busy ? 0.6 : 1,
            marginTop: 4,
          }}
        >
          {busy ? (
            <ActivityIndicator color={colors.onBrand} />
          ) : (
            <Text style={{ color: colors.onBrand, fontSize: 15, fontWeight: "700" }}>دخول</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
