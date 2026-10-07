import { useEffect, useRef, useState } from "react";
import { Animated, View, Pressable, Platform, PanResponder } from "react-native";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import { BlurView } from "expo-blur";
import { LiquidGlass, LiquidLens } from "../lib/liquid-glass";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Tabs, usePathname } from "expo-router";
import { Text } from "./type";
import { Avatar } from "./avatar";
import { Spot } from "./spot";
import { BellIcon, CircleIcon, HomeIcon, MessageIcon, StoreIcon } from "./icons";
import { useSession } from "../lib/session";
import { useNoteCount, useUnreadDm } from "../lib/queries";
import { ar } from "../lib/format";
import { colors } from "../theme/tokens";

/**
 * الشريط السفلي زجاجٌ عائم — **بقرار المالك** (القاعدة ٢٢٨): قرصٌ مستطيلٌ
 * فوق المحتوى لا شريطٌ ملتصقٌ بحافّة الشاشة، والمحتوى يمرّ تحته مغبّشاً.
 * أيقوناتٌ بلا أسماء، والمفتوحُ منها في قرصٍ أفتح. و«أنا» صورةُ صاحبها.
 *
 * والمحادثاتُ فيه بين الأصدقاء والإشعارات — كانت أيقونةً في رأس اللحظات
 * وحدها فلا تُبلغ من غيرها. وهي شاشةٌ في المكدّس لا تبويب: تُفتح فوقه.
 */
const PILL = 62;
/** ما تزيده العدسةُ على عرض التبويب — فتخرج بيضاويّةً كعدسة شريط النظام. */
const LENS_WIDEN = 40;

/** خصائصُ الشريط كما يمرّرها `Tabs` — من النوع نفسه لا من حزمةٍ لا نعتمد عليها مباشرةً. */
type BarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>["tabBar"]>>[0];

/** ما يتركه المحتوى في أسفله ليُقرأ آخرُه فوق الشريط لا تحته. */
export function useBarSpace() {
  const insets = useSafeAreaInsets();
  return barBottom(insets.bottom) + PILL + 16;
}

/** موضعُ الشريط من أسفل الشاشة — فوق خطّ الرجوع إلى الشاشة الرئيسيّة. */
export function barBottom(inset: number) {
  return Math.max(inset - 6, 12);
}

const ICON = 23;
/*
  زجاجُ آبل الحقيقيّ — **بقرار المالك**، بهويّة الشريط الداكنة: زجاجٌ داكنٌ يتلوّن
  بما تحته وأيقوناتٌ بيضاء، والقرصُ تحت الإصبع عدسةٌ زجاجيّة تكبر. وبلا الوحدة
  يبقى الزجاجُ المغبّش الداكن كما كان (`lib/liquid-glass.ts`).
*/
const ON = "#ffffff";
const OFF = "rgba(255,255,255,.78)";

function Badge({ count }: { count?: number }) {
  // رقمٌ للمحادثات (القاعدة ١٥١)، ونقطةٌ لما سواها.
  if (count !== undefined) {
    return (
      <View
        style={{
          position: "absolute",
          top: -6,
          right: -10,
          minWidth: 17,
          height: 17,
          paddingHorizontal: 4,
          borderRadius: 9,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.live,
        }}
      >
        <Text style={{ color: "#fff", fontSize: 9.5, fontWeight: "700", lineHeight: 12 }}>
          {count > 99 ? "+٩٩" : ar(count)}
        </Text>
      </View>
    );
  }
  return (
    <View
      style={{
        position: "absolute",
        bottom: -1,
        right: -3,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.live,
      }}
    />
  );
}

export function GlassBar({
  state,
  navigation,
  onLongHome,
}: BarProps & { onLongHome: () => void }) {
  const insets = useSafeAreaInsets();
  const path = usePathname();
  const me = useSession((s) => s.me);
  const unseen = useNoteCount().data?.unseen ?? 0;
  const unread = useUnreadDm().data?.unread ?? 0;

  /*
    الرقمُ على أيقونة التطبيق يتبع النقطتين نفسيهما: ما لم يُقرأ من الإشعارات
    والرسائل. الخادمُ يرسله مع كلّ تنبيه والتطبيقُ مغلق، وهنا يُضبط وهو مفتوح —
    فيختفي حين تُقرأ ولا يبقى رقمُ آخرِ تنبيه. وبالخروج يُصفَّر: لا رقمَ لحسابٍ
    خرج منه صاحبُه.
  */
  useEffect(() => {
    if (Platform.OS === "web") return;
    void Notifications.setBadgeCountAsync(unseen + unread).catch(() => undefined);
  }, [unseen, unread]);
  useEffect(
    () => () => {
      if (Platform.OS !== "web") void Notifications.setBadgeCountAsync(0).catch(() => undefined);
    },
    [],
  );

  const current = state.routes[state.index]?.name;
  // ملفُّ الصديق يُضيء «الأصدقاء»: من هناك يُفتح (القاعدة ٤٢).
  const active = path.startsWith("/u/") ? "circle" : current === "messages" ? "chats" : current;

  const go = (name: string) => {
    const route = state.routes.find((r) => r.name === name);
    if (!route) return;
    const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
    if (active !== name && !event.defaultPrevented) {
      /*
        **العدسةُ تنطلق قبل الشاشة**: كانت تنتظر رسمَ التبويب الجديد ثمّ تتحرّك —
        «تعلق ثمّ تثبت». الحركةُ على الخيط الأصليّ، فتُرسَل أوّلاً ويُرسم التبويبُ بعدها.
      */
      const index = itemsRef.current.findIndex((item) => item.key === (name === "messages" ? "chats" : name));
      if (index >= 0 && targetRef.current !== index) moveTo(index);
      navigation.navigate(name as never);
    }
  };

  const items: {
    key: string;
    label: string;
    spot: string;
    onPress: () => void;
    onLongPress?: () => void;
    render: (on: boolean, tint: string) => React.ReactNode;
  }[] = [
    {
      key: "index",
      label: "اللحظات",
      spot: "tab.index",
      onPress: () => go("index"),
      // الضغطةُ المطوّلة بابُ العدستين (القاعدة ٢٦).
      onLongPress: onLongHome,
      render: (on, tint) => <HomeIcon size={ICON} color={tint} />,
    },
    {
      key: "circle",
      label: "الأصدقاء",
      spot: "tab.circle",
      onPress: () => go("circle"),
      render: (on, tint) => <CircleIcon size={ICON} color={tint} />,
    },
    {
      key: "chats",
      label: "المحادثات",
      spot: "tab.chats",
      onPress: () => go("messages"),
      render: (on, tint) => (
        <View>
          <MessageIcon size={ICON} color={tint} />
          {unread > 0 ? <Badge count={unread} /> : null}
        </View>
      ),
    },
    {
      key: "notifications",
      label: "الإشعارات",
      spot: "tab.notifications",
      onPress: () => go("notifications"),
      render: (on, tint) => (
        <View>
          <BellIcon size={ICON} color={tint} />
          {unseen > 0 && !on ? <Badge /> : null}
        </View>
      ),
    },
    {
      key: "store",
      label: "المتجر",
      spot: "tab.store",
      onPress: () => go("store"),
      render: (on, tint) => <StoreIcon size={ICON} color={tint} />,
    },
    {
      key: "me",
      label: "أنا",
      spot: "tab.me",
      onPress: () => go("me"),
      render: (on, tint) => (
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1.5,
            borderColor: on ? tint : "transparent",
          }}
        >
          <Avatar name={me?.name ?? ""} size={27} mediaId={me?.avatarMediaId ?? null} />
        </View>
      ),
    },
  ];

  /*
    **الشريطُ يُسحب لا يُنقر وحده** — **بقرار المالك**: الإصبعُ يمرّ على
    الأيقونات فيتبعه قرصٌ زجاجيّ يكبر قليلاً، وتكبر الأيقونةُ تحته، ونقرةٌ
    خفيفةٌ (`Haptics`) مع كل أيقونةٍ يعبرها، وبالإفلات يُفتح ما تحت الإصبع.
    والقرصُ نفسه ينزلق بين التبويبات حين تتبدّل بالنقر — لا يقفز.
    ومواضعُ الأيقونات تُقاس (`onLayout`) لا تُحسب من العرض: الصفُّ من اليمين
    في التطبيق ومن اليسار في غيره، والقياسُ لا يسأل.
  */
  const slots = useRef<{ x: number; w: number }[]>([]);
  const rowX = useRef(0);
  const row = useRef<View>(null);
  /*
    **الحركةُ كلُّها على الخيط الأصليّ** (`useNativeDriver: true`): كانت تحرّك
    `left` و`width` على خيط جافاسكربت، والنقرُ يبدأ رسمَ الشاشة الجديدة على الخيط
    نفسه في اللحظة نفسها — فتتقطّع العدسةُ وهي تنزلق. الآن إزاحةٌ وتكبيرٌ وحدهما،
    والتبويباتُ بعرضٍ واحد (`flex: 1`) فلا يتغيّر عرضُ القرص.
  */
  const x = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(0)).current;
  // تمطّطُ العدسة بسرعة الإصبع — كعدسة شريط النظام: تطول وهي تُسحب وتعود حين تقف.
  const stretch = useRef(new Animated.Value(0)).current;
  const [hover, setHover] = useState<number | null>(null);
  // الإصبعُ على الشريط: حالةٌ تتبدّل مرّتين في السحبة لا مع كلّ أيقونة.
  const [dragging, setDragging] = useState(false);
  const velocity = useRef(0);
  // العدسةُ تظهر طوالَ الانتقال بالنقر — من التبويب إلى التبويب — لا ومضةً قصيرة.
  const [lensAt, setLensAt] = useState<number | null>(null);
  const lensRun = useRef(0);
  const releasedAt = useRef(0);
  const [slotW, setSlotW] = useState(0);
  const [rowW, setRowW] = useState(0);
  // التبويبُ الذي تمضي إليه العدسة — فلا تُطلق مرّتين: من النقر ثمّ من تبدّل التبويب.
  const targetRef = useRef(-1);
  const measured = slotW > 0;
  const hoverRef = useRef<number | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const activeIndex = items.findIndex((item) => item.key === active);
  const activeRef = useRef(activeIndex);
  activeRef.current = activeIndex;
  const showPill = dragging || (activeIndex >= 0 && active !== "me");
  const lensOn = dragging || lensAt !== null;

  /*
    نابضٌ بصلابةٍ وتخميد لا بسرعةٍ وارتداد: ينطلق دون قفزةٍ أولى ويستقرّ بتجاوزٍ
    خفيف — كحركة عدسة شريط النظام.
  */
  const spring = (value: Animated.Value, toValue: number, stiffness: number, damping: number) =>
    Animated.spring(value, { toValue, useNativeDriver: true, stiffness, damping, mass: 1 });

  const moveTo = (index: number, animate = true) => {
    const slot = slots.current[index];
    if (!slot) return;
    targetRef.current = index;
    const to = slot.x + 2;
    if (!animate) {
      x.setValue(to);
      return;
    }
    // بعد السحب لا تُعاد العدسة: تختفي ساعةَ يُرفع الإصبع.
    const pulse = hoverRef.current === null && Date.now() - releasedAt.current > 600;
    if (!pulse) {
      spring(x, to, 260, 26).start();
      return;
    }
    /*
      النقرُ كعدسة شريط النظام: ترتفع العدسةُ في مكانها، وتنزلق إلى التبويب الجديد
      وهي تتمطّط، وتُكبّر ما تمرّ فوقه، ثمّ تهبط حين تستقرّ.
    */
    const run = ++lensRun.current;
    setLensAt(index);
    spring(lift, 1, 420, 28).start();
    Animated.sequence([
      Animated.timing(stretch, { toValue: 0.18, duration: 120, useNativeDriver: true }),
      spring(stretch, 0, 200, 14),
    ]).start();
    spring(x, to, 170, 20).start(() => {
      if (run !== lensRun.current || hoverRef.current !== null) return;
      spring(lift, 0, 260, 24).start();
      setTimeout(() => {
        if (run === lensRun.current) setLensAt(null);
      }, 120);
    });
  };

  // القرصُ يتبع التبويبَ المفتوح حين لا يكون إصبعٌ على الشريط.
  useEffect(() => {
    if (measured && hoverRef.current === null && activeIndex >= 0 && targetRef.current !== activeIndex) moveTo(activeIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, measured]);

  const indexAt = (pageX: number) => {
    const local = pageX - rowX.current;
    let best = 0;
    let gap = Infinity;
    slots.current.forEach((slot, i) => {
      const d = Math.abs(slot.x + slot.w / 2 - local);
      if (d < gap) {
        gap = d;
        best = i;
      }
    });
    return best;
  };

  const follow = (pageX: number) => {
    const local = pageX - rowX.current;
    const first = slots.current[0];
    if (!first) return;
    const min = Math.min(...slots.current.map((s) => s.x)) + 2;
    const max = Math.max(...slots.current.map((s) => s.x)) + 2;
    x.setValue(Math.min(max, Math.max(min, local - first.w / 2 + 2)));
    const index = indexAt(pageX);
    if (index !== hoverRef.current) {
      hoverRef.current = index;
      /*
        **لا رسمَ ولا نقرةَ مع كلّ أيقونة**: كان كلُّ عبورٍ يُعيد رسمَ الشريط كلّه ويقرع
        نقرةً، فتُحسّ السحبةُ متقطّعة. مع زجاج آبل النسخةُ داخل العدسة تقول ما تحتها،
        فالحالةُ لغيره وحده.
      */
      if (!LiquidLens) setHover(index);
    }
  };

  const release = (pageX: number | null) => {
    const index = pageX === null ? null : indexAt(pageX);
    releasedAt.current = Date.now();
    hoverRef.current = null;
    setHover(null);
    setDragging(false);
    velocity.current = 0;
    spring(lift, 0, 260, 24).start();
    spring(stretch, 0, 200, 14).start();
    if (index !== null && index !== activeRef.current) void Haptics.selectionAsync().catch(() => undefined);
    if (index !== null) {
      moveTo(index);
      itemsRef.current[index]?.onPress();
    }
    // ما لم يغيّر التبويب (التبويبُ نفسه) يعود القرصُ إلى مكانه.
    setTimeout(() => {
      if (hoverRef.current === null && activeRef.current >= 0 && targetRef.current !== activeRef.current) moveTo(activeRef.current);
    }, 280);
  };

  /*
    **ما تحت العدسة يكبر بقدر قربه منها** لا قفزاً بحالة: كلُّ أيقونةٍ تقرأ موضعَ
    العدسة، فتكبر وهي تمرّ فوقها وتصغر وهي تبتعد — كما يُكبّر شريطُ النظام ما تحت
    عدسته. وبلا عدسةٍ مرفوعة لا تكبير.
  */
  /*
    **وما تحت العدسة من الأصل يغيب بقدر قربه منها**: النسخةُ المكبَّرة داخلها تحلّ
    محلّه، وكان الأصلُ يُرى تحتها ظلّاً مزدوجاً.
  */
  const under = (index: number) => {
    const slot = slots.current[index];
    if (!slot || !measured || !LiquidLens) return 1;
    const center = slot.x + 2;
    return Animated.subtract(
      1,
      Animated.multiply(
        x.interpolate({
          // يغيب كلّه ما دام تحت العدسة — حتى وهي بين تبويبين — ويعود حين تتجاوزه.
          inputRange: [center - slot.w / 2 - 30, center - slot.w / 2, center + slot.w / 2, center + slot.w / 2 + 30],
          outputRange: [0, 1, 1, 0],
          extrapolate: "clamp",
        }),
        lift,
      ),
    );
  };

  const magnify = (index: number) => {
    const slot = slots.current[index];
    // مع زجاج آبل التكبيرُ نسخةٌ داخل العدسة، فلا تكبر الأصليّةُ تحتها.
    if (!slot || !measured || LiquidLens) return 1;
    const center = slot.x + 2;
    return Animated.add(
      1,
      Animated.multiply(
        x.interpolate({
          inputRange: [center - slot.w, center, center + slot.w],
          outputRange: [0, 0.3, 0],
          extrapolate: "clamp",
        }),
        lift,
      ),
    );
  };

  const pan = useRef(
    PanResponder.create({
      // النقرُ يبقى للأزرار، والسحبةُ الأفقيّة تُؤخذ منها.
      onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderGrant: (event) => {
        row.current?.measureInWindow((left) => {
          rowX.current = left;
        });
        lensRun.current++;
        setLensAt(null);
        setDragging(true);
        spring(lift, 1, 420, 28).start();
        follow(event.nativeEvent.pageX);
      },
      onPanResponderMove: (event, g) => {
        follow(event.nativeEvent.pageX);
        /*
          التمطّطُ قيمةٌ تُكتب لا نابضٌ يُطلق مع كلّ حدث: نابضٌ جديدٌ ستّين مرّةً في
          الثانية يُنشئ عقدةً أصليّةً لكلٍّ منها فيتقطّع. والسرعةُ تُنعَّم فلا ترجف.
        */
        velocity.current = velocity.current * 0.7 + Math.abs(g.vx) * 0.3;
        stretch.setValue(Math.min(velocity.current * 0.12, 0.24));
      },
      onPanResponderRelease: (event) => release(event.nativeEvent.pageX),
      onPanResponderTerminate: () => release(null),
      onPanResponderTerminationRequest: () => false,
    }),
  ).current;

  return (
    <View
      pointerEvents="box-none"
      style={{ position: "absolute", left: 14, right: 14, bottom: barBottom(insets.bottom) }}
    >
      <View
        style={{
          height: PILL,
          borderRadius: PILL / 2,
          // الظلُّ على الغلاف لا على الزجاج: `overflow: hidden` يقصّه.
          shadowColor: "#000",
          shadowOpacity: 0.28,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
          elevation: 14,
        }}
      >
        <View
          style={{
            flex: 1,
            borderRadius: PILL / 2,
            // زجاجُ آبل لا يُرسم داخل قصّ، والعدسةُ تكبر خارج حدّ الشريط — فالحدُّ
            // على الزجاج نفسه (`borderRadius`) لا على الحاوية.
            overflow: LiquidGlass ? "visible" : "hidden",
            borderWidth: LiquidGlass ? 0 : 1,
            borderColor: "rgba(255,255,255,.16)",
            // أندرويد لا يغبّش بلا طريقةٍ تجريبيّة، فالأرضيةُ الداكنة تكفيه وحدها.
            backgroundColor: LiquidGlass
              ? "transparent"
              : Platform.OS === "android"
                ? "rgba(20,24,28,.88)"
                : "rgba(20,24,28,.42)",
          }}
        >
          {LiquidGlass ? (
            <LiquidGlass
              glassEffectStyle="regular"
              colorScheme="dark"
              tintColor="rgba(14,26,36,.45)"
              style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, borderRadius: PILL / 2 }}
            />
          ) : Platform.OS !== "android" ? (
            <BlurView intensity={60} tint="systemUltraThinMaterialDark" style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }} />
          ) : null}

          <View
            ref={row}
            {...pan.panHandlers}
            onLayout={(event) => {
              setRowW(event.nativeEvent.layout.width);
              row.current?.measureInWindow((left) => {
                rowX.current = left;
              });
            }}
            style={{ flex: 1, flexDirection: "row", alignItems: "center", paddingHorizontal: 6 }}
          >
            {/* القرصُ الزجاجيّ: ينزلق بين التبويبات ويتبع الإصبع ويكبر تحته. */}
            <Animated.View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: 7,
                left: 0,
                height: PILL - 16,
                width: Math.max(slotW - 4, 0),
                borderRadius: (PILL - 16) / 2,
                backgroundColor: LiquidGlass ? "rgba(255,255,255,.14)" : "rgba(255,255,255,.18)",
                opacity: measured && showPill && !(LiquidLens && lensOn) ? 1 : 0,
                transform: [
                  { translateX: x },
                  { scale: lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.14] }) },
                ],
              }}
            >
              {/* إضاءةُ الرفع طبقةٌ بشفافيّةٍ لا لونٌ يُحسب: الشفافيّةُ تمشي على الخيط الأصليّ. */}
              <Animated.View
                style={{
                  flex: 1,
                  borderRadius: (PILL - 16) / 2,
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,.35)",
                  backgroundColor: "rgba(255,255,255,.1)",
                  opacity: lift,
                }}
              />
            </Animated.View>
            {items.map((item, index) => {
              const on = hover === null ? item.key === active : hover === index;
              // تحت العدسة: ما يمرّ عليه الإصبع، أو وجهةُ النقر وهي تنزلق إليها.
              const big = hover === index || (hover === null && lensAt === index);
              return (
                <Pressable
                  key={item.key}
                  onLayout={(event) => {
                    const { x: left, width } = event.nativeEvent.layout;
                    slots.current[index] = { x: left, w: width };
                    if (slots.current.filter(Boolean).length === items.length && !measured) {
                      if (activeIndex >= 0) moveTo(activeIndex, false);
                      setSlotW(slots.current[0]!.w);
                    }
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                  accessibilityState={{ selected: on }}
                  onPress={item.onPress}
                  onLongPress={item.onLongPress}
                  delayLongPress={450}
                  style={{ flex: 1, height: PILL - 14, alignItems: "center", justifyContent: "center" }}
                >
                  <Animated.View
                    style={{
                      height: PILL - 14,
                      alignSelf: "stretch",
                      marginHorizontal: 2,
                      borderRadius: (PILL - 14) / 2,
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: under(index),
                      transform: [{ scale: magnify(index) }],
                    }}
                  >
                    <Spot id={item.spot}>{item.render(on, LiquidLens && big ? colors.clay : on ? ON : OFF)}</Spot>
                  </Animated.View>
                </Pressable>
              );
            })}
            {/*
              العدسة — كعدسة شريط النظام: زجاجٌ صافٍ **فوق** الأيقونات لا تحتها، فيكسر
              ما تحته ويكبّره ويلوّن حافّته. أطولُ من الشريط ويتمطّط بسرعة الإصبع.
              لا يُلبس شفافيّةً ولا قصّاً — زجاجُ آبل تحت `opacity` أو داخل
              `overflow: hidden` لا يُرسم — فيظهر ويختفي بنمطه (`none` ↔ `clear`).
            */}
            {LiquidLens && measured ? (
              <Animated.View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  // بيضاويّةٌ لا دائرة: أعرضُ من التبويب، وأطولُ من الشريط قليلاً.
                  top: -4,
                  height: PILL + 8,
                  left: -LENS_WIDEN / 2,
                  width: slotW - 4 + LENS_WIDEN,
                  transform: [
                    { translateX: x },
                    { scaleX: Animated.add(lift.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.12] }), stretch) },
                    { scaleY: Animated.subtract(lift.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.12] }), Animated.multiply(stretch, 0.35)) },
                  ],
                }}
              >
                {/*
                  **العدسةُ نفسُها صافيةٌ لا زجاجٌ مغبّش** — زجاجُ آبل فوق زجاج الشريط يخرج
                  رمادياً معتماً يُذيب ما تحته، وما فوقه يُقرأ طبقتين. فالعدسةُ هنا قرصٌ داكنٌ
                  شفيفٌ بحافّةٍ مضيئة، يظهر ويختفي بشفافيّته (لا زجاجَ فيه يمنعها)، وما فيها
                  النسخةُ المكبَّرة وحدها.
                */}
                <Animated.View
                  style={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    left: 0,
                    right: 0,
                    borderRadius: (PILL + 8) / 2,
                    backgroundColor: "rgba(10,16,22,.42)",
                    borderWidth: 1.5,
                    borderColor: "rgba(255,255,255,.55)",
                    opacity: lift,
                  }}
                >
                  <View
                    style={{
                      flex: 1,
                      margin: 2,
                      borderRadius: (PILL + 8) / 2,
                      borderWidth: 1,
                      borderColor: "rgba(140,190,255,.22)",
                    }}
                  />
                </Animated.View>
                {/*
                  **ما تحت العدسة نسخةٌ مكبَّرةٌ واضحة** كعدسة شريط الهاتف: الزجاجُ وحده
                  يغبّش ما تحته، وبين تبويبين كان يُرى واحدٌ منهما. فالصفُّ كلُّه يُرسم ثانيةً
                  داخلها بلون الثيم، مكبّراً حول وسطها، ومزاحاً بعكس حركتها فيبقى كلُّ رسمٍ
                  فوق أصله — فيُرى نصفا التبويبين معاً حين تقف بينهما. والقصُّ على غلافٍ
                  أخٍ للزجاج لا عليه: زجاجُ آبل لا يُرسم داخل قصّ.
                */}
                <Animated.View
                  style={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    left: 0,
                    right: 0,
                    borderRadius: (PILL + 8) / 2,
                    overflow: "hidden",
                    opacity: lift,
                  }}
                >
                  <View style={{ flex: 1, transform: [{ scale: 1.25 }] }}>
                    <Animated.View
                      style={{
                        position: "absolute",
                        top: 4,
                        // `left` صريحٌ: بلا طرفٍ يجلس المطلقُ في جهة البداية — اليمين هنا.
                        left: 0,
                        height: PILL,
                        width: rowW,
                        flexDirection: "row",
                        alignItems: "center",
                        paddingHorizontal: 6,
                        transform: [{ translateX: Animated.add(Animated.multiply(x, -1), LENS_WIDEN / 2) }],
                      }}
                    >
                      {items.map((item) => (
                        <View key={item.key} style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                          {item.render(false, colors.clay)}
                        </View>
                      ))}
                    </Animated.View>
                  </View>
                </Animated.View>
              </Animated.View>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}
