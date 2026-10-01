import { useState } from "react";
import { View, Pressable, ScrollView, Image, ActivityIndicator, Dimensions } from "react-native";
import { Text } from "../../components/type";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import * as Picker from "expo-image-picker";
import { useQueryClient } from "@tanstack/react-query";
import { ScreenHeader } from "../../components/screen-header";
import { Filtered } from "../../components/filtered";
import { StoryVideo } from "../../components/story-video";
import { FILTERS } from "../../lib/filters";
import { api } from "../../lib/api";
import { uploadFile } from "../../lib/upload";
import { ar } from "../../lib/format";
import { STORY_SECONDS, STORY_TEXTS, type StoryText } from "@athar/shared";
import { EditableTexts, TextEditor, freshText } from "../../components/story-texts";
import { SourceSheet } from "../../components/source-sheet";
import { takeShot } from "../../lib/capture";
import { colors } from "../../theme/tokens";

/** أقصى مدّة لفيديو القصة — نفس حدّ الخادم. */

type Draft = {
  uri: string;
  mime: string;
  width: number;
  height: number;
  video: boolean;
  seconds: number;
};

/**
 * ناشر القصة: الاختيار ثم المعاينة والفلتر ثم النشر — لا رفعٌ فوريّ.
 *
 * والفلتر يُختار على المعاينة نفسها: اختيارُه من قائمةِ أسماءٍ بلا رؤية
 * تخمينٌ لا اختيار.
 */
export default function NewStory() {
  const router = useRouter();
  const client = useQueryClient();

  const [draft, setDraft] = useState<Draft | null>(null);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [texts, setTexts] = useState<StoryText[]>([]);
  // ما يُحرَّر الآن: نصٌّ قائم برقمه، أو «جديد»، أو لا شيء.
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [dragging, setDragging] = useState(false);

  const screen = Dimensions.get("window");
  /*
    اللوحةُ بنسبة الشاشة نفسها: النصُّ يُحفظ بموضعه نسبةً منها، والعارضُ
    يرسمه نسبةً من الشاشة كلّها — لوحةٌ بنسبةٍ أخرى تُزيحه عن مكانه.
  */
  const previewHeight = Math.min(520, screen.height * 0.58);
  const previewWidth = Math.min(screen.width - 40, (previewHeight * screen.width) / screen.height);

  /* العودة من الكاميرا — صورةً كانت أو مقطعاً. */
  useFocusEffect(() => {
    const shot = takeShot();
    if (!shot) return;
    setDraft({
      uri: shot.uri,
      mime: shot.mime,
      width: shot.width,
      height: shot.height,
      video: shot.video,
      seconds: shot.seconds,
    });
    if (shot.video) setFilter("");
  });

  async function pick() {
    setAsking(false);
    setError(null);
    const granted = await Picker.requestMediaLibraryPermissionsAsync();
    if (!granted.granted) {
      setError("لازم تسمح بالوصول لألبومك.");
      return;
    }

    const result = await Picker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      quality: 0.85,
      videoMaxDuration: STORY_SECONDS,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const video = (asset.type ?? "image") === "video";
    const seconds = video ? Math.round((asset.duration ?? 0) / 1000) : 0;

    // الحدّ يُقال هنا لا بعد الرفع: من صوّر ثلاثين ثانيةً يعرف قبل أن ينتظر.
    if (video && seconds > STORY_SECONDS) {
      setError(`الحدّ ${ar(STORY_SECONDS)} ثانية — هذا ${ar(seconds)}`);
      return;
    }

    setDraft({
      uri: asset.uri,
      mime: asset.mimeType ?? (video ? "video/mp4" : "image/jpeg"),
      width: asset.width,
      height: asset.height,
      video,
      seconds,
    });
    if (video) setFilter("");
  }

  async function publish() {
    if (!draft || busy) return;
    setBusy(true);
    setError(null);

    try {
      const mediaId = await uploadFile(draft.uri, draft.mime, "STORY", draft);
      await api("/v1/stories", {
        method: "POST",
        body: JSON.stringify({
          mediaId,
          filter: filter || undefined,
          seconds: draft.video ? draft.seconds : undefined,
          texts: texts.length ? texts : undefined,
        }),
      });
      await client.invalidateQueries({ queryKey: ["stories"] });
      router.back();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "تعذّر النشر");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: colors.ground }}>
      <ScreenHeader title="قصة" back="/circle" />

      <ScrollView scrollEnabled={!dragging} contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 16 }}>
        <View
          style={{
            alignSelf: "center",
            width: previewWidth,
            height: previewHeight,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: colors.line,
            backgroundColor: "#0b1219",
            overflow: "hidden",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 14,
          }}
        >
          {draft ? (
            draft.video ? (
              /* المقطع يُشغَّل ويُعاد قبل أن يُرسل — لا صورةٌ ساكنة منه. */
              <StoryVideo source={draft.uri} local width={previewWidth} height={previewHeight} />
            ) : !filter ? (
              <Image source={{ uri: draft.uri }} style={{ width: "100%", height: "100%" }} resizeMode="contain" />
            ) : (
              <LocalFiltered uri={draft.uri} filter={filter} width={previewWidth} height={previewHeight} />
            )
          ) : (
            <Text style={{ color: "rgba(255,255,255,.6)", fontSize: 12.5 }}>ما اخترت شي بعد</Text>
          )}

          {draft ? (
            <EditableTexts
              texts={texts}
              width={previewWidth}
              height={previewHeight}
              onChange={(index, next) => setTexts((all) => all.map((item, i) => (i === index ? next : item)))}
              onEdit={(index) => setEditing(index)}
              onActive={setDragging}
            />
          ) : null}
        </View>

        <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
          <Pressable
            onPress={() => setAsking(true)}
            style={{ flex: 1, height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card }}
          >
            <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "600" }}>
              {draft ? "غيّر" : "صورة أو فيديو"}
            </Text>
          </Pressable>
          {draft ? (
            <Pressable
              accessibilityLabel="أضف نصاً"
              disabled={texts.length >= STORY_TEXTS}
              onPress={() => setEditing("new")}
              style={{
                flex: 1,
                height: 46,
                borderRadius: 12,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: colors.line,
                backgroundColor: colors.card,
                opacity: texts.length >= STORY_TEXTS ? 0.45 : 1,
              }}
            >
              <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "700" }}>Aa  نص</Text>
            </Pressable>
          ) : null}
        </View>
        {texts.length ? (
          <Text style={{ color: colors.faint, fontSize: 11, textAlign: "center", marginTop: -6, marginBottom: 12 }}>
            اسحب النصّ لتحريكه، وكبّره بإصبعين، واضغطه لتعديله
          </Text>
        ) : null}

        {draft && draft.video ? (
          <Text style={{ color: colors.muted, fontSize: 11.5, lineHeight: 21 }}>
            فيديو {ar(draft.seconds)} ثانية · الحدّ {ar(STORY_SECONDS)}
            {"\n"}الفلاتر للصور — المقطع يُنشر كما صُوِّر.
          </Text>
        ) : draft ? (
          <>
            <Text style={{ color: colors.faint, fontSize: 11.5, fontWeight: "600", marginBottom: 10 }}>
              فلتر
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row", gap: 8, paddingBottom: 6 }}>
              {FILTERS.map((item) => {
                const on = filter === item.key;
                return (
                  <Pressable
                    key={item.key || "none"}
                    onPress={() => setFilter(item.key)}
                    style={{
                      paddingHorizontal: 16,
                      minHeight: 40,
                      justifyContent: "center",
                      borderRadius: 999,
                      borderWidth: 1,
                      backgroundColor: on ? colors.claySoft : colors.card,
                      borderColor: on ? colors.clay : colors.line,
                    }}
                  >
                    <Text style={{ fontSize: 12.5, color: on ? colors.clayInk : colors.ink }}>
                      {item.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        ) : null}

        {error ? (
          <Text accessibilityRole="alert" style={{ color: colors.live, fontSize: 12.5, marginTop: 14 }}>
            {error}
          </Text>
        ) : null}
      </ScrollView>

      <View style={{ paddingHorizontal: 20, paddingBottom: 26 }}>
        <Text style={{ color: colors.faint, fontSize: 11, textAlign: "center", marginBottom: 12 }}>
          تذهب بعد ٢٤ ساعة — من كل مكان
        </Text>
        <Pressable
          onPress={publish}
          disabled={!draft || busy}
          style={{
            height: 54,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.clay,
            opacity: !draft || busy ? 0.45 : 1,
          }}
        >
          {busy ? (
            <ActivityIndicator color={colors.onBrand} />
          ) : (
            <Text style={{ color: colors.onBrand, fontSize: 15.5, fontWeight: "700" }}>انشر</Text>
          )}
        </Pressable>
      </View>

      {editing !== null ? (
        <TextEditor
          initial={editing === "new" ? freshText() : texts[editing]!}
          onDone={(next) => {
            if (editing === "new") {
              if (next) setTexts((all) => [...all, next]);
            } else {
              setTexts((all) =>
                next ? all.map((item, i) => (i === editing ? next : item)) : all.filter((_, i) => i !== editing),
              );
            }
            setEditing(null);
          }}
          onDelete={
            editing === "new"
              ? undefined
              : () => {
                  setTexts((all) => all.filter((_, i) => i !== editing));
                  setEditing(null);
                }
          }
        />
      ) : null}

      {/*
        القصة تقبل الاثنين، فبابا الكاميرا اثنان: صورةٌ ومقطع. وسؤالٌ
        واحد بثلاثة خيارات أوضح من شاشةِ كاميرا تُبدّل وضعها في داخلها —
        من فتحها ليصوّر مقطعاً لا يبحث عن مفتاحٍ يحوّلها.
      */}
      <SourceSheet
        open={asking}
        title="قصّتك من أين؟"
        onClose={() => setAsking(false)}
        onCamera={() => {
          setAsking(false);
          router.push("/camera?mode=picture" as never);
        }}
        onVideo={() => {
          setAsking(false);
          router.push(`/camera?mode=video&seconds=${STORY_SECONDS}` as never);
        }}
        onLibrary={() => void pick()}
      />
    </SafeAreaView>
  );
}

/** معاينةُ ملفٍّ محليّ بفلتره — قبل الرفع، فلا معرّف له بعد. */
function LocalFiltered({
  uri,
  filter,
  width,
  height,
}: {
  uri: string;
  filter: string;
  width: number;
  height: number;
}) {
  return <Filtered mediaId={uri} filter={filter} width={width} height={height} local />;
}
