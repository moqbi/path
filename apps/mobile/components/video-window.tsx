import { useEffect, useRef, useState } from "react";
import { PanResponder, View } from "react-native";
import { ResizeMode, Video } from "expo-av";
import { STORY_SECONDS } from "@athar/shared";
import { Text } from "./type";
import { ar } from "../lib/format";
import { colors } from "../theme/tokens";

/** «١:٠٥» — دقائقُ وثوانٍ بأرقامٍ عربيّة. */
function clock(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  return `${ar(Math.floor(s / 60))}:${ar(String(s % 60).padStart(2, "0"))}`;
}

/**
 * معاينةُ المقطع الطويل (القاعدة ٢٤٩): تدور داخل النافذة المختارة وحدها —
 * من `start` إلى `start + STORY_SECONDS` — فيرى صاحبُها ما سيُنشر بالضبط.
 */
export function VideoWindowPreview({
  uri,
  start,
  width,
  height,
}: {
  uri: string;
  start: number;
  width: number;
  height: number;
}) {
  const player = useRef<Video | null>(null);
  const span = useRef(start);
  span.current = start;

  // النافذةُ انتقلت: يقفز إلى أوّلها.
  useEffect(() => {
    void player.current?.setPositionAsync(start * 1000).catch(() => {});
  }, [start]);

  return (
    <Video
      ref={player}
      source={{ uri }}
      style={{ width, height }}
      resizeMode={ResizeMode.CONTAIN}
      shouldPlay
      isMuted={false}
      progressUpdateIntervalMillis={250}
      onPlaybackStatusUpdate={(status) => {
        if (!status.isLoaded) return;
        const end = (span.current + STORY_SECONDS) * 1000;
        if (status.positionMillis >= end || status.didJustFinish) {
          void player.current?.setPositionAsync(span.current * 1000).catch(() => {});
          void player.current?.playAsync().catch(() => {});
        }
      }}
    />
  );
}

/**
 * شريطُ القصّ للمقطع الطويل (القاعدة ٢٤٩) — **بقرار المالك**: كان المقطعُ
 * الأطولُ من ثلاثين ثانية يُردّ «الحدّ ٣٠ ثانية» فلا يُنشر. الآن نافذةٌ بطول
 * `STORY_SECONDS` تُسحب على طول المقطع، والخادمُ يقصّ ما فيها ويضغطه.
 * والزمنُ من اليسار إلى اليمين كأيّ شريط تشغيل — كشريط قصّ الصوت (القاعدة ٢٣٨).
 */
export function VideoWindowBar({
  seconds,
  start,
  onChange,
}: {
  seconds: number;
  start: number;
  onChange: (start: number) => void;
}) {
  const [width, setWidth] = useState(0);
  const total = Math.max(STORY_SECONDS, seconds);
  const window = (STORY_SECONDS / total) * width;
  const px = width / total;

  const live = useRef({ start, onChange, px, total });
  live.current = { start, onChange, px, total };
  const from = useRef(0);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => {
        const { start: a, px: p, total: t } = live.current;
        const x = event.nativeEvent.locationX / (p || 1);
        // ضغطةٌ خارج النافذة تنقلها إلى حيث ضُغط.
        if (x < a || x > a + STORY_SECONDS) {
          const next = Math.max(0, Math.min(t - STORY_SECONDS, x - STORY_SECONDS / 2));
          live.current.onChange(next);
          from.current = next;
        } else {
          from.current = a;
        }
      },
      onPanResponderMove: (_e, g) => {
        const { px: p, total: t } = live.current;
        const next = Math.max(0, Math.min(t - STORY_SECONDS, from.current + g.dx / (p || 1)));
        live.current.onChange(next);
      },
    }),
  ).current;

  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "700" }}>
        المقطع {clock(seconds)} — اسحب النافذة لتختار {ar(STORY_SECONDS)} ثانية
      </Text>
      <View
        {...pan.panHandlers}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        // الزمنُ من اليسار إلى اليمين أيّاً كان اتّجاه الكتابة.
        style={{ height: 52, borderRadius: 14, backgroundColor: colors.chip, overflow: "hidden", direction: "ltr" }}
      >
        {width ? (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: start * px,
              width: window,
              borderRadius: 14,
              borderWidth: 3,
              borderColor: colors.clay,
              backgroundColor: "rgba(246,185,59,.25)",
            }}
          />
        ) : null}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", direction: "ltr" }}>
        <Text style={{ color: colors.muted, fontSize: 11.5 }}>{clock(start)}</Text>
        <Text style={{ color: colors.muted, fontSize: 11.5 }}>{clock(start + Math.min(STORY_SECONDS, seconds))}</Text>
      </View>
      <Text style={{ color: colors.faint, fontSize: 11 }}>
        يُقصّ ويُضغط بعد الرفع — الأصل الطويل ما يُحفظ.
      </Text>
    </View>
  );
}
