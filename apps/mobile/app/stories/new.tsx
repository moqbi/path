import { useState } from "react";
import { View, Pressable, ScrollView, Image, ActivityIndicator, Dimensions } from "react-native";
import { Text } from "../../components/type";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import * as Picker from "expo-image-picker";
import { useQueryClient } from "@tanstack/react-query";
import { ScreenHeader } from "../../components/screen-header";
import { FilterStrip, Filtered } from "../../components/filtered";
import { StoryVideo } from "../../components/story-video";
import { api } from "../../lib/api";
import { uploadFile } from "../../lib/upload";
import { ar } from "../../lib/format";
import { STORY_SECONDS, STORY_STICKERS, STORY_TEXTS, STORY_TIME_STYLES, type StorySticker, type StoryText } from "@athar/shared";
import { EditableStickers, StickerFace, TIME_STYLE_NAMES } from "../../components/story-stickers";
import { StoryPlaceSheet } from "../../components/story-place-sheet";
import { StorySound, type SoundChoice } from "../../components/story-sound";
import { EditableTexts, TextEditor, freshText } from "../../components/story-texts";
import { SourceSheet } from "../../components/source-sheet";
import { takeShot } from "../../lib/capture";
import { colors } from "../../theme/tokens";
import { ClockIcon, CloseIcon, LockIcon, MusicIcon, PinIcon, StickerIcon, TrashIcon } from "../../components/icons";
import { PeopleSheet, PickerButton, type Friend } from "../../components/people-sheet";
import { useCircle } from "../../lib/queries";

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
  /*
    مين يشوفها (القاعدة ٢١٩): دائرتُك كلّها، أو أشخاصٌ تختارهم فتصير خاصّةً
    بقفلٍ عليها. والاختيارُ في نافذة البحث نفسها التي في «مع مين؟» (القاعدة ٦٧).
  */
  const circle = useCircle();
  const friends: Friend[] = circle.data?.members ?? [];
  const [only, setOnly] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [choosing, setChoosing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [texts, setTexts] = useState<StoryText[]>([]);
  // ما يُحرَّر الآن: نصٌّ قائم برقمه، أو «جديد»، أو لا شيء.
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [dragging, setDragging] = useState(false);
  /*
    الملصقاتُ (القاعدة ٢٣٨): موقعٌ ووقتٌ وموسيقى. والموسيقى ملصقٌ وصوتٌ معاً —
    الصوتُ يُختار ويُقصّ في `StorySound`، والملصقُ ما يراه المشاهدُ ويضغطه.
  */
  const [stickers, setStickers] = useState<StorySticker[]>([]);
  const [tray, setTray] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [sounding, setSounding] = useState(false);
  const [sound, setSound] = useState<SoundChoice | null>(null);
  const [stickerAt, setStickerAt] = useState<number | null>(null);

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
    if (shot.video) dropSound();
  });

  /** المقطعُ له صوتُه: صوتُ القصّة وملصقُه للصور وحدها. */
  function dropSound() {
    setFilter("");
    setSound(null);
    setStickers((all) => all.filter((item) => item.kind !== "music"));
  }

  const hasMusic = stickers.some((item) => item.kind === "music");
  const full = stickers.length >= STORY_STICKERS;

  function addSticker(item: StorySticker) {
    setStickers((all) => (all.length >= STORY_STICKERS ? all : [...all, item]));
  }

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
    if (video) dropSound();
  }

  async function publish() {
    if (!draft || busy) return;
    if (only && picked.length === 0) {
      setError("اختر مين يشوفها، أو خلّها لأصدقائك كلهم.");
      return;
    }
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
          audience: only ? picked : undefined,
          stickers: stickers.length ? stickers : undefined,
          audio: sound && !draft.video ? { mediaId: sound.mediaId, start: sound.start, end: sound.end } : undefined,
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

          {draft ? (
            <EditableStickers
              stickers={stickers}
              width={previewWidth}
              height={previewHeight}
              onChange={(index, next) => setStickers((all) => all.map((item, i) => (i === index ? next : item)))}
              onEdit={(index) => {
                if (stickers[index]?.kind === "music") setSounding(true);
                else setStickerAt(index);
              }}
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
          {draft ? (
            <Pressable
              accessibilityLabel="أضف ملصقاً"
              disabled={full}
              onPress={() => setTray(true)}
              style={{
                flex: 1,
                height: 46,
                borderRadius: 12,
                flexDirection: "row",
                gap: 6,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: colors.line,
                backgroundColor: colors.card,
                opacity: full ? 0.45 : 1,
              }}
            >
              <StickerIcon size={17} color={colors.ink} />
              <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "700" }}>ملصق</Text>
            </Pressable>
          ) : null}
        </View>
        {texts.length || stickers.length ? (
          <Text style={{ color: colors.faint, fontSize: 11, textAlign: "center", marginTop: -6, marginBottom: 12 }}>
            اسحب النصّ أو الملصق لتحريكه، وكبّره بإصبعين، واضغطه لتعديله
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
            <FilterStrip uri={draft.uri} value={filter} onChange={setFilter} />
          </>
        ) : null}

        {error ? (
          <Text accessibilityRole="alert" style={{ color: colors.live, fontSize: 12.5, marginTop: 14 }}>
            {error}
          </Text>
        ) : null}
      </ScrollView>

      <View style={{ paddingHorizontal: 20, paddingBottom: 26 }}>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
          {[
            { key: false, label: "أصدقائي كلهم" },
            { key: true, label: "قصة خاصة" },
          ].map((option) => {
            const on = only === option.key;
            return (
              <Pressable
                key={option.label}
                onPress={() => {
                  setOnly(option.key);
                  if (option.key && picked.length === 0) setChoosing(true);
                }}
                style={{
                  flex: 1,
                  height: 40,
                  borderRadius: 999,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  borderWidth: 1,
                  borderColor: on ? colors.clay : colors.line,
                  backgroundColor: on ? colors.claySoft : colors.card,
                }}
              >
                {option.key ? <LockIcon size={14} color={on ? colors.clayInk : colors.muted} /> : null}
                <Text style={{ color: on ? colors.clayInk : colors.ink2, fontSize: 13, fontWeight: on ? "700" : "500" }}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {only ? (
          <View style={{ marginBottom: 10 }}>
            <PickerButton
              label={picked.length ? `يشوفها ${ar(picked.length)} من أصدقائك` : "اختر مين يشوفها"}
              count={picked.length}
              onOpen={() => setChoosing(true)}
            />
          </View>
        ) : null}
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

      {choosing ? (
        <PeopleSheet
          title="مين يشوف القصة؟"
          friends={friends}
          picked={picked}
          onToggle={(id) => setPicked((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]))}
          onClose={() => setChoosing(false)}
        />
      ) : null}

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

      {tray ? (
        <StickerTray
          video={Boolean(draft?.video)}
          hasMusic={hasMusic}
          onClose={() => setTray(false)}
          onPick={(kind) => {
            setTray(false);
            if (kind === "time") addSticker({ kind: "time", x: 0.5, y: 0.22, scale: 1, style: "digital" });
            else if (kind === "place") setPlacing(true);
            else setSounding(true);
          }}
        />
      ) : null}

      {placing ? (
        <StoryPlaceSheet
          onClose={() => setPlacing(false)}
          onPick={(place) => {
            setPlacing(false);
            addSticker({ kind: "place", x: 0.5, y: 0.72, scale: 1, ...place });
          }}
        />
      ) : null}

      {sounding ? (
        <StorySound
          initial={sound}
          onClose={() => setSounding(false)}
          onRemove={
            sound
              ? () => {
                  setSound(null);
                  setStickers((all) => all.filter((item) => item.kind !== "music"));
                  setSounding(false);
                }
              : undefined
          }
          onDone={(choice) => {
            setSound(choice);
            setSounding(false);
            setStickers((all) => {
              const label = choice.label || undefined;
              if (all.some((item) => item.kind === "music")) {
                return all.map((item) => (item.kind === "music" ? { ...item, label } : item));
              }
              return all.length >= STORY_STICKERS ? all : [...all, { kind: "music", x: 0.5, y: 0.86, scale: 1, label }];
            });
          }}
        />
      ) : null}

      {stickerAt !== null && stickers[stickerAt] ? (
        <StickerEditor
          item={stickers[stickerAt]!}
          onChange={(next) => setStickers((all) => all.map((item, i) => (i === stickerAt ? next : item)))}
          onReplace={() => {
            setStickers((all) => all.filter((_, i) => i !== stickerAt));
            setStickerAt(null);
            setPlacing(true);
          }}
          onDelete={() => {
            setStickers((all) => all.filter((_, i) => i !== stickerAt));
            setStickerAt(null);
          }}
          onClose={() => setStickerAt(null)}
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

/**
 * دُرجُ الملصقات: الموقعُ والوقتُ والموسيقى — والموسيقى للصور وحدها (المقطعُ له
 * صوتُه) ومرّةً واحدة (صوتٌ واحد للقصّة).
 */
function StickerTray({
  video,
  hasMusic,
  onPick,
  onClose,
}: {
  video: boolean;
  hasMusic: boolean;
  onPick: (kind: "place" | "time" | "music") => void;
  onClose: () => void;
}) {
  const options = [
    { kind: "place" as const, label: "الموقع", hint: "وين أنت الحين", icon: <PinIcon size={22} color="#fff" />, tint: "#FF7A5A", off: false },
    { kind: "time" as const, label: "الوقت", hint: "بأشكال تختارها", icon: <ClockIcon size={22} color="#fff" />, tint: "#0984E3", off: false },
    {
      kind: "music" as const,
      label: "موسيقى",
      hint: video ? "للصور فقط — المقطع له صوته" : hasMusic ? "أضفتها — اضغط الملصق لتعديله" : "صوت من مقطع في الاستديو",
      icon: <MusicIcon size={22} color="#fff" />,
      tint: "#6C5CE7",
      off: video || hasMusic,
    },
  ];
  return (
    <Pressable onPress={onClose} style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(8,13,18,.55)", justifyContent: "flex-end" }}>
      <Pressable onPress={() => {}} style={{ backgroundColor: colors.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, paddingBottom: 34 }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}>
          <Text style={{ flex: 1, color: colors.ink, fontSize: 16, fontWeight: "800" }}>ملصق</Text>
          <Pressable accessibilityLabel="إغلاق" onPress={onClose} hitSlop={10}>
            <CloseIcon size={18} color={colors.muted} />
          </Pressable>
        </View>
        {options.map((option) => (
          <Pressable
            key={option.kind}
            disabled={option.off}
            onPress={() => onPick(option.kind)}
            style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 10, opacity: option.off ? 0.45 : 1 }}
          >
            <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: option.tint, alignItems: "center", justifyContent: "center" }}>
              {option.icon}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "700" }}>{option.label}</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>{option.hint}</Text>
            </View>
          </Pressable>
        ))}
      </Pressable>
    </Pressable>
  );
}

/** خياراتُ ملصقٍ على اللوحة: الوقتُ يختار شكله، والموقعُ يُبدَّل، وكلاهما يُحذف. */
function StickerEditor({
  item,
  onChange,
  onReplace,
  onDelete,
  onClose,
}: {
  item: StorySticker;
  onChange: (next: StorySticker) => void;
  onReplace: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [now] = useState(() => new Date());
  return (
    <Pressable onPress={onClose} style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(8,13,18,.55)", justifyContent: "flex-end" }}>
      <Pressable onPress={() => {}} style={{ backgroundColor: "#16222D", borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, paddingBottom: 34 }}>
        {item.kind === "time" ? (
          <>
            <Text style={{ color: "#fff", fontSize: 15, fontWeight: "800", marginBottom: 12 }}>شكل الوقت</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 6 }}>
              {STORY_TIME_STYLES.map((style) => {
                const on = item.style === style;
                return (
                  <Pressable
                    key={style}
                    onPress={() => onChange({ ...item, style })}
                    style={{
                      width: 118,
                      height: 104,
                      borderRadius: 16,
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      backgroundColor: "#2A3A48",
                      borderWidth: 2,
                      borderColor: on ? "#F6B93B" : "transparent",
                    }}
                  >
                    <View style={{ height: 66, justifyContent: "center" }}>
                      <StickerFace item={{ ...item, style }} k={0.72} at={now} />
                    </View>
                    <Text style={{ color: on ? "#F6B93B" : "rgba(255,255,255,.75)", fontSize: 11.5, fontWeight: "700" }}>
                      {TIME_STYLE_NAMES[style]}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        ) : item.kind === "place" ? (
          <Pressable onPress={onReplace} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 }}>
            <PinIcon size={18} color="#fff" />
            <Text style={{ color: "#fff", fontSize: 14.5, fontWeight: "700" }}>غيّر المكان</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={onDelete} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, marginTop: 4 }}>
          <TrashIcon size={18} color="#FF7A5A" />
          <Text style={{ color: "#FF7A5A", fontSize: 14.5, fontWeight: "700" }}>احذف الملصق</Text>
        </Pressable>
      </Pressable>
    </Pressable>
  );
}
