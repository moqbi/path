import { Spinner } from "../../components/spinner";
import { useState } from "react";
import { View, Pressable, ScrollView, Image, Dimensions } from "react-native";
import { Text } from "../../components/type";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Svg, { Circle } from "react-native-svg";
import * as Picker from "expo-image-picker";
import { useQueryClient } from "@tanstack/react-query";
import { FilterStrip, Filtered } from "../../components/filtered";
import { StoryVideo } from "../../components/story-video";
import { api } from "../../lib/api";
import { uploadFile, uploadStoryVideo } from "../../lib/upload";
import { VideoWindowBar, VideoWindowPreview } from "../../components/video-window";
import { ar } from "../../lib/format";
import { STORY_SECONDS, STORY_VIDEO_SOURCE, STORY_STICKERS, STORY_TEXTS, STORY_TIME_STYLES, type StorySticker, type StoryText } from "@athar/shared";
import { EditableStickers, StickerFace, TIME_STYLE_NAMES } from "../../components/story-stickers";
import { StoryPlaceSheet } from "../../components/story-place-sheet";
import { StorySound, type SoundChoice } from "../../components/story-sound";
import { SongPicker } from "../../components/song-picker";
import type { Track } from "../../lib/status-notes";
import { EditableTexts, TextEditor, freshText } from "../../components/story-texts";
import { StoryCamera, GlassPill, SendMark, disc } from "../../components/story-camera";
import { colors } from "../../theme/tokens";
import { ClockIcon, CloseIcon, LockIcon, MusicIcon, PinIcon, SpeakerIcon, StickerIcon, TrashIcon } from "../../components/icons";
import { PeopleSheet, type Friend } from "../../components/people-sheet";
import { FramedMedia, NO_FRAME, fitFrame, useFrameGesture, type StoryFrame } from "../../components/story-frame";
import { DEV_FEATURES } from "../../lib/dev-features";
import { useCircle } from "../../lib/queries";

/** أقصى مدّة لفيديو القصة — نفس حدّ الخادم. */

type Draft = {
  uri: string;
  mime: string;
  width: number;
  height: number;
  video: boolean;
  seconds: number;
  /** أوّلُ النافذة المختارة من مقطعٍ أطول من الحدّ (القاعدة ٢٤٩). */
  start: number;
};

/**
 * ناشر القصة (القاعدة ٢٧٠) — **بقرار المالك**: يفتح على الكاميرا مباشرةً، وفي
 * أسفلها شريطٌ زجاجيّ لصورةٍ أو فيديو وبجانب الغالق المعرض. واللقطةُ تصير
 * محرّراً بملء الشاشة في المكان نفسه: النصُّ والملصقُ والفلترُ والموسيقى أدواتٌ
 * في الطرف، والجمهورُ وسهمُ النشر في شريطٍ زجاجيّ أسفله. لا رفعٌ فوريّ
 * (القاعدة ٩٦): المحرّرُ هو المعاينة.
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
  const [panel, setPanel] = useState<"filter" | null>(null);
  const insets = useSafeAreaInsets();
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
  /*
    أو أغنيةٌ من القائمة نفسها التي في النوت (القاعدة ٢٧٧) — **بقرار المالك**: الموسيقى
    بابان، صوتٌ خاصّ من فيديو في الاستديو أو أغنيةٌ من دِيزر، وصاحبُها يختار.
  */
  const [song, setSong] = useState<{ track: Track; start: number; full: boolean; seconds: number } | null>(null);
  const [songPicking, setSongPicking] = useState(false);
  const [musicMenu, setMusicMenu] = useState(false);
  /** صوتُ المقطع نفسه: يُكتم بزرّ، ومع الموسيقى يُكتم افتراضاً ويُعاد بالزرّ نفسه. */
  const [muteVideo, setMuteVideo] = useState(false);
  /** بابُ الموسيقى: ما اختير يُفتح لتعديله، ولا شيءَ بعدُ يسأل من أين. */
  function openMusic() {
    // الصوتُ الخاصّ يُفتح على شريطه (وفيه حذفُه)، والأغنيةُ والفراغُ على البابين.
    if (sound) setSounding(true);
    else setMusicMenu(true);
  }
  /** ملصقُ الموسيقى يحمل اسمَ ما يُسمع. */
  function musicSticker(label: string | undefined) {
    setStickers((all) => {
      if (all.some((item) => item.kind === "music")) {
        return all.map((item) => (item.kind === "music" ? { ...item, label } : item));
      }
      return all.length >= STORY_STICKERS ? all : [...all, { kind: "music", x: 0.5, y: 0.86, scale: 1, label }];
    });
  }
  const [stickerAt, setStickerAt] = useState<number | null>(null);

  const screen = Dimensions.get("window");
  /*
    القصّةُ بملء الشاشة، وصاحبُها يقرّب صورتها ويبعدها ويسحبها (القاعدة ٢٩٦) — في نسخة
    التطوير وحدها حتى تُجرَّب.
  */
  const [frame, setFrame] = useState<StoryFrame>(NO_FRAME);
  // الموضعُ الذي تبدأ منه الصورة — كاملةً إن خالفت نسبةَ الشاشة — وإليه تعود بنقرتين.
  const [home, setHome] = useState<StoryFrame>(NO_FRAME);
  const frameGesture = useFrameGesture(frame, setFrame, screen.width, screen.height, home);

  /**
   * المقطعُ: الفلاترُ للصور وحدها (القاعدة ١٣١). والموسيقى تبقى — **بقرار المالك**
   * (القاعدة ٢٧٧) تُضاف إلى الفيديو كالصورة، ومعها زرُّ كتم صوته.
   */
  function dropSound() {
    setFilter("");
  }

  const hasMusic = stickers.some((item) => item.kind === "music");
  const full = stickers.length >= STORY_STICKERS;

  function addSticker(item: StorySticker) {
    setStickers((all) => (all.length >= STORY_STICKERS ? all : [...all, item]));
  }

  async function pick() {
    setError(null);
    const granted = await Picker.requestMediaLibraryPermissionsAsync();
    if (!granted.granted) {
      setError("لازم تسمح بالوصول لألبومك.");
      return;
    }

    const result = await Picker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      quality: 0.85,
      // آبل تُصدّر المقطع بدقّة ٧٢٠ فيصغر الرفع؛ والقصُّ والضغطُ على الخادم.
      videoExportPreset: Picker.VideoExportPreset.H264_1280x720,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const video = (asset.type ?? "image") === "video";
    const seconds = video ? Math.round((asset.duration ?? 0) / 1000) : 0;

    // الأطولُ من الحدّ لا يُردّ: يُختار منه ثلاثون ثانيةً بشريط القصّ (القاعدة ٢٤٩).
    if (video && seconds > STORY_VIDEO_SOURCE.seconds) {
      setError(`المقطع طويل جداً — اختر مقطعاً أقصر من ${ar(STORY_VIDEO_SOURCE.seconds / 60)} دقائق`);
      return;
    }

    setDraft({
      uri: asset.uri,
      mime: asset.mimeType ?? (video ? "video/mp4" : "image/jpeg"),
      width: asset.width,
      height: asset.height,
      video,
      seconds,
      start: 0,
    });
    // من الاستديو بنسبةٍ أخرى: كاملةً لا مقصوصة (القاعدة ٣٠٢).
    const fit = fitFrame(asset.width, asset.height, screen.width, screen.height);
    setHome(fit);
    setFrame(fit);
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
      // المقطعُ يُقصّ ويُضغط على الخادم، ومدّتُه ما خرج لا ما اختير.
      let mediaId: string;
      let seconds = draft.seconds;
      if (draft.video) {
        const done = await uploadStoryVideo(draft.uri, draft.mime, draft.start, draft);
        mediaId = done.mediaId;
        seconds = done.seconds || Math.min(draft.seconds, STORY_SECONDS);
      } else {
        mediaId = await uploadFile(draft.uri, draft.mime, "STORY", draft);
      }
      await api("/v1/stories", {
        method: "POST",
        body: JSON.stringify({
          mediaId,
          filter: filter || undefined,
          seconds: draft.video ? Math.max(1, Math.round(seconds)) : undefined,
          texts: texts.length ? texts : undefined,
          audience: only ? picked : undefined,
          stickers: stickers.length ? stickers : undefined,
          audio: sound ? { mediaId: sound.mediaId, start: sound.start, end: sound.end } : undefined,
          track: song && !sound ? { id: song.track.id, start: song.start, seconds: song.seconds, full: song.full } : undefined,
          muted: draft.video && muteVideo ? true : undefined,
          frame: DEV_FEATURES && (frame.z !== 1 || frame.x || frame.y) ? frame : undefined,
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

  // بلا لقطةٍ: الكاميرا نفسها — لا صفحةٌ قبلها (القاعدة ٢٧٠).
  if (!draft) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <StoryCamera
          limit={STORY_SECONDS}
          onClose={() => router.back()}
          onLibrary={() => void pick()}
          onShot={(shot) => {
            setError(null);
            setDraft({ ...shot, start: 0 });
            if (shot.video) dropSound();
          }}
        />
        {error ? (
          <Text accessibilityRole="alert" style={{ position: "absolute", top: insets.top + 64, left: 20, right: 20, color: "#fff", backgroundColor: colors.live, borderRadius: 12, padding: 10, fontSize: 12.5, textAlign: "center", overflow: "hidden" }}>
            {error}
          </Text>
        ) : null}
      </View>
    );
  }

  /** الرجوعُ من المحرّر إلى الكاميرا يمحو ما بُني على اللقطة. */
  function discard() {
    setDraft(null);
    setFilter("");
    setTexts([]);
    setStickers([]);
    setSound(null);
    setSong(null);
    setMuteVideo(false);
    setPanel(null);
    setError(null);
    setFrame(NO_FRAME);
    setHome(NO_FRAME);
  }

  const long = draft.video && draft.seconds > STORY_SECONDS;

  return (
    <View style={{ flex: 1, backgroundColor: "#0b1219" }}>
      {/* اللوحةُ بملء الشاشة كما يراها المشاهد — فالنصُّ والملصقُ يقعان حيث وُضعا. */}
      {draft.video && long ? (
        <VideoWindowPreview uri={draft.uri} start={draft.start} width={screen.width} height={screen.height} />
      ) : DEV_FEATURES ? (
        /* طبقةُ الصورة تأخذ ما لم يأخذه نصٌّ ولا ملصقٌ فوقها: سحبٌ وتقريبٌ ونقرتان تُعيدانها. */
        <View {...frameGesture.panHandlers} style={{ position: "absolute", left: 0, top: 0, width: screen.width, height: screen.height }}>
          <FramedMedia
            frame={frame}
            width={screen.width}
            height={screen.height}
            backdrop={
              draft.video ? null : (
                <Image source={{ uri: draft.uri }} style={{ width: screen.width, height: screen.height }} resizeMode="cover" blurRadius={40} />
              )
            }
          >
            {(w, h) =>
              draft.video ? (
                <StoryVideo source={draft.uri} local width={w} height={h} loop muted={muteVideo} cover />
              ) : !filter ? (
                <Image source={{ uri: draft.uri }} style={{ width: w, height: h }} resizeMode="cover" />
              ) : (
                <LocalFiltered uri={draft.uri} filter={filter} width={w} height={h} cover />
              )
            }
          </FramedMedia>
        </View>
      ) : draft.video ? (
        <StoryVideo source={draft.uri} local width={screen.width} height={screen.height} loop muted={muteVideo} />
      ) : !filter ? (
        <Image source={{ uri: draft.uri }} style={{ width: screen.width, height: screen.height }} resizeMode="contain" />
      ) : (
        <LocalFiltered uri={draft.uri} filter={filter} width={screen.width} height={screen.height} />
      )}

      <EditableTexts
        texts={texts}
        width={screen.width}
        height={screen.height}
        onChange={(index, next) => setTexts((all) => all.map((item, i) => (i === index ? next : item)))}
        onEdit={(index) => setEditing(index)}
        onActive={setDragging}
      />
      <EditableStickers
        stickers={stickers}
        width={screen.width}
        height={screen.height}
        onChange={(index, next) => setStickers((all) => all.map((item, i) => (i === index ? next : item)))}
        onEdit={(index) => {
          if (stickers[index]?.kind === "music") openMusic();
          else setStickerAt(index);
        }}
        onActive={setDragging}
      />

      {/* الأعلى: الرجوعُ إلى الكاميرا، والأدواتُ عموداً في الطرف المقابل. */}
      <View
        pointerEvents={dragging ? "none" : "box-none"}
        style={{ position: "absolute", top: insets.top + 8, left: 16, right: 16, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", opacity: dragging ? 0.25 : 1 }}
      >
        <Pressable accessibilityLabel="صوّر غيرها" onPress={discard} hitSlop={12} style={disc}>
          <CloseIcon size={20} color="#fff" />
        </Pressable>
        <View style={{ gap: 12, alignItems: "center" }}>
          <Tool label="نص" disabled={texts.length >= STORY_TEXTS} onPress={() => setEditing("new")}>
            <Text style={{ color: "#fff", fontSize: 17, fontWeight: "800" }}>Aa</Text>
          </Tool>
          <Tool label="ملصق" disabled={full} onPress={() => setTray(true)}>
            <StickerIcon size={21} color="#fff" />
          </Tool>
          {!draft.video ? (
            <Tool label="فلتر" on={panel === "filter"} onPress={() => setPanel((one) => (one === "filter" ? null : "filter"))}>
              <FilterMark />
            </Tool>
          ) : null}
          <Tool label="موسيقى" disabled={!hasMusic && full} on={hasMusic} onPress={openMusic}>
            <MusicIcon size={20} color="#fff" />
          </Tool>
          {draft.video ? (
            <Tool label={muteVideo ? "صوت المقطع مكتوم" : "كتم صوت المقطع"} on={muteVideo} onPress={() => setMuteVideo((on) => !on)}>
              <SpeakerIcon size={20} color="#fff" off={muteVideo} />
            </Tool>
          ) : null}
        </View>
      </View>

      {/* الأسفل: الفلترُ أو نافذةُ المقطع، ثمّ الجمهورُ والنشر في شريطٍ زجاجيّ. */}
      <View pointerEvents={dragging ? "none" : "box-none"} style={{ position: "absolute", left: 0, right: 0, bottom: insets.bottom + 12, paddingHorizontal: 16, gap: 10, opacity: dragging ? 0.25 : 1 }}>
        {panel === "filter" && !draft.video ? (
          <GlassPill style={{ borderRadius: 20, padding: 10, paddingBottom: 6 }}>
            <View style={{ flex: 1 }}>
              <FilterStrip uri={draft.uri} value={filter} onChange={setFilter} />
            </View>
          </GlassPill>
        ) : null}
        {long ? (
          <GlassPill style={{ borderRadius: 20, padding: 12 }}>
            <View style={{ flex: 1, gap: 6 }}>
              <VideoWindowBar seconds={draft.seconds} start={draft.start} onChange={(start) => setDraft((d) => (d ? { ...d, start } : d))} />
              <Text style={{ color: "rgba(255,255,255,.75)", fontSize: 11, textAlign: "center" }}>
                يُنشر {ar(STORY_SECONDS)} ثانية تختارها ويُضغط تلقائياً
              </Text>
            </View>
          </GlassPill>
        ) : null}
        {error ? (
          <Text accessibilityRole="alert" style={{ color: "#fff", backgroundColor: colors.live, borderRadius: 12, padding: 10, fontSize: 12.5, textAlign: "center", overflow: "hidden" }}>
            {error}
          </Text>
        ) : null}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <GlassPill style={{ flex: 1 }}>
            {[
              { key: false, label: "أصدقائي كلهم" },
              { key: true, label: only && picked.length ? `خاصة · ${ar(picked.length)}` : "قصة خاصة" },
            ].map((option) => {
              const on = only === option.key;
              return (
                <Pressable
                  key={String(option.key)}
                  onPress={() => {
                    setOnly(option.key);
                    if (option.key) setChoosing(true);
                  }}
                  style={{ flex: 1, height: 40, borderRadius: 20, flexDirection: "row", gap: 5, alignItems: "center", justifyContent: "center", backgroundColor: on ? "rgba(255,255,255,.92)" : "transparent" }}
                >
                  {option.key ? <LockIcon size={13} color={on ? "#000" : "#fff"} /> : null}
                  <Text numberOfLines={1} style={{ color: on ? "#000" : "#fff", fontSize: 12.5, fontWeight: "700" }}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </GlassPill>
          <Pressable
            accessibilityLabel="انشر"
            onPress={publish}
            disabled={busy}
            style={{ width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", backgroundColor: colors.clay, opacity: busy ? 0.6 : 1 }}
          >
            {busy ? <Spinner color={colors.onBrand} /> : <SendMark color={colors.onBrand} />}
          </Pressable>
        </View>
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
          onClose={() => setTray(false)}
          onPick={(kind) => {
            setTray(false);
            if (kind === "time") addSticker({ kind: "time", x: 0.5, y: 0.22, scale: 1, style: "digital" });
            else setPlacing(true);
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
            setSong(null);
            setSounding(false);
            // موسيقى على مقطع: صوتُه يُكتم افتراضاً، والزرُّ يُعيده.
            if (draft?.video) setMuteVideo(true);
            musicSticker(choice.label || undefined);
          }}
        />
      ) : null}

      {musicMenu ? (
        <MusicMenu
          hasSong={Boolean(song)}
          onSong={() => {
            setMusicMenu(false);
            setSongPicking(true);
          }}
          onVideo={() => {
            setMusicMenu(false);
            setSounding(true);
          }}
          onRemove={
            song
              ? () => {
                  setSong(null);
                  setStickers((all) => all.filter((item) => item.kind !== "music"));
                  setMusicMenu(false);
                }
              : undefined
          }
          onClose={() => setMusicMenu(false)}
        />
      ) : null}

      {songPicking ? (
        <SongPicker
          onClose={() => setSongPicking(false)}
          onPick={(track, start, full, seconds) => {
            setSong({ track, start, full, seconds });
            setSound(null);
            setSongPicking(false);
            if (draft?.video) setMuteVideo(true);
            musicSticker(`${track.title} · ${track.artist}`.slice(0, 40));
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

    </View>
  );
}

/** معاينةُ ملفٍّ محليّ بفلتره — قبل الرفع، فلا معرّف له بعد. */
function LocalFiltered({
  uri,
  filter,
  width,
  height,
  cover = false,
}: {
  uri: string;
  filter: string;
  width: number;
  height: number;
  cover?: boolean;
}) {
  return <Filtered mediaId={uri} filter={filter} width={width} height={height} local cover={cover} />;
}

/**
 * دُرجُ الملصقات: الموقعُ والوقت. والموسيقى أداةٌ في العمود وحدها — **بقرار المالك**:
 * كانت في الدرج أيضاً فيُقرأ البابُ مرّتين (القاعدة ٢٧٩).
 */
function StickerTray({
  onPick,
  onClose,
}: {
  onPick: (kind: "place" | "time") => void;
  onClose: () => void;
}) {
  const options = [
    { kind: "place" as const, label: "الموقع", hint: "وين أنت الحين", icon: <PinIcon size={22} color="#fff" />, tint: "#FF7A5A", off: false },
    { kind: "time" as const, label: "الوقت", hint: "بأشكال تختارها", icon: <ClockIcon size={22} color="#fff" />, tint: "#0984E3", off: false },
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

/** أداةٌ في عمود المحرّر: قرصٌ داكن واسمُها تحته. */
function Tool({
  label,
  on = false,
  disabled = false,
  onPress,
  children,
}: {
  label: string;
  on?: boolean;
  disabled?: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable accessibilityLabel={label} disabled={disabled} onPress={onPress} hitSlop={6} style={{ alignItems: "center", gap: 3, opacity: disabled ? 0.4 : 1 }}>
      <View style={[disc, on ? { backgroundColor: colors.clay } : null]}>{children}</View>
      <Text style={{ color: "#fff", fontSize: 10.5, fontWeight: "700", textShadowColor: "rgba(0,0,0,.6)", textShadowRadius: 4 }}>{label}</Text>
    </Pressable>
  );
}

function FilterMark() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Circle cx={9} cy={9.5} r={5.2} stroke="#fff" strokeWidth={1.7} />
      <Circle cx={15} cy={9.5} r={5.2} stroke="#fff" strokeWidth={1.7} />
      <Circle cx={12} cy={14.6} r={5.2} stroke="#fff" strokeWidth={1.7} />
    </Svg>
  );
}

/**
 * من أين الموسيقى (القاعدة ٢٧٧): أغنيةٌ من القائمة، أو صوتٌ خاصّ من فيديو في
 * الاستديو. طبقةٌ لا `Modal` (القاعدة ١٢٦)، والضغطُ خارجها يُغلقها.
 */
function MusicMenu({
  hasSong,
  onSong,
  onVideo,
  onRemove,
  onClose,
}: {
  hasSong: boolean;
  onSong: () => void;
  onVideo: () => void;
  onRemove?: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const row = { flexDirection: "row" as const, alignItems: "center" as const, gap: 12, height: 56, paddingHorizontal: 16, borderRadius: 16, backgroundColor: "rgba(255,255,255,.1)" };
  return (
    <Pressable onPress={onClose} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 90, elevation: 90, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,.45)" }}>
      <Pressable onPress={() => {}} style={{ margin: 12, marginBottom: insets.bottom + 12, padding: 14, gap: 10, borderRadius: 24, backgroundColor: "rgba(16,24,32,.97)" }}>
        <Text style={{ color: "#fff", fontSize: 16, fontWeight: "800", marginBottom: 2 }}>موسيقى القصة</Text>
        <Pressable onPress={onSong} style={row}>
          <MusicIcon size={20} color="#F6B93B" />
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>{hasSong ? "غيّر الأغنية" : "أغنية من القائمة"}</Text>
            <Text style={{ color: "rgba(255,255,255,.6)", fontSize: 11.5 }}>الأكثر استماعاً وبحث — كاملة أو مقطع</Text>
          </View>
        </Pressable>
        <Pressable onPress={onVideo} style={row}>
          <StickerIcon size={20} color="#fff" />
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>صوت خاص من فيديو</Text>
            <Text style={{ color: "rgba(255,255,255,.6)", fontSize: 11.5 }}>من الاستديو، وتقصّ منه ما تبي</Text>
          </View>
        </Pressable>
        {onRemove ? (
          <Pressable onPress={onRemove} style={{ ...row, backgroundColor: "transparent", justifyContent: "center" }}>
            <TrashIcon size={18} color="#FF7A5A" />
            <Text style={{ color: "#FF7A5A", fontSize: 14, fontWeight: "700" }}>احذف الموسيقى</Text>
          </Pressable>
        ) : null}
      </Pressable>
    </Pressable>
  );
}
