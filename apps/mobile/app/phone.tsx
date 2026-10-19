import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { maskPhone, normalizePhone } from "@athar/shared";
import { Text, TextInput } from "../components/type";
import { AthrMark } from "../components/brand";
import { api } from "../lib/api";
import { ar } from "../lib/format";
import { useSession } from "../lib/session";
import { contactsReady } from "../lib/contacts";
import { openAddSheet } from "../components/add-sheet";
import { usePhonePrompt } from "../lib/phone-prompt";
import { confirmCode, phoneAuthReady, sendCode } from "../lib/phone-auth";
import { brandGradient, colors } from "../theme/tokens";

type Step = "number" | "code" | "done";

/**
 * الرقمُ المخفيّ بين علامتَي اتجاهٍ لاتينيّ: أرقامُه ونقاطُه ضعيفةُ الاتجاه، فيقلبها
 * سطرٌ عربيّ قطعاً قطعاً («33 ••• ••5 966+»). والعزلُ (`\u2066`) لم يصمد في المعاينة.
 */
const ltr = (text: string) => `\u200E${text}\u200E`;

/**
 * رقمُ الجوال (القاعدة ٢٩٧) — **بقرار المالك**: يُطلب مرّةً بعد الدخول ومعه «تخطَّ»،
 * ويُفتح بعدها من الإعدادات. يُكتب مؤكَّداً برمز SMS أو لا يُكتب: رقمٌ بلا تأكيد
 * يُظهر حساباً لأصدقاء صاحب الرقم الحقيقيّ على أنّه هو.
 */
export default function PhoneScreen() {
  const router = useRouter();
  const { first } = useLocalSearchParams<{ first?: string }>();
  const { me, refresh } = useSession();
  const [step, setStep] = useState<Step>("number");
  const [raw, setRaw] = useState("");
  const [phone, setPhone] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(0);
  const codeRef = useRef<React.ElementRef<typeof TextInput>>(null);

  // الجولةُ تنتظر هذه الشاشة ما دامت مفتوحة.
  useEffect(() => {
    usePhonePrompt.setState({ open: true });
    return () => usePhonePrompt.setState({ open: false });
  }, []);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  const leave = () => (router.canGoBack() ? router.back() : router.replace("/"));

  const run = async (job: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await job();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "تعذّر الطلب");
    } finally {
      setBusy(false);
    }
  };

  const send = () =>
    run(async () => {
      const e164 = normalizePhone(raw.startsWith("+") ? raw : `0${raw.replace(/^0+/, "")}`);
      if (!e164 || !e164.startsWith("+966")) throw new Error("اكتب رقم جوال سعودي صحيح");
      if (me?.phone === e164) {
        setPhone(e164);
        setStep("done");
        return;
      }
      if (!phoneAuthReady) throw new Error("هذي الميزة تحتاج تحديث التطبيق من المتجر");
      // الرمزُ من Firebase إلى الجوال مباشرةً — خادمُنا لا يراه ولا يرسله.
      await sendCode(e164);
      setPhone(e164);
      setStep("code");
      setCode("");
      setWait(60);
      setTimeout(() => codeRef.current?.focus(), 300);
    });

  const verify = (value = code) =>
    run(async () => {
      const idToken = await confirmCode(value);
      // الخادمُ يتحقّق من رمز الهويّة بمفاتيح Google بنفسه ويقرأ الرقمَ منه (القاعدة ١٢١).
      await api("/v1/me/phone/firebase", { method: "POST", body: JSON.stringify({ idToken }) });
      await refresh();
      setStep("done");
    });

  const skip = () =>
    run(async () => {
      await api("/v1/me/phone/skip", { method: "POST" }).catch(() => {});
      await refresh().catch(() => {});
      leave();
    });

  const remove = () =>
    run(async () => {
      await api("/v1/me/phone", { method: "DELETE" });
      await refresh();
      leave();
    });

  const sync = () => {
    leave();
    setTimeout(() => openAddSheet("contacts"), 350);
  };

  const field = {
    height: 54,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    paddingHorizontal: 16,
    fontSize: 18,
    color: colors.ink,
  } as const;

  const Primary = ({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) => (
    <Pressable onPress={onPress} disabled={disabled || busy} style={{ opacity: disabled ? 0.45 : 1, marginTop: 16 }}>
      <LinearGradient
        colors={brandGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" }}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: "#fff", fontSize: 15.5, fontWeight: "800" }}>{label}</Text>
        )}
      </LinearGradient>
    </Pressable>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.groundSolid }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 8 }}>
          <AthrMark size={32} />
          {step !== "done" ? (
            <Pressable onPress={first ? skip : leave} hitSlop={10} disabled={busy}>
              <Text style={{ color: colors.groundMuted, fontSize: 14, fontWeight: "700" }}>{first ? "تخطَّ" : "إلغاء"}</Text>
            </Pressable>
          ) : null}
        </View>

        <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 36 }} keyboardShouldPersistTaps="handled">
          {step === "number" ? (
            <>
              <Text style={{ color: colors.groundInk, fontSize: 24, fontWeight: "800" }}>رقم جوالك</Text>
              <Text style={{ color: colors.groundMuted, fontSize: 13.5, lineHeight: 23, marginTop: 8 }}>
                اللي عندهم رقمك في جهات اتصالهم يلقونك في آثار، وأنت تلقاهم. الرقم ما يظهر لأحد، ونتأكد منه برمز يوصلك برسالة.
              </Text>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 24, direction: "ltr" }}>
                <View style={[field, { justifyContent: "center", paddingHorizontal: 14 }]}>
                  <Text style={{ color: colors.ink, fontSize: 17, fontWeight: "700", writingDirection: "ltr" }}>+966</Text>
                </View>
                <TextInput
                  value={raw}
                  onChangeText={(value) => {
                    setRaw(value);
                    setError(null);
                  }}
                  placeholder="5X XXX XXXX"
                  placeholderTextColor={colors.faint}
                  keyboardType="phone-pad"
                  textContentType="telephoneNumber"
                  autoComplete="tel"
                  maxLength={16}
                  autoFocus
                  onSubmitEditing={send}
                  style={[field, { flex: 1, minWidth: 0, textAlign: "left", writingDirection: "ltr", letterSpacing: 1 }]}
                />
              </View>
              <Primary label="أرسل الرمز" onPress={send} disabled={raw.replace(/\D/g, "").length < 9} />
              {me?.phone && !first ? (
                <Pressable onPress={remove} disabled={busy} style={{ alignSelf: "center", marginTop: 20 }} hitSlop={8}>
                  <Text style={{ color: colors.groundMuted, fontSize: 13, fontWeight: "700" }}>
                    رقمك الحالي {ltr(maskPhone(me.phone))} · أزله
                  </Text>
                </Pressable>
              ) : null}
            </>
          ) : null}

          {step === "code" && phone ? (
            <>
              <Text style={{ color: colors.groundInk, fontSize: 24, fontWeight: "800" }}>اكتب الرمز</Text>
              <Text style={{ color: colors.groundMuted, fontSize: 13.5, lineHeight: 23, marginTop: 8 }}>
                أرسلنا رمزاً من ٦ أرقام إلى{" "}
                <Text style={{ color: colors.groundInk, fontWeight: "700" }}>{ltr(maskPhone(phone))}</Text>
              </Text>
              <TextInput
                ref={codeRef}
                value={code}
                onChangeText={(value) => {
                  const digits = value.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/\D/g, "").slice(0, 6);
                  setCode(digits);
                  setError(null);
                  if (digits.length === 6 && !busy) void verify(digits);
                }}
                placeholder="••••••"
                placeholderTextColor={colors.faint}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="sms-otp"
                maxLength={6}
                style={[field, { marginTop: 24, textAlign: "center", writingDirection: "ltr", fontSize: 26, letterSpacing: 10, height: 62 }]}
              />
              <Primary label="تأكيد" onPress={() => void verify()} disabled={code.length !== 6} />
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 18 }}>
                <Pressable onPress={() => setStep("number")} hitSlop={8}>
                  <Text style={{ color: colors.groundMuted, fontSize: 13, fontWeight: "700" }}>غيّر الرقم</Text>
                </Pressable>
                <Pressable onPress={send} disabled={wait > 0 || busy} hitSlop={8}>
                  <Text style={{ color: wait > 0 ? colors.groundFaint : colors.groundInk, fontSize: 13, fontWeight: "700" }}>
                    {wait > 0 ? `أعد الإرسال بعد ${ar(wait)} ث` : "أعد الإرسال"}
                  </Text>
                </Pressable>
              </View>
            </>
          ) : null}

          {step === "done" ? (
            <>
              <Text style={{ color: colors.groundInk, fontSize: 24, fontWeight: "800" }}>تمّ ربط رقمك</Text>
              <Text style={{ color: colors.groundMuted, fontSize: 13.5, lineHeight: 23, marginTop: 8 }}>
                {phone ?? me?.phone ? `${ltr(maskPhone((phone ?? me?.phone)!))} — ` : ""}
                اللي عندهم رقمك يلقونك الحين. تبي تشوف مين من جهات اتصالك في آثار؟
              </Text>
              {contactsReady ? <Primary label="ابحث في جهات اتصالي" onPress={sync} /> : null}
              <Pressable onPress={leave} style={{ alignSelf: "center", marginTop: 18 }} hitSlop={8}>
                <Text style={{ color: colors.groundMuted, fontSize: 14, fontWeight: "700" }}>{contactsReady ? "لاحقاً" : "تمّ"}</Text>
              </Pressable>
            </>
          ) : null}

          {error ? <Text style={{ color: colors.live, fontSize: 13, marginTop: 14, textAlign: "center" }}>{error}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
