import { useState } from "react";
import { View, ScrollView, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text, TextInput } from "../../components/type";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { MomentCard } from "../../components/moment-card";
import { ScreenHeader } from "../../components/screen-header";
import { useComment, useMoment } from "../../lib/queries";
import { useSession } from "../../lib/session";
import { colors } from "../../theme/tokens";

/**
 * صفحة اللحظة: بطاقةٌ واحدة ثمّ حقلُ التعليق.
 *
 * والبطاقةُ هي بطاقةُ الخطّ الزمنيّ نفسها — فيها زرُّ التفاعل ووجوهُ
 * من تفاعل وتعليقاتُهم. وكانت الصفحة ترسم تحتها صفَّ وجوهٍ ثانياً
 * وقائمةَ تعليقاتٍ ثانية، فيُقرأ التعليق مرّتين: واحدٌ داخل القالب
 * وواحدٌ سائبٌ تحته، ومعهما إيموجي بلا موضع. ولوحةُ التفاعل بابٌ
 * واحد (القاعدة ٨)، فصفُّ الوجوه العاري نقضُها.
 */
export default function MomentPage() {
  const me = useSession((state) => state.me);
  const { id } = useLocalSearchParams<{ id: string }>();
  const moment = useMoment(id);
  const comment = useComment(id);
  const [body, setBody] = useState("");
  const insets = useSafeAreaInsets();

  if (moment.isLoading) {
    return (
      <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: colors.paper }}>
        <ScreenHeader title="لحظة" back="/" />
        <ActivityIndicator style={{ marginTop: 50 }} color={colors.clay} />
      </SafeAreaView>
    );
  }

  const data = moment.data?.moment;
  if (!data) {
    return (
      <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: colors.paper }}>
        <ScreenHeader title="لحظة" back="/" />
        <Text style={{ color: colors.muted, fontSize: 13.5, textAlign: "center", marginTop: 50 }}>
          اللحظة غير موجودة.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScreenHeader title="لحظة" back="/" />

      {/*
        حقلُ التعليق **خارج** التمرير ومثبّتٌ في أسفل الشاشة، ويصعد مع
        الكيبورد (`KeyboardAvoidingView`). كان داخل التمرير تحت البطاقة
        مباشرةً، فيجلس في منتصف الشاشة كأنّ كيبورداً مفتوحاً تحته.
      */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 24 }}
      >
        {/*
          حشوة الخطّ الزمني نفسها: البطاقة مرسومةٌ على ورقٍ بعمود صورٍ
          وخيط، وبلا حشوةٍ جانبية تلتصق بالحافتين ويمشي العمود خارج
          الخيط — كما كان في ملف الصديق.
        */}
        <View style={{ paddingHorizontal: 20 }}>
          <MomentCard
            moment={data}
            viewerId={me?.id ?? ""}
            isPlus={me?.isPlus ?? false}
            moderate={me?.canModerate ?? false}
            here
          />
        </View>
      </ScrollView>

        <View
          style={{
            flexDirection: "row",
            gap: 8,
            paddingHorizontal: 14,
            paddingTop: 10,
            paddingBottom: Math.max(insets.bottom, 12),
            borderTopWidth: 1,
            borderTopColor: colors.line,
            backgroundColor: colors.paper,
          }}
        >
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="اكتب تعليقاً"
            placeholderTextColor={colors.faint}
            style={{
              flex: 1,
              minWidth: 0,
              height: 46,
              borderRadius: 12,
              paddingHorizontal: 14,
              fontSize: 13.5,
              textAlign: "right",
              color: colors.ink,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.line,
            }}
          />
          <Pressable
            disabled={!body.trim() || comment.isPending}
            onPress={() => {
              comment.mutate(body.trim());
              setBody("");
            }}
            style={{
              height: 46,
              paddingHorizontal: 16,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.clay,
              opacity: body.trim() ? 1 : 0.5,
            }}
          >
            <Text style={{ color: colors.onBrand, fontSize: 13, fontWeight: "700" }}>أرسل</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
