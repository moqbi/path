import { useEffect, useRef, useState } from "react";
import { Animated, View, Pressable, Platform, PanResponder } from "react-native";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import { BlurView } from "expo-blur";
import { LiquidGlass } from "../lib/liquid-glass";
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
    if (active !== name && !event.defaultPrevented) navigation.navigate(name as never);
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
  const x = useRef(new Animated.Value(0)).current;
  const w = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(0)).current;
  // تمطّطُ العدسة بسرعة الإصبع — كعدسة شريط النظام: تطول وهي تُسحب وتعود حين تقف.
  const stretch = useRef(new Animated.Value(0)).current;
  const [hover, setHover] = useState<number | null>(null);
  // العدسةُ تظهر لحظةَ الانتقال بالنقر أيضاً، لا مع السحب وحده.
  const [flash, setFlash] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const releasedAt = useRef(0);
  const [measured, setMeasured] = useState(false);
  const hoverRef = useRef<number | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const activeIndex = items.findIndex((item) => item.key === active);
  const activeRef = useRef(activeIndex);
  activeRef.current = activeIndex;
  const showPill = hover !== null || (activeIndex >= 0 && active !== "me");

  const moveTo = (index: number, spring = true) => {
    const slot = slots.current[index];
    if (!slot) return;
    const to = { x: slot.x + 2, w: slot.w - 4 };
    if (spring) {
      // النقرُ وحده يُومض العدسة؛ بعد السحب تختفي ساعةَ يُرفع الإصبع لا بعد ثوانٍ.
      if (LiquidGlass && hoverRef.current === null && Date.now() - releasedAt.current > 600) {
        setFlash(true);
        if (flashTimer.current) clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(() => setFlash(false), 260);
      }
      Animated.spring(x, { toValue: to.x, useNativeDriver: false, speed: 22, bounciness: 7 }).start();
      Animated.spring(w, { toValue: to.w, useNativeDriver: false, speed: 22, bounciness: 7 }).start();
    } else {
      x.setValue(to.x);
      w.setValue(to.w);
    }
  };

  // القرصُ يتبع التبويبَ المفتوح حين لا يكون إصبعٌ على الشريط.
  useEffect(() => {
    if (measured && hoverRef.current === null && activeIndex >= 0) moveTo(activeIndex);
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
    const widths = slots.current;
    if (!first) return;
    const slotW = first.w;
    const min = Math.min(...widths.map((s) => s.x)) + 2;
    const max = Math.max(...widths.map((s) => s.x)) + 2;
    x.setValue(Math.min(max, Math.max(min, local - slotW / 2 + 2)));
    w.setValue(slotW - 4);
    const index = indexAt(pageX);
    if (index !== hoverRef.current) {
      hoverRef.current = index;
      setHover(index);
      void Haptics.selectionAsync().catch(() => undefined);
    }
  };

  const release = (pageX: number | null) => {
    const index = pageX === null ? null : indexAt(pageX);
    releasedAt.current = Date.now();
    hoverRef.current = null;
    setHover(null);
    Animated.spring(lift, { toValue: 0, useNativeDriver: false, speed: 18, bounciness: 6 }).start();
    Animated.spring(stretch, { toValue: 0, useNativeDriver: false, speed: 16, bounciness: 10 }).start();
    if (index !== null) {
      moveTo(index);
      itemsRef.current[index]?.onPress();
    }
    // ما لم يغيّر التبويب (التبويبُ نفسه) يعود القرصُ إلى مكانه.
    setTimeout(() => {
      if (hoverRef.current === null && activeRef.current >= 0) moveTo(activeRef.current);
    }, 280);
  };

  const pan = useRef(
    PanResponder.create({
      // النقرُ يبقى للأزرار، والسحبةُ الأفقيّة تُؤخذ منها.
      onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderGrant: (event) => {
        row.current?.measureInWindow((left) => {
          rowX.current = left;
        });
        Animated.spring(lift, { toValue: 1, useNativeDriver: false, speed: 20, bounciness: 8 }).start();
        follow(event.nativeEvent.pageX);
      },
      onPanResponderMove: (event, g) => {
        follow(event.nativeEvent.pageX);
        Animated.spring(stretch, {
          toValue: Math.min(Math.abs(g.vx) * 0.12, 0.28),
          useNativeDriver: false,
          speed: 30,
          bounciness: 0,
        }).start();
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
            onLayout={() =>
              row.current?.measureInWindow((left) => {
                rowX.current = left;
              })
            }
            style={{ flex: 1, flexDirection: "row", alignItems: "center", paddingHorizontal: 6 }}
          >
            {/* القرصُ الزجاجيّ: ينزلق بين التبويبات ويتبع الإصبع ويكبر تحته. */}
            <Animated.View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: 7,
                height: PILL - 16,
                left: x,
                width: w,
                borderRadius: (PILL - 16) / 2,
                backgroundColor: LiquidGlass
                  ? "rgba(255,255,255,.14)"
                  : lift.interpolate({
                      inputRange: [0, 1],
                      outputRange: ["rgba(255,255,255,.18)", "rgba(255,255,255,.28)"],
                    }),
                borderWidth: 1,
                borderColor: lift.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["rgba(255,255,255,0)", "rgba(255,255,255,.35)"],
                }),
                opacity: measured && showPill && !(LiquidGlass && (hover !== null || flash)) ? 1 : 0,
                transform: [{ scale: lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.14] }) }],
              }}
            />
            {items.map((item, index) => {
              const on = hover === null ? item.key === active : hover === index;
              const big = hover === index;
              return (
                <Pressable
                  key={item.key}
                  onLayout={(event) => {
                    const { x: left, width } = event.nativeEvent.layout;
                    slots.current[index] = { x: left, w: width };
                    if (slots.current.filter(Boolean).length === items.length && !measured) {
                      setMeasured(true);
                      if (activeIndex >= 0) moveTo(activeIndex, false);
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
                  <View
                    style={{
                      height: PILL - 14,
                      alignSelf: "stretch",
                      marginHorizontal: 2,
                      borderRadius: (PILL - 14) / 2,
                      alignItems: "center",
                      justifyContent: "center",
                      transform: [{ scale: big ? 1.18 : 1 }],
                    }}
                  >
                    <Spot id={item.spot}>{item.render(on, LiquidGlass && big ? colors.clay : on ? ON : OFF)}</Spot>
                  </View>
                </Pressable>
              );
            })}
            {/*
              العدسة — كعدسة شريط النظام: زجاجٌ صافٍ **فوق** الأيقونات لا تحتها، فيكسر
              ما تحته ويكبّره ويلوّن حافّته. أطولُ من الشريط ويتمطّط بسرعة الإصبع.
              لا يُلبس شفافيّةً ولا قصّاً — زجاجُ آبل تحت `opacity` أو داخل
              `overflow: hidden` لا يُرسم — فيظهر ويختفي بنمطه (`none` ↔ `clear`).
            */}
            {LiquidGlass && measured ? (
              <Animated.View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  // بيضاويّةٌ لا دائرة: أعرضُ من التبويب بمرّةٍ ونصف، وأطولُ من الشريط قليلاً.
                  top: -4,
                  height: PILL + 8,
                  left: Animated.add(x, -LENS_WIDEN / 2),
                  width: Animated.add(w, LENS_WIDEN),
                  transform: [
                    { scaleX: Animated.add(lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }), stretch) },
                    { scaleY: Animated.subtract(lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }), Animated.multiply(stretch, 0.35)) },
                  ],
                }}
              >
                <LiquidGlass
                  glassEffectStyle={{ style: hover !== null || flash ? "clear" : "none", animate: true, animationDuration: 0.14 }}
                  isInteractive
                  colorScheme="dark"
                  style={{ flex: 1, borderRadius: (PILL + 8) / 2 }}
                />
              </Animated.View>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}
