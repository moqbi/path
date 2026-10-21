import { useEffect, useRef, useState } from "react";
import { usePullLogo } from "../../components/logo-refresh";
import { useTabTop } from "../../lib/tab-top";
import { TabBackdrop } from "../../components/tab-backdrop";
import { useBarSpace } from "../../components/glass-bar";
import { View, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { Text } from "../../components/type";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AthrMark } from "../../components/brand";
import { StoreGrid, STRIP_MAX } from "../../components/store-grid";
import { FlameIcon, InfoIcon, SparkIcon } from "../../components/icons";
import { useStore, type StoreItem } from "../../lib/queries";
import { usePullRefresh } from "../../lib/refresh";
import { coinText } from "../../lib/format";
import { colors } from "../../theme/tokens";
import { DEV_FEATURES } from "../../lib/dev-features";
import { useStickers } from "../../lib/stickers";
import { PackShelf, freshPacks } from "../../components/sticker-store";
import { openStoreSection } from "../../lib/store-section";

/**
 * عنوان صفٍّ في «المميز» — واللهب رسمٌ لا إيموجي، كبقية أيقونات التطبيق.
 * و«عرض الكل» بجانبه حين يزيد القسم على عشرة (القاعدة ٢٦٦)، ويفتح القسمَ في صفحته (القاعدة ٣١٠).
 */
function Row({
  title,
  flame = false,
  more,
  children,
}: {
  title: string;
  flame?: boolean;
  more?: (() => void) | null;
  children: React.ReactNode;
}) {
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
        {flame ? <FlameIcon size={16} color={colors.live} /> : null}
        <Text style={{ flex: 1, color: colors.groundInk, fontSize: 14, fontWeight: "700" }}>{title}</Text>
        {more ? (
          <Pressable onPress={more} hitSlop={8}>
            <Text style={{ color: colors.groundMuted, fontSize: 12.5, fontWeight: "600" }}>عرض الكل</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/**
 * المتجر: شريط تصنيفات، ثم صفوف.
 *
 * «المميز» ليس تصنيفاً بل واجهة: ما وصل حديثاً، ثم ثيمات آثار، ثم الحزم
 * المحدودة — صفوفٌ تُشتقّ من الأصناف لا تُرصف يدوياً.
 */
export default function Store() {
  // ضغطةُ التبويب المفتوح ترجع إلى أعلاه (القاعدة ١٥٧).
  const list = useRef<ScrollView | null>(null);
  useTabTop(() => list.current?.scrollTo({ y: 0, animated: true }));
  // المحتوى يمرّ تحت الشريط الزجاجيّ، وآخرُه يُقرأ فوقه (القاعدة ٢٢٨).
  const barSpace = useBarSpace();
  const router = useRouter();
  // حشوةُ الحافّة العليا في الرأس الداكن نفسه — انظر `components/screen-header.tsx`.
  const insets = useSafeAreaInsets();
  const store = useStore();
  // الملصقاتُ شريحةٌ بجانب الأنواع (القاعدة ٢٩٧) — في نسخة التطوير وحدها كواجهتها (القاعدة ٢٩١).
  const stickers = useStickers(DEV_FEATURES);
  const pullRefresh = usePullRefresh(() =>
    Promise.all([store.refetch(), DEV_FEATURES ? stickers.refetch() : null]),
  );
  const pull = usePullLogo({ ...pullRefresh, tint: colors.clay });
  const [slug, setSlug] = useState("");
  const data = store.data;
  const packs = stickers.data?.packs ?? [];
  const plusPacks = packs.filter((pack) => (pack.priceCoins ?? 0) === 0);
  const paidPacks = packs.filter((pack) => (pack.priceCoins ?? 0) > 0);
  const newPacks = freshPacks(packs);
  // من بطاقة الإعلان: الصنفُ تُفتح بطاقتُه فوق المتجر (القاعدة ٢٦٧).
  // والمعرّفُ يُمسك في الحالة ثمّ يُمسح من العنوان: لو بقي فيه لفُتحت البطاقة
  // ثانيةً مع كلّ عودةٍ إلى التبويب، ولو مُسح وحده لأُغلقت لحظةَ فُتحت.
  const params = useLocalSearchParams<{ item?: string }>();
  const [held, setHeld] = useState<string | null>(null);
  useEffect(() => {
    if (!params.item) return;
    setHeld(params.item);
    router.setParams({ item: undefined } as never);
  }, [params.item]);
  const focused = data?.items.find((item) => item.id === held) ?? null;

  const grid = (items: StoreItem[], strip = false) =>
    data ? (
      <StoreGrid
        row={strip}
        items={items}
        owned={data.owned}
        expires={data.expires ?? {}}
        isPlus={data.isPlus}
        coins={data.coins}
        daysHere={data.daysHere}
        equipped={data.equipped}
      />
    ) : null;

  /**
   * قسمٌ صفٌّ أفقيٌّ بعشرة (القاعدة ٢٦٦)، و«عرض الكل» يفتحه شبكةً بكلّ ما فيه في
   * صفحةٍ مستقلّة (القاعدة ٣١٠) — كانت الشبكةُ تنفتح في مكانها فتدفع المتجرَ إلى أسفل.
   */
  const shelf = (title: string, items: StoreItem[], flame = false, kind?: (typeof KINDS)[number]) => {
    const more = () => {
      // صفُّ نوعٍ في «المميز» يُفتح مجموعةً مجموعة كشريحته (القاعدة ٣١٣)، وغيرُه قسماً واحداً.
      const parts = kind
        ? groupOf(kind, items).map((row) => ({ title: row.title, ids: row.items.map((item) => item.id) }))
        : [{ title, ids: items.map((item) => item.id) }];
      openStoreSection(title, parts);
      router.push("/store-section" as never);
    };
    return (
      <Row key={title} title={title} flame={flame} more={items.length > STRIP_MAX ? more : null}>
        {grid(items, true)}
      </Row>
    );
  };

  const category = data?.categories.find((row) => row.slug === slug) ?? null;

  /*
    شرائحُ الأنواع بعد «المميز» — التشارمز والإطارات والثيمات — وفي كلٍّ
    منها أقسامٌ بمجموعاته ثمّ «… الأخرى» لما بلا مجموعة (**بقرار المالك**).
    وتصنيفاتُ المشرف بعدها كما كانت.
  */
  const KINDS = [
    { slug: "kind:CHARM", name: "التشارمز", kinds: ["CHARM"], other: "التشارمز الأخرى" },
    { slug: "kind:FRAME", name: "الإطارات", kinds: ["FRAME"], other: "الإطارات الأخرى" },
    { slug: "kind:THEME", name: "الثيمات", kinds: ["THEME", "BACKGROUND"], other: "الثيمات الأخرى" },
  ] as const;
  const STICKERS = { slug: "kind:STICKER", name: "الملصقات" };
  const stickerTab = slug === STICKERS.slug;
  const kindTab = KINDS.find((row) => row.slug === slug) ?? null;
  /** أصنافُ نوعٍ أقساماً بمجموعاته ثمّ «… الأخرى» — للشريحة ولصفحة «عرض الكل» معاً. */
  const groupOf = (kind: (typeof KINDS)[number], pool: StoreItem[]) => {
    const mine = pool.filter((item) => (kind.kinds as readonly string[]).includes(item.kind));
    const groups = (data?.collections ?? []).filter((one) => (kind.kinds as readonly string[]).includes(one.kind));
    const known = new Set(groups.map((one) => one.id));
    const out = groups
      .map((one) => ({ title: one.name, items: mine.filter((item) => item.collectionId === one.id) }))
      .filter((row) => row.items.length > 0);
    const rest = mine.filter((item) => !item.collectionId || !known.has(item.collectionId));
    if (rest.length > 0) out.push({ title: out.length > 0 ? kind.other : kind.name, items: rest });
    return out;
  };
  const grouped = kindTab && data ? groupOf(kindTab, data.items) : [];

  return (
    <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: colors.ground }}>
      <TabBackdrop />
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 20,
          paddingTop: insets.top + 6,
          paddingBottom: 10,
          backgroundColor: colors.chrome,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <AthrMark size={32} />
          <View style={{ width: 1, height: 18, backgroundColor: colors.chromeLine }} />
          <Text style={{ color: colors.chromeInk, fontSize: 16, fontWeight: "700" }}>المتجر</Text>
        </View>

        {/*
          الرصيد زرٌّ لا لافتة: من يقرأ رصيده هو من يريد شحنه، فالطريق
          إلى الشحن من مكان السؤال لا من قائمةٍ أخرى.
        */}
        <Pressable
          accessibilityLabel="شحن النقاط"
          onPress={() => router.push("/coins" as never)}
          style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.goldSoft, borderWidth: 1, borderColor: colors.goldLine }}
        >
          <SparkIcon size={14} color={colors.gold} />
          <Text style={{ color: colors.goldInk, fontSize: 12.5, fontWeight: "600" }}>
            رصيدك {coinText(data?.coins ?? 0)}
          </Text>
          <Text style={{ color: colors.goldInk, fontSize: 15, fontWeight: "700", marginTop: -1 }}>＋</Text>
        </Pressable>
      </View>

      {/* شريط التصنيفات: «المميز» أولاً، ثم ما يضيفه المشرف. */}
      <View style={{ paddingTop: 12, paddingBottom: 4 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row", paddingHorizontal: 20, gap: 8 }}>
          {/*
            تصنيفُ المشرف الذي يحمل اسمَ نوعٍ («التشارمز») لا يُعرض ثانيةً بجانب
            شريحة النوع نفسها: شريحتان باسمٍ واحد تُقرآن خطأً.
          */}
          {[
            { slug: "", name: "المميز" },
            ...KINDS,
            ...(DEV_FEATURES && packs.length > 0 ? [STICKERS] : []),
            ...(data?.categories ?? []).filter(
              // «التمائم» اسمُها القديم: خادمٌ لم تمرّ عليه هجرةُ الاسم بعدُ (القاعدة ٢٧١).
              (row) => !KINDS.some((kind) => kind.name === row.name.trim()) && row.name.trim() !== "التمائم",
            ),
          ].map((chip) => {
            const on = slug === chip.slug;
            return (
              <Pressable
                key={chip.slug || "featured"}
                onPress={() => setSlug(chip.slug)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: on ? colors.clay : colors.card,
                  borderWidth: 1,
                  borderColor: on ? colors.clay : colors.line,
                }}
              >
                <Text style={{ fontSize: 12.5, fontWeight: "600", color: on ? colors.onBrand : colors.ink2 }}>
                  {chip.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {focused && data ? (
        <View style={{ height: 0, overflow: "hidden" }}>
          <StoreGrid
            items={[focused]}
            focus={focused.id}
            owned={data.owned}
            expires={data.expires ?? {}}
            isPlus={data.isPlus}
            coins={data.coins}
            daysHere={data.daysHere}
            equipped={data.equipped}
          />
        </View>
      ) : null}

      {store.isLoading ? (
        <ActivityIndicator style={{ marginTop: 50 }} color={colors.clay} />
      ) : (
        <View style={{ flex: 1 }}>
        <ScrollView
        ref={list}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: barSpace + 8 }}
        {...pull.props}
        >
          {stickerTab ? (
            <>
              {/* قسمان — **بقرار المالك**: ما مع آثار+، ثمّ ما يُشترى بالنقاط. */}
              {plusPacks.length > 0 ? (
                <Row title="ملصقات آثار+">
                  <PackShelf packs={plusPacks} isPlus={data?.isPlus ?? false} />
                </Row>
              ) : null}
              {paidPacks.length > 0 ? (
                <Row title="ملصقات أخرى">
                  <PackShelf packs={paidPacks} isPlus={data?.isPlus ?? false} />
                </Row>
              ) : null}
            </>
          ) : kindTab ? (
            grouped.length > 0 ? (
              grouped.map((row) => shelf(row.title, row.items))
            ) : (
              <Text style={{ color: colors.groundMuted, fontSize: 13, textAlign: "center", marginTop: 30 }}>
                ما فيه {kindTab.name} بعد.
              </Text>
            )
          ) : category ? (
            grid((data?.items ?? []).filter((item) => item.categoryId === category.id))
          ) : (
            <>
              {/* ترتيبُ «المميز» — **بقرار المالك**: الجديد، فالمحدود، فالتشارمز، فالإطارات، فالثيمات، فالحزم. */}
              {shelf("وصل حديثاً", data?.rows.fresh ?? [], true)}
              {/* مجموعةُ ملصقاتٍ جديدة خبرٌ كالصنف الجديد — صفٌّ تحته في القسم نفسه. */}
              {DEV_FEATURES && newPacks.length > 0 ? (
                <View style={{ marginTop: -12 }}>
                  <PackShelf strip packs={newPacks} isPlus={data?.isPlus ?? false} />
                </View>
              ) : null}
              {/* المحدودُ بعد الجديد — **بقرار المالك** (القاعدة ٣١٣): ما يذهب قريباً يُرى أوّلاً.
                  وصفٌّ فارغٌ لا يُرسم (القاعدة ٢٨٤). */}
              {(data?.rows.limited?.length ?? 0) > 0 ? (
                <Row title="حزم محدودة">{grid(data?.rows.limited ?? [])}</Row>
              ) : null}
              {(data?.rows.charms?.length ?? 0) > 0 ? shelf("التشارمز", data?.rows.charms ?? [], false, KINDS[0]) : null}
              {(data?.rows.frames?.length ?? 0) > 0 ? shelf("الإطارات", data?.rows.frames ?? [], false, KINDS[1]) : null}
              {(data?.rows.themes?.length ?? 0) > 0 ? shelf("ثيمات آثار", data?.rows.themes ?? [], false, KINDS[2]) : null}
              {(data?.rows.bundles?.length ?? 0) > 0 ? (
                <Row title="الحزم">{grid(data?.rows.bundles ?? [])}</Row>
              ) : null}
            </>
          )}

          {data && !data.isPlus ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20, borderRadius: 16, borderWidth: 1, borderColor: colors.goldLine, backgroundColor: colors.goldSoft, padding: 16 }}>
              <View style={{ width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#f0e4c8" }}>
                <SparkIcon size={19} color={colors.gold} />
              </View>
              <Text style={{ flex: 1, color: colors.ink2, fontSize: 12, lineHeight: 21 }}>
                مشتركو <Text style={{ fontWeight: "600", color: colors.goldInk }}>آثار+</Text> يحصلون على ١٠٠٠ نقطة شهرياً وخصم ٢٠٪
              </Text>
            </View>
          ) : null}

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingBottom: 24 }}>
            <InfoIcon size={13} color={colors.groundFaint} />
            <Text style={{ color: colors.groundFaint, fontSize: 11, textAlign: "center" }}>
              لا صناديق عشوائية · كل صنف بسعره الواضح
            </Text>
          </View>
        </ScrollView>
        {pull.overlay}
        </View>
      )}
    </SafeAreaView>
  );
}
