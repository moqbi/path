import { useEffect, useRef, useState } from "react";
import { View, Pressable } from "react-native";
import { Text } from "./type";
import { ResizeMode, Video } from "expo-av";
import { PlayIcon } from "./icons";
import { baseUrl, currentAccess, watchAccess } from "../lib/api";
import { colors } from "../theme/tokens";

/**
 * مقطعُ القصّة يُشغَّل لا يُرسم صورةً.
 *
 * كان يمرّ على `<Image>` كالصورة، فلا يظهر منه شيء — لا في المعاينة قبل
 * النشر ولا في شاشة العرض. و`<Image>` لا يفكّ MP4 بحال.
 *
 * والملفات خلف التوكن (القاعدة ٢٣ب)، فالمصدر يحمل ترويسته كما تحملها
 * `MediaImage`. والملفّ على الجهاز — معاينةٌ قبل الرفع — يُقرأ بعنوانه
 * بلا ترويسة: لا خادم بينهما.
 *
 * **ولا فلتر عليه على الجوّال**: الفلتر مصفوفةُ ألوانٍ يرسمها Skia على
 * صورةٍ مفكوكة، ومشغّلُ النظام لا يمرّ بها. فالفلاتر للصور، ويُقال ذلك
 * في الشاشة بدل أن يُعرض زرٌّ لا يغيّر شيئاً.
 */
export function StoryVideo({
  source,
  local = false,
  width,
  height,
  paused = false,
  loop = false,
}: {
  /** معرّف الملف على الخادم، أو عنوانه على الجهاز حين `local`. */
  source: string;
  local?: boolean;
  width: number;
  height: number;
  paused?: boolean;
  loop?: boolean;
}) {
  const player = useRef<Video | null>(null);
  const [token, setToken] = useState(currentAccess);
  const [playing, setPlaying] = useState(!paused);
  const [failed, setFailed] = useState(false);

  useEffect(() => watchAccess(() => setToken(currentAccess())), []);
  useEffect(() => setPlaying(!paused), [paused]);

  if (!local && !token) return null;

  if (failed) {
    return (
      <View style={{ width, height, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: "rgba(255,255,255,.7)", fontSize: 12.5 }}>تعذّر تشغيل المقطع</Text>
      </View>
    );
  }

  return (
    <View style={{ width, height }}>
      <Video
        ref={player}
        source={
          local
            ? { uri: source }
            : { uri: `${baseUrl}/v1/media/${source}`, headers: { authorization: `Bearer ${token}` } }
        }
        style={{ width, height }}
        resizeMode={ResizeMode.CONTAIN}
        isLooping={loop}
        shouldPlay={playing}
        onError={() => setFailed(true)}
        onPlaybackStatusUpdate={(status) => {
          if (status.isLoaded && status.didJustFinish && !loop) setPlaying(false);
        }}
      />

      {/* زرٌّ يُعيد التشغيل بعد أن ينتهي — ومن أراد أن يراه ثانيةً قبل أن يرسله. */}
      {!playing ? (
        <Pressable
          accessibilityLabel="شغّل المقطع"
          onPress={() => {
            setPlaying(true);
            void player.current?.replayAsync();
          }}
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(14,26,36,.66)",
            }}
          >
            <PlayIcon size={20} color={colors.onBrand} />
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}
