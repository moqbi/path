import { useEffect, useRef, useState } from "react";
import { View, Pressable, Image, Animated, Easing, Dimensions } from "react-native";
import { Text } from "./type";
import { useRouter } from "expo-router";
import { create } from "zustand";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { playClose, playOpen } from "../lib/sound";
import { Spot } from "./spot";
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
 * قرصُ الصنف ورسمُه: الرسم ٢٤ بكسلاً — **بقرار المالك** — والقرص يلبسه
 * بحشوةٍ لا يزيد (٣٦). قرصٌ كبيرٌ حول رسمٍ صغير يترك هالةً بيضاء تُقرأ
 * أكبر من رسمها. ويُوسَّط في مربّع الزرّ (`SIZE`) فلا يتغيّر مدار القوس،
 * ومساحةُ اللمس تبقى ٥٦ مهما صغر الرسم.
 */
const DISC = 36;
const ICON = 24;

/**
 * الزرّ: ٢٨ من الحافة اليمنى لا ٢٠.
 *
 * على الجهاز كان يكاد يلامس الحافّة — والإبهام يصل إليه وهو ملتصقٌ،
 * لكنّه يُقرأ ملصوقاً لا موضوعاً. وفي الويب يجلس داخل هيكل هاتفٍ له
 * حافّةٌ من حوله، فلا يُحسّ الفرق إلا على شاشةٍ حقيقية.
 */
const RIGHT = 28;

/**
 * ورسمُ الزرّ ٣٢ — **بقرار المالك** (كان ٢٤ فصغر عن أن يُرى زرّاً أوّلاً).
 * مربّعُه يبقى ٥٦ فلا يتغيّر مدار القوس ولا تصغر مساحةُ اللمس.
 */
const PLUS = 32;
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

/**
 * حالُ القوس خارج المكوّن: الجولةُ تفتحه لتضع دائرتها على كلّ صنفٍ فيه،
 * ثمّ تُغلقه — وحالٌ محلّيّة لا يبلغها أحدٌ من خارجها.
 */
export const useFan = create<{ open: boolean }>(() => ({ open: false }));

export function ComposerFan() {
  const router = useRouter();
  const client = useQueryClient();
  const open = useFan((state) => state.open);
  const setOpen = (next: boolean | ((was: boolean) => boolean)) =>
    useFan.setState({ open: typeof next === "function" ? next(useFan.getState().open) : next });
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
        style={{ position: "absolute", right: RIGHT, bottom: 86, width: SIZE, height: SIZE }}
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
              <Spot id={`fan.${item.key}`}>
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
              </Spot>
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
            /*
               الزرّ رسمٌ في `assets/composer/plus.png` لا خطٌّ في الكود:
               قرصٌ ملوّن برأسه، فلا قرصَ داكنٌ تحته يُقرأ حلقةً حوله.
            */
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
            {/* هدفُ الجولة: تضع دائرتها على الزائد نفسه. */}
            <Spot id="compose">
              <Image
                source={require("../assets/composer/plus.png")}
                style={{ width: PLUS, height: PLUS }}
                resizeMode="contain"
              />
            </Spot>
          </Animated.View>
        </Pressable>
      </View>
    </>
  );
}
