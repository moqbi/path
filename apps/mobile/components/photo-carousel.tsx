import { useRef, useState } from "react";
import { Animated, PanResponder, Pressable, View, type StyleProp, type ViewStyle } from "react-native";
import { MediaImage } from "./media-image";
import { viewPhoto } from "./photo-viewer";
import { PHOTO_RATIO } from "./photo-frame";
import { Text } from "./type";
import { ar } from "../lib/format";

/**
 * صورُ اللحظة تُقلَّب يميناً ويساراً (القاعدة ٣٤٣) — **بقرار المالك**، خمسٌ على الأكثر.
 *
 * بلا `ScrollView` أفقيّ: تمريرُه في جذرٍ من اليمين يقلب الإزاحةَ على آبل مرّةً وعلى
 * أندرويد مرّةً، فالصفحةُ الأولى قد تبدأ من غير طرفها. فالصفحاتُ مكدّسةٌ في مكانٍ واحد
 * وكلٌّ منها مزاحةٌ بفرق رقمها عن الموضع الحاليّ — والتاليةُ في اليسار كقراءة العربية،
 * فالسحبُ يميناً يأتي بها. والتحويلُ على الخيط الأصليّ.
 * الأولى بموضعها الذي ضبطه صاحبُها، وما بعدها من الوسط. والضغطُ يفتح الصورة المعروضة.
 */
export function PhotoCarousel({
  ids,
  position,
  style,
  radius = 14,
}: {
  ids: string[];
  position?: { x: number; y: number };
  style?: StyleProp<ViewStyle>;
  radius?: number;
}) {
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const pos = useRef(new Animated.Value(0)).current;
  const now = useRef({ index: 0, width: 0, count: ids.length }).current;
  now.width = width;
  now.count = ids.length;

  const go = (target: number) => {
    const next = Math.max(0, Math.min(now.count - 1, target));
    now.index = next;
    setIndex(next);
    Animated.spring(pos, { toValue: next, useNativeDriver: true, bounciness: 0, speed: 16 }).start();
  };

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.4,
      onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.6,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => {
        if (!now.width) return;
        const raw = now.index + g.dx / now.width;
        // مقاومةٌ خلف الطرفين: تُحسّ الحافّة ولا تُعبر.
        const edge = raw < 0 ? raw * 0.3 : raw > now.count - 1 ? now.count - 1 + (raw - now.count + 1) * 0.3 : raw;
        pos.setValue(edge);
      },
      onPanResponderRelease: (_, g) => {
        const step = g.dx / Math.max(1, now.width);
        const flick = Math.abs(g.vx) > 0.35 ? Math.sign(g.vx) : 0;
        const moved = Math.abs(step) > 0.25 ? Math.sign(step) : flick;
        go(now.index + moved);
      },
      onPanResponderTerminate: () => go(now.index),
    }),
  ).current;

  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={[{ width: "100%", aspectRatio: PHOTO_RATIO, borderRadius: radius, overflow: "hidden" }, style]}
      {...pan.panHandlers}
    >
      {width
        ? ids.map((id, at) => (
            <Animated.View
              key={id}
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: 0,
                width,
                transform: [{ translateX: Animated.multiply(Animated.add(pos, -at), width) }],
              }}
            >
              <Pressable accessibilityLabel={`افتح الصورة ${ar(at + 1)}`} onPress={() => viewPhoto(id, ids)} style={{ flex: 1 }}>
                <MediaImage
                  mediaId={id}
                  position={at === 0 ? position : undefined}
                  style={{ width: "100%", height: "100%" }}
                />
              </Pressable>
            </Animated.View>
          ))
        : null}

      <View pointerEvents="none" style={{ position: "absolute", top: 10, right: 10, paddingHorizontal: 8, height: 22, borderRadius: 11, justifyContent: "center", backgroundColor: "rgba(14,26,36,.55)" }}>
        <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>
          {ar(index + 1)}/{ar(ids.length)}
        </Text>
      </View>
      <View pointerEvents="none" style={{ position: "absolute", bottom: 10, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 5 }}>
        {ids.map((id, at) => (
          <View
            key={id}
            style={{
              width: at === index ? 16 : 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: at === index ? "#fff" : "rgba(255,255,255,.55)",
            }}
          />
        ))}
      </View>
    </View>
  );
}
