import { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ScreenHeader } from "../../components/screen-header";
import { InfoIcon } from "../../components/icons";
import { api } from "../../lib/api";
import { relative } from "../../lib/format";
import { brandGradient, colors } from "../../theme/tokens";

type Ticket = {
  id: string;
  body: string;
  reply: string | null;
  closed: boolean;
  createdAt: string;
};

/**
 * الدعم الفني: رسالةٌ تُكتب هنا وتُقرأ هنا.
 *
 * لا بريد إلكتروني يخرج من التطبيق: الرسالة تُحفظ ويقرؤها المشرف في
 * اللوحة ويردّ عليها، فيرى صاحبها ردَّه في مكان سؤاله — ويعرف أنها
 * وصلت. وهذا أيضاً ما يشترطه متجر آبل: وسيلة تواصلٍ داخل التطبيق.
 */
export default function Support() {
  const client = useQueryClient();
  const [body, setBody] = useState("");
  const [said, setSaid] = useState<{ ok?: string; error?: string } | null>(null);

  const tickets = useQuery({
    queryKey: ["support"],
    queryFn: () => api<{ tickets: Ticket[] }>("/v1/me/support"),
  });

  const send = useMutation({
    mutationFn: () => api("/v1/me/support", { method: "POST", body: JSON.stringify({ body: body.trim() }) }),
    onSuccess: async () => {
      // يُفرَّغ الحقل بعد الإرسال حتى لا تُرسل الرسالة مرتين بالغلط.
      setBody("");
      setSaid({ ok: "وصلتنا رسالتك" });
      await client.invalidateQueries({ queryKey: ["support"] });
    },
    onError: (problem) =>
      setSaid({ error: problem instanceof Error ? problem.message : "تعذّر الإرسال" }),
  });

  const rows = tickets.data?.tickets ?? [];

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScreenHeader title="الدعم وتواصل معنا" back="/settings/privacy" />

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, padding: 16, marginBottom: 20 }}>
          <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "600", marginBottom: 4, textAlign: "right" }}>
            كيف نقدر نساعدك؟
          </Text>
          <Text style={{ color: colors.muted, fontSize: 11.5, lineHeight: 19, marginBottom: 12, textAlign: "right" }}>
            اكتب مشكلتك أو اقتراحك أو بلاغك، ونردّ عليك في هذه الصفحة نفسها.
          </Text>

          <TextInput
            value={body}
            onChangeText={setBody}
            multiline
            maxLength={1200}
            placeholder="اكتب رسالتك…"
            placeholderTextColor={colors.faint}
            style={{ height: 110, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, paddingHorizontal: 16, paddingTop: 12, fontSize: 13, lineHeight: 22, color: colors.ink, textAlign: "right", textAlignVertical: "top", marginBottom: 10 }}
          />

          <Pressable
            onPress={() => { setSaid(null); if (body.trim().length >= 5) send.mutate(); else setSaid({ error: "اكتب رسالتك أولاً" }); }}
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
                <Text style={{ color: colors.onBrand, fontSize: 14, fontWeight: "700" }}>أرسل</Text>
              )}
            </LinearGradient>
          </Pressable>

          {said?.error ? (
            <Text style={{ color: colors.live, fontSize: 12, marginTop: 8, textAlign: "right" }}>
              {said.error}
            </Text>
          ) : null}
          {said?.ok ? (
            <Text style={{ color: colors.clayInk, fontSize: 12, marginTop: 8, textAlign: "right" }}>
              {said.ok}
            </Text>
          ) : null}
        </View>

        {rows.length > 0 ? (
          <>
            <Text style={{ color: colors.faint, fontSize: 11.5, fontWeight: "600", marginBottom: 8, textAlign: "right" }}>
              رسائلك
            </Text>

            <View style={{ gap: 10 }}>
              {rows.map((ticket) => (
                <View key={ticket.id} style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, padding: 16 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <View
                      style={{
                        borderRadius: 999,
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        backgroundColor: ticket.reply ? colors.claySoft : colors.chip,
                      }}
                    >
                      <Text style={{ color: ticket.reply ? colors.clayInk : colors.muted, fontSize: 10, fontWeight: "700" }}>
                        {ticket.closed ? "مغلقة" : ticket.reply ? "رُدّ عليها" : "بانتظار الردّ"}
                      </Text>
                    </View>
                    <Text style={{ color: colors.faint, fontSize: 10.5 }}>
                      {relative(new Date(ticket.createdAt))}
                    </Text>
                  </View>

                  <Text style={{ color: colors.ink, fontSize: 13, lineHeight: 22, textAlign: "right" }}>
                    {ticket.body}
                  </Text>

                  {ticket.reply ? (
                    <View style={{ marginTop: 12, borderRadius: 12, backgroundColor: colors.chip, padding: 12 }}>
                      <Text style={{ color: colors.clayInk, fontSize: 10.5, fontWeight: "700", marginBottom: 4, textAlign: "right" }}>
                        ردّ آثار
                      </Text>
                      <Text style={{ color: colors.ink2, fontSize: 12.5, lineHeight: 21, textAlign: "right" }}>
                        {ticket.reply}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          </>
        ) : null}

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 24 }}>
          <InfoIcon size={13} color={colors.faint} />
          <Text style={{ color: colors.faint, fontSize: 11 }}>
            نقرأ كل رسالة · الردّ خلال يوم عمل
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
