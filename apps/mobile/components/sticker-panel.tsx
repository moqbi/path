import { Spinner } from "./spinner";
import { useMemo, useRef, useState } from "react";
import { FlatList, Pressable, View, type ViewToken } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Text } from "./type";
import { MediaImage } from "./media-image";
import { LockIcon, SparkIcon } from "./icons";
import { useStickers } from "../lib/stickers";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { ar } from "../lib/format";
import { colors } from "../theme/tokens";

/** ثمانيةٌ في الصفحة: صفّان بأربعة (القاعدة ٢٩١). */
const PER_PAGE = 8;
const COLUMNS = 4;
const CELL = 74;

/** قفلُ الصفحة: «plus» مجموعةٌ مع آثار+ لغير مشترك، و«buy» مجموعةٌ مدفوعة لم تُشترَ. */
type Lock = "plus" | "buy" | null;

type Page = {
  key: string;
  packId: string;
  pack: string;
  price: number;
  owned: boolean;
  lock: Lock;
  index: number;
  count: number;
  /** ترتيبُ المجموعة بين المجموعات — لنقاطها في أسفل اللوحة. */
  packIndex: number;
  stickers: { id: string; mediaId: string }[];
};

/**
 * لوحةُ الملصقات تحت حقل الكتابة (القاعدة ٢٩١) — **بقرار المالك**: ثمانيةٌ في
 * الصفحة، والسحبُ يميناً ويساراً يقلّب الصفحات، واسمُ المجموعة في أعلاها مع
 * نقاطِ صفحاتها. والضغطةُ ترسل الملصق في الحال — لا معاينةَ ولا زرَّ ثانٍ.
 *
 * والقفلُ لكلّ مجموعةٍ لا للّوحة (القاعدة ٢٩٤): مجموعةٌ مع آثار+ تُرسم لغير المشترك
 * خلف حجابٍ بزرِّ اشتراك، ومجموعةٌ مدفوعة خلف حجابٍ بسعرها وزرِّ شرائها — والسحبُ
 * يمرّ على الحجاب إلى ما بعده. والخادمُ يردّ الإرسال (`assertSticker`)، فالحجابُ
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
  const client = useQueryClient();
  const coins = useSession((state) => state.me?.coins ?? 0);
  const refreshSession = useSession((state) => state.refresh);
  const stickers = useStickers(true);
  const [width, setWidth] = useState(0);
  const [current, setCurrent] = useState(0);
  const [buying, setBuying] = useState<string | null>(null);
  const [problem, setProblem] = useState<{ packId: string; text: string } | null>(null);

  const buy = async (packId: string) => {
    if (buying) return;
    setBuying(packId);
    setProblem(null);
    try {
      await api(`/v1/stickers/packs/${packId}/buy`, { method: "POST" });
      // الرصيدُ من الجلسة والملكيّةُ من القائمة — كلاهما تغيّر.
      await Promise.all([client.invalidateQueries({ queryKey: ["stickers"] }), refreshSession()]);
    } catch (error) {
      setProblem({ packId, text: error instanceof Error ? error.message : "تعذّر الشراء" });
    } finally {
      setBuying(null);
    }
  };

  const leave = (to: string) => {
    onLeave?.();
    router.push(to as never);
  };

  const pages = useMemo<Page[]>(() => {
    const out: Page[] = [];
    for (const [packIndex, pack] of (stickers.data?.packs ?? []).entries()) {
      const count = Math.ceil(pack.stickers.length / PER_PAGE);
      const price = pack.priceCoins ?? 0;
      const owned = pack.owned ?? false;
      const lock: Lock = owned ? null : price > 0 ? "buy" : isPlus ? null : "plus";
      for (let index = 0; index < count; index++) {
        out.push({
          key: `${pack.id}:${index}`,
          packId: pack.id,
          pack: pack.name,
          price,
          owned,
          lock,
          index,
          count,
          packIndex,
          stickers: pack.stickers.slice(index * PER_PAGE, (index + 1) * PER_PAGE),
        });
      }
    }
    return out;
  }, [stickers.data, isPlus]);

  // الصفحةُ الظاهرة من القائمة نفسها لا من الإزاحة: الإزاحةُ في جذرٍ من اليمين لا تُحسب ببساطة.
  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems[0];
    if (first?.index != null) setCurrent(first.index);
  }).current;

  // على الورق اللوحةُ على الأرضية لا في بطاقة، فحبرُها حبرُ الأرضية (القاعدة ٢٦٢).
  const ink = tone === "dark" ? "#fff" : colors.groundInk;
  const soft = tone === "dark" ? "rgba(255,255,255,.55)" : colors.groundMuted;
  const cell = tone === "dark" ? "rgba(255,255,255,.06)" : colors.paper;
  const page = pages[current] ?? pages[0];
  // أوّلُ صفحةٍ لكلّ مجموعة: نقطتُها تقفز إليها.
  const firsts = useMemo(() => pages.flatMap((one, at) => (one.index === 0 ? [at] : [])), [pages]);
  const list = useRef<FlatList<Page>>(null);
  const DOTS = firsts.length > 1 ? 18 : 0;
  const height = 28 + CELL * 2 + 10 + DOTS;

  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={{ height, borderRadius: 18, overflow: "hidden" }}
    >
      {stickers.isLoading ? (
        <Spinner style={{ marginTop: 40 }} color={soft} />
      ) : pages.length === 0 ? (
        <Text style={{ color: soft, fontSize: 12.5, textAlign: "center", marginTop: 50 }}>ما فيه ملصقات بعد</Text>
      ) : (
        <>
          {width > 0 ? (
            <FlatList
              ref={list}
              data={pages}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.key}
              onViewableItemsChanged={onViewable}
              viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
              getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
              extraData={{ buying, problem, coins }}
              renderItem={({ item }) => (
                /*
                  الصفحةُ كلُّها تأخذ اللمسة من أوّلها — رأسُها وفراغُها — فالسحبُ يبدأ من أيّ موضعٍ فيها:
                  كان الفراغُ بلا مستجيب فتأخذ النافذةُ الزجاجيّة اللمسةَ (القاعدة ٢٤٧)، ولا يُقلَّب
                  إلا من فوق ملصق. والقائمةُ تأخذها منها حين يثبت السحبُ أفقيّاً.
                */
                <View onStartShouldSetResponder={() => true} style={{ width, height: 28 + CELL * 2 + 10 }}>
                <PageHead page={item} ink={ink} soft={soft} />
                <View style={{ width, flexDirection: "row", flexWrap: "wrap", rowGap: 10 }}>
                  {item.stickers.map((sticker) => (
                    <Pressable
                      key={sticker.id}
                      accessibilityLabel="أرسل الملصق"
                      disabled={item.lock !== null}
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
                {item.lock ? (
                  <PackLock
                    page={item}
                    coins={coins}
                    busy={buying === item.packId}
                    problem={problem?.packId === item.packId ? problem.text : null}
                    onBuy={() => buy(item.packId)}
                    onPlus={() => leave("/subscribe")}
                    onTopUp={() => leave("/coins")}
                  />
                ) : null}
                </View>
              )}
            />
          ) : null}

          {/* نقطةٌ لكلّ مجموعة: تقول إنّ بعد هذه مجموعاتٍ أخرى، وتقفز إليها. */}
          {DOTS ? (
            <View style={{ height: DOTS, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
              {firsts.map((at, packIndex) => {
                const on = page?.packIndex === packIndex;
                return (
                  <Pressable
                    key={at}
                    accessibilityLabel={`مجموعة ${pages[at]?.pack ?? ""}`}
                    hitSlop={6}
                    onPress={() => list.current?.scrollToIndex({ index: at, animated: true })}
                    style={{ width: on ? 16 : 6, height: 6, borderRadius: 3, backgroundColor: on ? ink : soft, opacity: on ? 1 : 0.6 }}
                  />
                );
              })}
            </View>
          ) : null}
        </>
      )}

    </View>
  );
}

/** رأسُ الصفحة: اسمُ المجموعة في الوسط، والسعرُ أو «مملوكة» في طرفٍ ونقاطُ صفحاتها في الآخر. */
function PageHead({ page, ink, soft }: { page: Page; ink: string; soft: string }) {
  return (
    <View style={{ height: 28, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 4 }}>
      <View style={{ flex: 1, flexDirection: "row" }}>
        {page.price > 0 || page.owned ? (
          <Text style={{ color: page.owned ? soft : colors.clay, fontSize: 11, fontWeight: "700" }}>
            {page.owned ? "مملوكة" : `${ar(page.price)} نقطة`}
          </Text>
        ) : null}
      </View>
      <Text numberOfLines={1} style={{ flexShrink: 1, color: ink, fontSize: 13, fontWeight: "700", textAlign: "center" }}>
        {page.pack}
      </Text>
      <View style={{ flex: 1, flexDirection: "row", justifyContent: "flex-end", gap: 4 }}>
        {page.count > 1
          ? Array.from({ length: page.count }, (_, i) => (
              <View
                key={i}
                style={{ width: i === page.index ? 12 : 4, height: 4, borderRadius: 2, backgroundColor: i === page.index ? colors.clay : soft }}
              />
            ))
          : null}
      </View>
    </View>
  );
}

/** حجابُ المجموعة المقفولة: اشتراكٌ لما مع آثار+، وشراءٌ بسعرها لما يُشترى. */
function PackLock({
  page,
  coins,
  busy,
  problem,
  onBuy,
  onPlus,
  onTopUp,
}: {
  page: Page;
  coins: number;
  busy: boolean;
  problem: string | null;
  onBuy: () => void;
  onPlus: () => void;
  onTopUp: () => void;
}) {
  // النقصُ يُقال قبل الضغط (القاعدة ٩٣ب): من يرى «لا يكفي» لا يضغط ليُقال له.
  const short = page.lock === "buy" && coins < page.price;
  const button = (label: string, onPress: () => void, color: string, icon?: React.ReactNode) => (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={{ flexDirection: "row", alignItems: "center", gap: 6, height: 38, paddingHorizontal: 18, borderRadius: 19, backgroundColor: color, opacity: busy ? 0.7 : 1 }}
    >
      {busy ? <Spinner size="small" color="#fff" /> : icon}
      <Text style={{ color: "#fff", fontSize: 13, fontWeight: "800" }}>{label}</Text>
    </Pressable>
  );
  return (
    <View
      style={{
        position: "absolute",
        // على الصفحة كلّها برأسها — **بقرار المالك** — واسمُ المجموعة يُكتب فيه.
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        paddingHorizontal: 16,
        backgroundColor: "rgba(10,18,26,.82)",
        borderRadius: 14,
      }}
    >
      <LockIcon size={24} color="#fff" />
      <Text numberOfLines={1} style={{ color: "rgba(255,255,255,.7)", fontSize: 12, fontWeight: "700" }}>
        {page.pack}
      </Text>
      {page.lock === "plus" ? (
        <>
          <Text style={{ color: "#fff", fontSize: 13.5, fontWeight: "700" }}>مع اشتراك آثار+</Text>
          {button("اشترك في آثار+", onPlus, colors.gold, <SparkIcon size={15} color="#fff" />)}
        </>
      ) : (
        <>
          <Text style={{ color: "#fff", fontSize: 13.5, fontWeight: "700", textAlign: "center" }}>
            {short ? `تحتاج ${ar(page.price)} نقطة — رصيدك ${ar(coins)}` : "تشتريها مرّة وتبقى لك"}
          </Text>
          {short
            ? button("اشحن نقاطك", onTopUp, colors.gold)
            : button(`اشترِها بـ${ar(page.price)} نقطة`, onBuy, colors.clay)}
          {problem ? <Text style={{ color: "#FFB4A2", fontSize: 12 }}>{problem}</Text> : null}
        </>
      )}
    </View>
  );
}

/** الملصقُ في تعليقٍ أو رسالة: رسمُه وحده بلا فقاعة. */
export function StickerImage({ mediaId, size = 112 }: { mediaId: string; size?: number }) {
  return <MediaImage mediaId={mediaId} resizeMode="contain" style={{ width: size, height: size }} />;
}
