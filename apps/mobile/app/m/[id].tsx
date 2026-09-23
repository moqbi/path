import { useState } from "react";
import { View, ScrollView, Pressable, ActivityIndicator } from "react-native";
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

      <ScrollView contentContainerStyle={{ paddingTop: 12, paddingBottom: 24 }}>
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
          />
        </View>

        <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 14 }}>
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
      </ScrollView>
    </SafeAreaView>
  );
}
