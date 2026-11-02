import { useEffect, useRef, useState } from "react";
import { PanResponder, View } from "react-native";
import { useEventListener } from "expo";
import { useVideoPlayer, VideoView } from "expo-video";
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
 * من `start` إلى `start + length` — فيرى صاحبُها ما سيُنشر بالضبط.
 */
export function VideoWindowPreview({
  uri,
  start,
  length,
  width,
  height,
  muted = false,
}: {
  uri: string;
  start: number;
  length: number;
  width: number;
  height: number;
  muted?: boolean;
}) {
  const span = useRef({ start, length });
  span.current = { start, length };
  const player = useVideoPlayer({ uri }, (made) => {
    made.muted = muted;
    made.timeUpdateEventInterval = 0.25;
    made.play();
  });
  useEffect(() => {
    player.muted = muted;
  }, [player, muted]);

  // النافذةُ انتقلت أو تغيّر أوّلُها: يقفز إلى أوّلها.
  useEffect(() => {
    player.currentTime = start;
  }, [player, start]);

  const back = () => {
    player.currentTime = span.current.start;
    player.play();
  };
  useEventListener(player, "timeUpdate", ({ currentTime }) => {
    if (currentTime >= span.current.start + span.current.length) back();
  });
  useEventListener(player, "playToEnd", back);

  return <VideoView player={player} style={{ width, height }} contentFit="contain" nativeControls={false} />;
}

/** أقصرُ مقطعٍ يُقصّ (القاعدة ٤٠٨). */
export const CLIP_MIN = 3;

/**
 * شريطُ القصّ للمقطع الطويل (القاعدة ٤٠٨) — **بقرار المالك**، ونقضاً لنافذة الستّين الثابتة في ٢٤٩:
 * مقبضان للبداية والنهاية يحدّدهما صاحبُه بحرّيّة، من ثلاث ثوانٍ إلى `STORY_SECONDS`. واللمسةُ عند
 * طرفٍ تحرّكه، وداخل النافذة تسحبها بطولها، وخارجها تنقلها إلى حيث ضُغط. والزمنُ من اليسار إلى
 * اليمين كأيّ شريط تشغيل — كشريط قصّ الصوت (القاعدة ٢٣٨).
 */
export function VideoWindowBar({
  seconds,
  start,
  length,
  onChange,
}: {
  seconds: number;
  start: number;
  length: number;
  onChange: (start: number, length: number) => void;
}) {
  const [width, setWidth] = useState(0);
  const total = Math.max(CLIP_MIN, seconds);
  const px = width / total;

  const live = useRef({ start, length, onChange, px, total });
  live.current = { start, length, onChange, px, total };
  const grip = useRef<{ mode: "start" | "end" | "move"; a: number; len: number }>({ mode: "move", a: 0, len: 0 });

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => {
        const { start: a, length: len, px: p, total: t } = live.current;
        const at = event.nativeEvent.locationX;
        const left = a * p;
        const right = (a + len) * p;
        const reach = 26;
        if (Math.abs(at - left) <= reach && Math.abs(at - left) <= Math.abs(at - right)) {
          grip.current = { mode: "start", a, len };
        } else if (Math.abs(at - right) <= reach) {
          grip.current = { mode: "end", a, len };
        } else if (at > left && at < right) {
          grip.current = { mode: "move", a, len };
        } else {
          // ضغطةٌ خارج النافذة تنقلها إلى حيث ضُغط.
          const x = at / (p || 1);
          const next = Math.max(0, Math.min(t - len, x - len / 2));
          live.current.onChange(next, len);
          grip.current = { mode: "move", a: next, len };
        }
      },
      onPanResponderMove: (_e, g) => {
        const { px: p, total: t } = live.current;
        const { mode, a, len } = grip.current;
        const d = g.dx / (p || 1);
        if (mode === "move") {
          live.current.onChange(Math.max(0, Math.min(t - len, a + d)), len);
        } else if (mode === "start") {
          const end = a + len;
          const next = Math.max(0, Math.max(end - STORY_SECONDS, Math.min(end - CLIP_MIN, a + d)));
          live.current.onChange(next, end - next);
        } else {
          const end = Math.min(t, Math.min(a + STORY_SECONDS, Math.max(a + CLIP_MIN, a + len + d)));
          live.current.onChange(a, end - a);
        }
      },
    }),
  ).current;

  const handle = {
    position: "absolute" as const,
    top: 8,
    bottom: 8,
    width: 6,
    borderRadius: 3,
    backgroundColor: "#fff",
  };

  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: "#fff", fontSize: 13.5, fontWeight: "700" }}>
        المقطع {clock(seconds)} — حدّد البداية والنهاية (حتى {ar(STORY_SECONDS)} ثانية)
      </Text>
      <View
        {...pan.panHandlers}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        // الزمنُ من اليسار إلى اليمين أيّاً كان اتّجاه الكتابة.
        style={{ height: 52, borderRadius: 14, backgroundColor: "rgba(255,255,255,.12)", overflow: "hidden", direction: "ltr" }}
      >
        {width ? (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: start * px,
              width: length * px,
              borderRadius: 14,
              borderWidth: 3,
              borderColor: colors.clay,
              backgroundColor: "rgba(246,185,59,.25)",
            }}
          >
            <View style={[handle, { left: 4 }]} />
            <View style={[handle, { right: 4 }]} />
          </View>
        ) : null}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", direction: "ltr" }}>
        <Text style={{ color: "rgba(255,255,255,.7)", fontSize: 11.5 }}>{clock(start)}</Text>
        <Text style={{ color: "#fff", fontSize: 11.5, fontWeight: "700" }}>{ar(Math.round(length))} ثانية</Text>
        <Text style={{ color: "rgba(255,255,255,.7)", fontSize: 11.5 }}>{clock(start + length)}</Text>
      </View>
    </View>
  );
}
