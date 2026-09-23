import { useState } from "react";
import { View, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { Text, TextInput } from "../../components/type";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { Avatar } from "../../components/avatar";
import { MomentCard } from "../../components/moment-card";
import { ScreenHeader } from "../../components/screen-header";
import { useComment, useMoment, useReact } from "../../lib/queries";
import { relative } from "../../lib/format";
import { useSession } from "../../lib/session";
import { colors } from "../../theme/tokens";

/** الوجوه الخمسة مفتوحةٌ للجميع؛ والحرّ لمشتركي آثار+ ويُفحص على الخادم. */
const FACES = [
  { kind: "SMILE", glyph: "🙂" },
  { kind: "LAUGH", glyph: "😄" },
  { kind: "GASP", glyph: "😮" },
  { kind: "SAD", glyph: "😢" },
  { kind: "LOVE", glyph: "❤️" },
];

/**
 * صفحة اللحظة: المنشور في قالب، ثم خط، ثم التفاعلات، ثم خط، ثم
 * التعليقات — بهذا الترتيب لا بغيره، فالتعليق جوابٌ على شيءٍ يُرى.
 */
export default function MomentPage() {
  const me = useSession((state) => state.me);
  const { id } = useLocalSearchParams<{ id: string }>();
  const moment = useMoment(id);
  const react = useReact(id);
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

  const line = { height: 1, backgroundColor: colors.line, marginHorizontal: 16 };

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

        <View style={line} />

        <View style={{ flexDirection: "row", gap: 8, padding: 14 }}>
          {FACES.map((face) => (
            <Pressable
              key={face.kind}
              onPress={() => react.mutate({ kind: face.kind })}
              style={{
                width: 42,
                height: 42,
                borderRadius: 21,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: colors.line,
                backgroundColor: colors.card,
              }}
            >
              <Text style={{ fontSize: 19 }}>{face.glyph}</Text>
            </Pressable>
          ))}
        </View>

        {data.reactions.length > 0 ? (
          <Text style={{ color: colors.muted, fontSize: 12, paddingHorizontal: 16, paddingBottom: 12 }}>
            {data.reactions.map((r) => r.name).join("، ")}
          </Text>
        ) : null}

        <View style={line} />

        <View style={{ padding: 14, gap: 12 }}>
          {data.comments.map((item) => (
            <View key={item.id} style={{ flexDirection: "row", gap: 9 }}>
              <Avatar name={item.user.name} size={32} mediaId={item.user.avatarMediaId} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "600" }}>
                  {item.user.name}
                </Text>
                <Text style={{ color: colors.ink2, fontSize: 13, lineHeight: 21 }}>{item.body}</Text>
                <Text style={{ color: colors.faint, fontSize: 10.5 }}>
                  {relative(new Date(item.createdAt))}
                </Text>
              </View>
            </View>
          ))}

          {data.comments.length === 0 ? (
            <Text style={{ color: colors.faint, fontSize: 12.5 }}>لا تعليقات بعد.</Text>
          ) : null}
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
