import { useEffect, useRef, useState } from "react";
import { View, Pressable, Image, Animated, Easing, Dimensions } from "react-native";
import { Text } from "./type";
import { useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { api } from "../lib/api";
import { playClose, playOpen } from "../lib/sound";
import { colors } from "../theme/tokens";

/**
 * زرّ النشر وقائمته المتطايرة — على نمط Path.
 *
 * الأصناف تنطلق من مكان الزرّ نفسه على قوس، بتأخيرٍ متدرّج يجعلها
 * تتتابع لا تظهر دفعةً واحدة. والحركة على `transform` و`opacity` وحدهما
 * فتبقى على مسار الرسم السريع.
 *
 * الزوايا تُقسَّم على عدد الأصناف لا تُكتب لكلٍّ منها: إضافة صنفٍ سابع
 * بزوايا ثابتة كانت ستُخرج أعلاها عن الشاشة أو تُلصق الأقراص.
 */
const RADIUS = 246;
const TOP = 88;
const BOTTOM = 4;
const SIZE = 56;

/**
 * قرصُ الصنف ورسمُه: الرسم ٣٢ بكسلاً، والقرص يلبسه بحشوةٍ لا يزيد.
 * قرصٌ بحجم زرّ النشر (٥٦) حول رسمٍ ٣٢ يترك هالةً بيضاء تُقرأ أكبر من
 * رسمها. ويُوسَّط في مربّع الزرّ (`SIZE`) فلا يتغيّر مدار القوس.
 */
const DISC = 44;
const ICON = 32;

/** الزرّ: ٢٠ من الحافة اليمنى، ونصفُ قطره ٢٨. */
const RIGHT = 20;
/** هامشٌ يبقى من الحافة اليسرى حتى لا يلامس القرصُ الحافّة. */
const EDGE = 10;

/**
 * نصف قطر القوس محسوبٌ على عرض الشاشة لا مكتوباً رقماً.
 *
 * ٢٤٦ مكتوبةً تعمل على ٣٧٥ فما فوق، وتخرج على شاشةٍ ٣٢٠: أدنى الأصناف
 * زاويتُه ٤° فيمشي أفقياً بمقدار القطر كلّه تقريباً، فيقع نصفُه خارج
 * الحافة اليسرى — وهو «صحيت»، فيُضغط على فراغ. قيست فعلاً على ٣٢٠×٥٦٨.
 *
 * والحدّ من العرض وحده: أعلى الأصناف عند ٨٨° يرتفع بمقدار القطر، وهو
 * أقصرُ من أقصر شاشةٍ ندعمها (٥٦٨) بفارقٍ مريح.
 */
function radiusFor(width: number): number {
  const reach = width - RIGHT - SIZE - EDGE;
  return Math.min(RADIUS, reach / Math.cos((BOTTOM * Math.PI) / 180));
}

const ART = {
  write: require("../assets/composer/write.png"),
  photo: require("../assets/composer/photo.png"),
  place: require("../assets/composer/place.png"),
  music: require("../assets/composer/music.png"),
  sleep: require("../assets/composer/sleep.png"),
  wake: require("../assets/composer/wake.png"),
};

export function ComposerFan() {
  const router = useRouter();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const progress = useRef(new Animated.Value(0)).current;

  const mark = useMutation({
    mutationFn: (kind: "SLEEP" | "WAKE") =>
      api("/v1/moments/mark", { method: "POST", body: JSON.stringify({ kind }) }),
    onSettled: () => {
      setBusy(null);
      void client.invalidateQueries({ queryKey: ["feed"] });
      void client.invalidateQueries({ queryKey: ["me", "moments"] });
    },
  });

  useEffect(() => {
    Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: open ? 420 : 220,
      easing: open ? Easing.bezier(0.18, 1.3, 0.42, 1) : Easing.bezier(0.4, 0, 1, 1),
      useNativeDriver: true,
    }).start();
  }, [open, progress]);

  const items = [
    { key: "write", label: "اكتب", run: () => router.push("/compose?kind=THOUGHT" as never) },
    { key: "photo", label: "صورة", run: () => router.push("/compose?kind=PHOTO" as never) },
    { key: "place", label: "مكان", run: () => router.push("/compose?kind=PLACE" as never) },
    { key: "music", label: "أغنية", run: () => router.push("/compose?kind=MUSIC" as never) },
    { key: "sleep", label: "نوم", run: () => { setBusy("sleep"); mark.mutate("SLEEP"); } },
    // النوم والصحو طرفا اليوم، فيجلسان متجاورين في طرف القوس.
    { key: "wake", label: "صحيت", run: () => { setBusy("wake"); mark.mutate("WAKE"); } },
  ] as const;

  const screen = Dimensions.get("window");
  const radius = radiusFor(screen.width);

  return (
    <>
      {/* غطاءٌ يعتّم الخط الزمني ويغلق القائمة عند اللمس خارجها. */}
      <Animated.View
        pointerEvents={open ? "auto" : "none"}
        style={{
          position: "absolute",
          top: -screen.height,
          left: -screen.width,
          right: -screen.width,
          bottom: -screen.height,
          backgroundColor: "rgba(14,26,36,.86)",
          opacity: progress,
        }}
      >
        <Pressable
          style={{ flex: 1 }}
          onPress={() => {
            playClose();
            setOpen(false);
          }}
        />
      </Animated.View>

      <View
        // الزرّ على اليمين كما في الويب، والأصناف تطير يساراً — وزواياه
        // محسوبةٌ على ذلك (القاعدة ٨).
        style={{ position: "absolute", right: 20, bottom: 86, width: SIZE, height: SIZE }}
        pointerEvents="box-none"
      >
        {items.map((item, index) => {
          // الأوّل في الأعلى والأخير في الأسفل، وما بينهما بالتساوي.
          const angle = TOP - ((TOP - BOTTOM) * index) / (items.length - 1);
          const radians = (angle * Math.PI) / 180;
          const x = -Math.cos(radians) * radius;
          const y = -Math.sin(radians) * radius;

          return (
            <Animated.View
              key={item.key}
              pointerEvents={open ? "auto" : "none"}
              style={{
                position: "absolute",
                width: SIZE,
                height: SIZE,
                opacity: progress,
                transform: [
                  { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, x] }) },
                  { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, y] }) },
                  { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }) },
                ],
              }}
            >
              <Pressable
                accessibilityLabel={item.label}
                disabled={busy !== null}
                onPress={() => {
                  setOpen(false);
                  item.run();
                }}
                style={{
                  width: DISC,
                  height: DISC,
                  marginTop: (SIZE - DISC) / 2,
                  marginLeft: (SIZE - DISC) / 2,
                  borderRadius: DISC / 2,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.line,
                }}
              >
                {/* الرسم صورةٌ لا خطّ: تُستبدل من `assets/composer` وحدها. */}
                <Image
                  source={ART[item.key]}
                  style={{ width: ICON, height: ICON, opacity: busy === item.key ? 0.45 : 1 }}
                  resizeMode="contain"
                />
              </Pressable>
            </Animated.View>
          );
        })}

        <Pressable
          accessibilityLabel={open ? "إغلاق" : "لحظة جديدة"}
          onPress={() => {
            // الفتح صوتٌ والإغلاق صوتٌ آخر — الأذن تقول أيّهما وقع.
            setOpen((v) => {
              if (v) playClose();
              else playOpen();
              return !v;
            });
          }}
          style={{
            width: SIZE,
            height: SIZE,
            borderRadius: SIZE / 2,
            alignItems: "center",
            justifyContent: "center",
            // الزرّ بلون العمق، وعلامة الزائد وحدها بتدرّج الشعار.
            backgroundColor: colors.night,
          }}
        >
          <Animated.View
            style={{
              transform: [
                {
                  rotate: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0deg", "135deg"],
                  }),
                },
              ],
            }}
          >
            <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
              <Defs>
                <LinearGradient id="fabPlus" x1="4" y1="20" x2="20" y2="4" gradientUnits="userSpaceOnUse">
                  <Stop stopColor="#F6B93B" />
                  <Stop offset="1" stopColor="#FF7A5A" />
                </LinearGradient>
              </Defs>
              <Path d="M12 5v14M5 12h14" stroke="url(#fabPlus)" strokeWidth={2.6} strokeLinecap="round" />
            </Svg>
          </Animated.View>
        </Pressable>
      </View>
    </>
  );
}
