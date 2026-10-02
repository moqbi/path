import { useState } from "react";
import { View, Pressable, ScrollView, ActivityIndicator, Image } from "react-native";
import * as Picker from "expo-image-picker";
import { Text, TextInput } from "../../components/type";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ScreenHeader } from "../../components/screen-header";
import { SupportLine } from "../../components/support-line";
import { CameraIcon, CloseIcon, InfoIcon } from "../../components/icons";
import { api } from "../../lib/api";
import { relative } from "../../lib/format";
import { shrink } from "../../lib/upload";
import { brandGradient, colors } from "../../theme/tokens";

type Ticket = {
  id: string;
  body: string;
  topic: string | null;
  files?: number;
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
/** سببُ التواصل — القائمةُ نفسها في الموقع والويب (القاعدة ١٨٠ب). */
const REASONS = [
  { key: "suggestion", label: "اقتراح" },
  { key: "complaint", label: "شكوى" },
  { key: "report", label: "بلاغ" },
] as const;
const TOPIC_LABEL: Record<string, string> = {
  suggestion: "اقتراح",
  complaint: "شكوى",
  report: "بلاغ",
  beta: "فريق التجربة",
};

/** حدودُ المرفقات كالموقع: ثلاثُ صورٍ بخمسة ميغا لكلٍّ (القاعدة ١٧٩). */
const MAX_FILES = 3;
const MAX_BYTES = 5 * 1024 * 1024;

type Picked = { uri: string; mime: string; size: number };

export default function Support() {
  const client = useQueryClient();
  const [body, setBody] = useState("");
  const [topic, setTopic] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<Picked[]>([]);
  const [said, setSaid] = useState<{ ok?: string; error?: string } | null>(null);

  const tickets = useQuery({
    queryKey: ["support"],
    queryFn: () => api<{ tickets: Ticket[] }>("/v1/me/support"),
  });

  const send = useMutation({
    mutationFn: () => {
      // الرسالةُ بسببها ومرفقاتها في طلبٍ واحد: رسالةٌ بلا صورها نصفُ رسالة.
      const form = new FormData();
      form.append("body", body.trim());
      form.append("topic", topic ?? "");
      files.forEach((file, index) => {
        form.append("files", {
          uri: file.uri,
          name: `image-${index + 1}.${file.mime === "image/png" ? "png" : "jpg"}`,
          type: file.mime,
        } as unknown as Blob);
      });
      return api("/v1/me/support", { method: "POST", body: form });
    },
    onSuccess: async () => {
      // يُفرَّغ الحقل بعد الإرسال حتى لا تُرسل الرسالة مرتين بالغلط.
      setBody("");
      setTopic(null);
      setFiles([]);
      setSaid({ ok: "وصلتنا رسالتك" });
      await client.invalidateQueries({ queryKey: ["support"] });
    },
    onError: (problem) =>
      setSaid({ error: problem instanceof Error ? problem.message : "تعذّر الإرسال" }),
  });

  /*
    الصورةُ تُصغَّر على الجهاز قبل أن تُضاف (`shrink` — ١٦٠٠ وJPEG): صورةُ
    آيفون أربعةُ ميغا وأكثر، والحدُّ خمسة. وما بقي فوقه بعد الضغط يُقال
    فوراً لا بعد الإرسال.
  */
  async function pick() {
    setSaid(null);
    const result = await Picker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: MAX_FILES - files.length,
      quality: 0.9,
    });
    if (result.canceled) return;
    const next = [...files];
    for (const asset of result.assets) {
      if (next.length >= MAX_FILES) break;
      const mime = asset.mimeType ?? "image/jpeg";
      const ready = await shrink(asset.uri, mime, asset).catch(() => ({ uri: asset.uri, mime }));
      const size = (await (await fetch(ready.uri)).blob()).size;
      if (size > MAX_BYTES) {
        setSaid({ error: "صورةٌ أكبر من ٥ ميغا لم تُضف" });
        continue;
      }
      next.push({ uri: ready.uri, mime: ready.mime, size });
    }
    setFiles(next);
  }

  const rows = tickets.data?.tickets ?? [];

  return (
    <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: colors.ground }}>
      <ScreenHeader title="الدعم وتواصل معنا" back="/settings" />

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, padding: 16, marginBottom: 20 }}>
          <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "600", marginBottom: 4, textAlign: "right" }}>
            كيف نقدر نساعدك؟
          </Text>
          <Text style={{ color: colors.muted, fontSize: 11.5, lineHeight: 19, marginBottom: 12, textAlign: "right" }}>
            اكتب مشكلتك أو اقتراحك أو بلاغك، ونردّ عليك في هذه الصفحة نفسها.
          </Text>

          {/* سببُ التواصل: قائمةٌ تنسدل تحت الحقل — ثلاثةُ أسطرٍ لا نافذةٌ فوق نافذة. */}
          <Pressable
            onPress={() => setOpen(!open)}
            style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: open ? colors.clay : colors.line, backgroundColor: colors.paper, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: open ? 0 : 10 }}
          >
            <Text style={{ color: topic ? colors.ink : colors.faint, fontSize: 13 }}>
              {topic ? TOPIC_LABEL[topic] : "سبب التواصل…"}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>{open ? "▴" : "▾"}</Text>
          </Pressable>
          {open ? (
            <View style={{ borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, marginTop: 6, marginBottom: 10, overflow: "hidden" }}>
              {REASONS.map((reason, index) => (
                <Pressable
                  key={reason.key}
                  onPress={() => {
                    setTopic(reason.key);
                    setOpen(false);
                  }}
                  style={{ paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: index ? 1 : 0, borderTopColor: colors.line, backgroundColor: topic === reason.key ? colors.claySoft : "transparent" }}
                >
                  <Text style={{ color: topic === reason.key ? colors.clayInk : colors.ink, fontSize: 13, fontWeight: topic === reason.key ? "700" : "400" }}>
                    {reason.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <TextInput
            value={body}
            onChangeText={setBody}
            multiline
            maxLength={1200}
            placeholder="اكتب رسالتك…"
            placeholderTextColor={colors.faint}
            style={{ height: 110, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, paddingHorizontal: 16, paddingTop: 12, fontSize: 13, lineHeight: 22, color: colors.ink, textAlign: "right", textAlignVertical: "top", marginBottom: 10 }}
          />

          {/* صورٌ تشرح المشكلة — حتى ثلاث، ويُحذف ما لا يلزم قبل الإرسال. */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
            {files.map((file, index) => (
              <View key={file.uri} style={{ width: 64, height: 64, borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: colors.line }}>
                <Image source={{ uri: file.uri }} style={{ width: "100%", height: "100%" }} />
                <Pressable
                  onPress={() => setFiles(files.filter((_, at) => at !== index))}
                  hitSlop={6}
                  style={{ position: "absolute", top: 3, right: 3, width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(14,26,36,0.7)" }}
                >
                  <CloseIcon size={11} color="#fff" />
                </Pressable>
              </View>
            ))}
            {files.length < MAX_FILES ? (
              <Pressable
                onPress={() => void pick()}
                style={{ width: 64, height: 64, borderRadius: 12, borderWidth: 1, borderStyle: "dashed", borderColor: colors.line, backgroundColor: colors.paper, alignItems: "center", justifyContent: "center", gap: 2 }}
              >
                <CameraIcon size={18} color={colors.muted} />
                <Text style={{ color: colors.muted, fontSize: 9.5 }}>صورة</Text>
              </Pressable>
            ) : null}
          </View>
          <Text style={{ color: colors.faint, fontSize: 10.5, marginBottom: 10 }}>
            حتى ٣ صور، ٥ ميغا لكلٍّ (اختياري)
          </Text>

          <Pressable
            onPress={() => {
              setSaid(null);
              if (!topic) setSaid({ error: "اختر سبب التواصل" });
              else if (body.trim().length < 5) setSaid({ error: "اكتب رسالتك أولاً" });
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
          <SupportLine />
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
                    {ticket.topic && TOPIC_LABEL[ticket.topic] ? (
                      <Text style={{ color: colors.ink2, fontSize: 10.5, fontWeight: "600" }}>
                        {TOPIC_LABEL[ticket.topic]}
                      </Text>
                    ) : null}
                    <Text style={{ color: colors.faint, fontSize: 10.5 }}>
                      {relative(new Date(ticket.createdAt))}
                      {ticket.files ? ` · ${ticket.files} صورة` : ""}
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
