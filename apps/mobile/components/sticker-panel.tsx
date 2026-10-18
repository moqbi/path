import { useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, View, type ViewToken } from "react-native";
import { useRouter } from "expo-router";
import { Text } from "./type";
import { MediaImage } from "./media-image";
import { LockIcon, SparkIcon } from "./icons";
import { useStickers } from "../lib/stickers";
import { colors } from "../theme/tokens";

/** ثمانيةٌ في الصفحة: صفّان بأربعة (القاعدة ٢٩١). */
const PER_PAGE = 8;
const COLUMNS = 4;
const CELL = 74;

type Page = { key: string; pack: string; index: number; count: number; stickers: { id: string; mediaId: string }[] };

/**
 * لوحةُ الملصقات تحت حقل الكتابة (القاعدة ٢٩١) — **بقرار المالك**: ثمانيةٌ في
 * الصفحة، والسحبُ يميناً ويساراً يقلّب الصفحات، واسمُ المجموعة في أعلاها مع
 * نقاطِ صفحاتها. والضغطةُ ترسل الملصق في الحال — لا معاينةَ ولا زرَّ ثانٍ.
 *
 * ولغير مشترك آثار+ تُرسم الملصقاتُ نفسها خلف حجابٍ داكن بقفلٍ وزرِّ اشتراك:
 * يرى ما يفوته. والخادمُ يردّ الإرسال لغير المشترك (`assertSticker`)، فالحجابُ
 * دعوةٌ لا حارس.
 */
export function StickerPanel({
  tone,
  isPlus,
  onPick,
  onLeave,
}: {
  /** «dark» في نافذة التفاعل الزجاجيّة، و«light» على ورق الشاشات. */
  tone: "dark" | "light";
  isPlus: boolean;
  onPick: (stickerId: string) => void;
  /** يُنادى قبل الذهاب إلى صفحة الاشتراك — لنافذةٍ تُغلق نفسها. */
  onLeave?: () => void;
}) {
  const router = useRouter();
  const stickers = useStickers(true);
  const [width, setWidth] = useState(0);
  const [current, setCurrent] = useState(0);

  const pages = useMemo<Page[]>(() => {
    const out: Page[] = [];
    for (const pack of stickers.data?.packs ?? []) {
      const count = Math.ceil(pack.stickers.length / PER_PAGE);
      for (let index = 0; index < count; index++) {
        out.push({
          key: `${pack.id}:${index}`,
          pack: pack.name,
          index,
          count,
          stickers: pack.stickers.slice(index * PER_PAGE, (index + 1) * PER_PAGE),
        });
      }
    }
    return out;
  }, [stickers.data]);

  // الصفحةُ الظاهرة من القائمة نفسها لا من الإزاحة: الإزاحةُ في جذرٍ من اليمين لا تُحسب ببساطة.
  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems[0];
    if (first?.index != null) setCurrent(first.index);
  }).current;

  const ink = tone === "dark" ? "#fff" : colors.ink;
  const soft = tone === "dark" ? "rgba(255,255,255,.55)" : colors.muted;
  const cell = tone === "dark" ? "rgba(255,255,255,.06)" : colors.paper;
  const page = pages[current] ?? pages[0];
  const height = CELL * 2 + 10 + 28;

  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={{ height, borderRadius: 18, overflow: "hidden" }}
    >
      {stickers.isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={soft} />
      ) : pages.length === 0 ? (
        <Text style={{ color: soft, fontSize: 12.5, textAlign: "center", marginTop: 50 }}>ما فيه ملصقات بعد</Text>
      ) : (
        <>
          <View style={{ height: 28, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 4 }}>
            <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, color: ink, fontSize: 13, fontWeight: "700" }}>
              {page?.pack}
            </Text>
            {page && page.count > 1 ? (
              <View style={{ flexDirection: "row", gap: 4 }}>
                {Array.from({ length: page.count }, (_, i) => (
                  <View
                    key={i}
                    style={{ width: i === page.index ? 14 : 5, height: 5, borderRadius: 3, backgroundColor: i === page.index ? colors.clay : soft }}
                  />
                ))}
              </View>
            ) : null}
          </View>

          {width > 0 ? (
            <FlatList
              data={pages}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.key}
              onViewableItemsChanged={onViewable}
              viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
              getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
              renderItem={({ item }) => (
                <View style={{ width, flexDirection: "row", flexWrap: "wrap", rowGap: 10 }}>
                  {item.stickers.map((sticker) => (
                    <Pressable
                      key={sticker.id}
                      accessibilityLabel="أرسل الملصق"
                      disabled={!isPlus}
                      onPress={() => onPick(sticker.id)}
                      style={({ pressed }) => ({
                        width: width / COLUMNS,
                        height: CELL,
                        alignItems: "center",
                        justifyContent: "center",
                        transform: [{ scale: pressed ? 0.9 : 1 }],
                      })}
                    >
                      <View style={{ width: CELL - 6, height: CELL - 6, borderRadius: 14, backgroundColor: cell, alignItems: "center", justifyContent: "center" }}>
                        <MediaImage mediaId={sticker.mediaId} resizeMode="contain" style={{ width: CELL - 14, height: CELL - 14 }} />
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}
            />
          ) : null}
        </>
      )}

      {!isPlus ? (
        <View
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            backgroundColor: "rgba(10,18,26,.82)",
          }}
        >
          <LockIcon size={26} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 13.5, fontWeight: "700" }}>الملصقات لمشتركي آثار+</Text>
          <Pressable
            onPress={() => {
              onLeave?.();
              router.push("/subscribe" as never);
            }}
            style={{ flexDirection: "row", alignItems: "center", gap: 6, height: 38, paddingHorizontal: 18, borderRadius: 19, backgroundColor: colors.gold }}
          >
            <SparkIcon size={15} color="#fff" />
            <Text style={{ color: "#fff", fontSize: 13, fontWeight: "800" }}>اشترك في آثار+</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

/** الملصقُ في تعليقٍ أو رسالة: رسمُه وحده بلا فقاعة. */
export function StickerImage({ mediaId, size = 112 }: { mediaId: string; size?: number }) {
  return <MediaImage mediaId={mediaId} resizeMode="contain" style={{ width: size, height: size }} />;
}
