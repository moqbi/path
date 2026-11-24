import { Spinner } from "./spinner";
import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, Switch, View, useWindowDimensions } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { create } from "zustand";
import { MOMENT_TEXT_MAX, MOOD_TEXT_MAX } from "@athar/shared";
import { Text, TextInput } from "./type";
import { GlassSheet } from "./glass-sheet";
import { RtlStrip } from "./rtl-strip";
import { MoodArt } from "./moment-card";
import { PrivateIcon } from "./icons";
import { api } from "../lib/api";
import { ar } from "../lib/format";
import { FALLBACK_MOODS, useMoods } from "../lib/moods";
import { colors } from "../theme/tokens";

/**
 * «مود» و«سؤال» في قوس النشر (القاعدة ٤٨٤) — **بقرار المالك**: نافذتان زجاجيّتان في
 * وسط الشاشة لا شاشتان، بعرضٍ أنيق لا بعرضها (`GlassSheet width`). في أعلى كلٍّ منهما
 * معاينةٌ حيّة لما سيُنشر: لوحةُ المود بصورته ووجهه وعبارته تتبدّل مع كلّ اختيار،
 * وبطاقةُ السؤال بما يُكتب. وعلى الشاشة الأفقيّة عمودان: المعاينةُ والأدوات جنباً إلى جنب.
 * وتُركَّب في الجذر (القاعدة ١٣٧).
 */
const useSheet = create<{ open: "mood" | "question" | null }>(() => ({ open: null }));
export const openMoodSheet = () => useSheet.setState({ open: "mood" });
export const openQuestionSheet = () => useSheet.setState({ open: "question" });
const close = () => useSheet.setState({ open: null });

export function MoodSheet() {
  const open = useSheet((s) => s.open);
  if (open === "mood") return <MoodBody />;
  if (open === "question") return <QuestionBody />;
  return null;
}

const QUESTION_ART = require("../assets/composer/question.png");
const MOOD_ART = require("../assets/composer/mood.png");

/** عرضُ النافذة: ٤٠٠ قائمةً، و٧٢٠ على الشاشة الأفقيّة بعمودين. */
function useLayout() {
  const { width, height } = useWindowDimensions();
  const across = width > height && height < 600;
  return { across, sheetWidth: across ? 720 : 400 };
}

function usePost() {
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function post(body: object) {
    setBusy(true);
    setError(null);
    try {
      await api("/v1/moments", { method: "POST", body: JSON.stringify(body) });
      void client.invalidateQueries({ queryKey: ["feed"] });
      void client.invalidateQueries({ queryKey: ["me", "moments"] });
      close();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "تعذّر النشر");
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, post };
}

const field = {
  borderRadius: 16,
  backgroundColor: "rgba(255,255,255,.1)",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,.12)",
  paddingHorizontal: 16,
  paddingVertical: 12,
  fontSize: 14.5,
  lineHeight: 22,
  color: "#fff",
  textAlign: "right",
} as const;

function PostButton({ label, ready, busy, onPress }: { label: string; ready: boolean; busy: boolean; onPress: () => void }) {
  return (
    <Pressable
      disabled={!ready || busy}
      onPress={onPress}
      style={{
        height: 48,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.clay,
        opacity: !ready || busy ? 0.5 : 1,
      }}
    >
      {busy ? <Spinner color={colors.onBrand} /> : <Text style={{ color: colors.onBrand, fontSize: 14.5, fontWeight: "700" }}>{label}</Text>}
    </Pressable>
  );
}

/** المعاينةُ في طرفٍ والأدواتُ في الآخر على الشاشة الأفقيّة، وفوق بعضهما قائمةً. */
function Split({ across, preview, controls }: { across: boolean; preview: React.ReactNode; controls: React.ReactNode }) {
  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingTop: 14 }}>
      {across ? (
        <View style={{ flexDirection: "row", gap: 16, alignItems: "flex-start" }}>
          <View style={{ flex: 1, minWidth: 0 }}>{preview}</View>
          <View style={{ flex: 1, minWidth: 0, gap: 12 }}>{controls}</View>
        </View>
      ) : (
        <View style={{ gap: 14 }}>
          {preview}
          {controls}
        </View>
      )}
    </ScrollView>
  );
}

function MoodBody() {
  const moods = useMoods().data ?? FALLBACK_MOODS;
  const { across, sheetWidth } = useLayout();
  // أوّلُ مودٍ مختارٌ من أوّل لحظة: معاينةٌ فارغة لا تُري ما يُختار.
  const [picked, setPicked] = useState<string>(moods[0]?.id ?? "");
  const [text, setText] = useState("");
  const { busy, error, post } = usePost();
  useEffect(() => {
    if (!moods.some((m) => m.id === picked) && moods[0]) setPicked(moods[0].id);
  }, [moods, picked]);
  const mood = moods.find((m) => m.id === picked) ?? moods[0];

  const preview = mood ? (
    <MoodArt mood={mood} text={text.trim() || null} style={{ aspectRatio: across ? 1.1 : 1.45, borderRadius: 22 }} />
  ) : null;

  const controls = (
    <>
      {/* المودات صفٌّ يُمرَّر يميناً ويساراً، والمختارُ مضيءٌ باللمسة (القاعدة ٤٣٣). */}
      <RtlStrip contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
        {moods.map((m) => {
          const on = m.id === mood?.id;
          return (
            <Pressable
              key={m.id}
              accessibilityLabel={m.name}
              accessibilityState={{ selected: on }}
              onPress={() => setPicked(m.id)}
              style={{
                width: 66,
                paddingVertical: 8,
                borderRadius: 18,
                alignItems: "center",
                gap: 2,
                direction: "rtl",
                backgroundColor: on ? colors.clay : "rgba(255,255,255,.08)",
                borderWidth: 1,
                borderColor: on ? colors.clay : "rgba(255,255,255,.12)",
                transform: [{ scale: on ? 1.04 : 1 }],
              }}
            >
              <Text style={{ fontSize: 28, lineHeight: 34 }}>{m.emoji}</Text>
              <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: "700", color: on ? colors.onBrand : "rgba(255,255,255,.85)" }}>
                {m.name}
              </Text>
            </Pressable>
          );
        })}
      </RtlStrip>
      <View>
        <TextInput
          value={text}
          onChangeText={(value) => setText(value.slice(0, MOOD_TEXT_MAX))}
          placeholder="عبارة قصيرة (اختياري)…"
          placeholderTextColor="rgba(255,255,255,.45)"
          accessibilityLabel="عبارة المود"
          style={field}
        />
        <Text style={{ color: "rgba(255,255,255,.5)", fontSize: 11, textAlign: "left", marginTop: 4 }}>
          {ar(text.length)} / {ar(MOOD_TEXT_MAX)}
        </Text>
      </View>
      {error ? <Text style={{ color: "#FF9C84", fontSize: 12.5, textAlign: "center" }}>{error}</Text> : null}
      <PostButton
        label="انشر المود"
        ready={Boolean(mood)}
        busy={busy}
        onPress={() => void post({ kind: "MOOD", moodId: mood?.id, text: text.trim() || undefined })}
      />
    </>
  );

  return (
    <GlassSheet
      icon={<Image source={MOOD_ART} style={{ width: 26, height: 26 }} resizeMode="contain" />}
      title="وش مودك؟"
      subtitle="شارك مودك مع دائرتك"
      onClose={close}
      centered
      width={sheetWidth}
    >
      <Split across={across} preview={preview} controls={controls} />
    </GlassSheet>
  );
}

function QuestionBody() {
  const { across, sheetWidth } = useLayout();
  const [text, setText] = useState("");
  const [mine, setMine] = useState(false);
  const { busy, error, post } = usePost();

  // معاينةُ بطاقة السؤال كما تراها الدائرة: عنوانُها، وما يُكتب، وسطرُ الخصوصيّة.
  const preview = (
    <View style={{ borderRadius: 22, backgroundColor: colors.card, padding: 16, gap: 8, borderWidth: 1, borderColor: colors.line }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Image source={QUESTION_ART} style={{ width: 18, height: 18 }} resizeMode="contain" />
        <Text style={{ color: colors.clayInk, fontSize: 12, fontWeight: "700" }}>سؤال لدائرتك</Text>
      </View>
      <Text style={{ color: text.trim() ? colors.ink : colors.faint, fontSize: 16, lineHeight: 26, fontWeight: "600" }}>
        {text.trim() || "سؤالك يظهر هنا…"}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
        {mine ? <PrivateIcon size={12} color={colors.muted} /> : null}
        <Text style={{ color: colors.muted, fontSize: 11.5 }}>
          {mine ? "الإجابات لك وحدك — كلٌّ يرى إجابته" : "الإجابات ظاهرة لكل من يرى السؤال"}
        </Text>
      </View>
      <View
        style={{
          alignSelf: "flex-start",
          paddingHorizontal: 14,
          height: 32,
          borderRadius: 16,
          justifyContent: "center",
          backgroundColor: colors.claySoft,
          borderWidth: 1,
          borderColor: colors.clay,
        }}
      >
        <Text style={{ color: colors.clayInk, fontSize: 12, fontWeight: "700" }}>أضف إجابتك</Text>
      </View>
    </View>
  );

  const controls = (
    <>
      <View>
        <TextInput
          value={text}
          onChangeText={(value) => setText(value.slice(0, MOMENT_TEXT_MAX))}
          autoFocus
          multiline
          placeholder="وش تبي تسأل؟"
          placeholderTextColor="rgba(255,255,255,.45)"
          accessibilityLabel="السؤال"
          style={{ ...field, minHeight: 84, maxHeight: 160, textAlignVertical: "top" }}
        />
        <Text style={{ color: "rgba(255,255,255,.5)", fontSize: 11, textAlign: "left", marginTop: 4 }}>
          {ar(text.length)} / {ar(MOMENT_TEXT_MAX)}
        </Text>
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          padding: 12,
          borderRadius: 16,
          backgroundColor: "rgba(255,255,255,.08)",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,.12)",
        }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: "#fff", fontSize: 13.5, fontWeight: "700" }}>الإجابات لي وحدي</Text>
          <Text style={{ color: "rgba(255,255,255,.6)", fontSize: 11.5, marginTop: 2 }}>كلٌّ يرى إجابته وأنت ترى الكل</Text>
        </View>
        <Switch value={mine} onValueChange={setMine} trackColor={{ true: colors.clay }} />
      </View>
      {error ? <Text style={{ color: "#FF9C84", fontSize: 12.5, textAlign: "center" }}>{error}</Text> : null}
      <PostButton
        label="انشر السؤال"
        ready={text.trim().length > 0}
        busy={busy}
        onPress={() => void post({ kind: "QUESTION", text: text.trim(), answersPrivate: mine })}
      />
    </>
  );

  return (
    <GlassSheet
      icon={<Image source={QUESTION_ART} style={{ width: 26, height: 26 }} resizeMode="contain" />}
      title="اسأل دائرتك"
      subtitle="الإجابات تُكتب في التعليقات"
      onClose={close}
      centered
      width={sheetWidth}
    >
      <Split across={across} preview={preview} controls={controls} />
    </GlassSheet>
  );
}
