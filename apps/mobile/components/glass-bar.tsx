import { View, Pressable, Platform } from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Tabs, usePathname, useRouter } from "expo-router";
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
  const router = useRouter();
  const path = usePathname();
  const me = useSession((s) => s.me);
  const unseen = useNoteCount().data?.unseen ?? 0;
  const unread = useUnreadDm().data?.unread ?? 0;

  const current = state.routes[state.index]?.name;
  // ملفُّ الصديق يُضيء «الأصدقاء»: من هناك يُفتح (القاعدة ٤٢).
  const active = path.startsWith("/u/") ? "circle" : current;

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
    render: (on: boolean) => React.ReactNode;
  }[] = [
    {
      key: "index",
      label: "اللحظات",
      spot: "tab.index",
      onPress: () => go("index"),
      // الضغطةُ المطوّلة بابُ العدستين (القاعدة ٢٦).
      onLongPress: onLongHome,
      render: (on) => <HomeIcon size={ICON} color={on ? ON : OFF} />,
    },
    {
      key: "circle",
      label: "الأصدقاء",
      spot: "tab.circle",
      onPress: () => go("circle"),
      render: (on) => <CircleIcon size={ICON} color={on ? ON : OFF} />,
    },
    {
      key: "chats",
      label: "المحادثات",
      spot: "tab.chats",
      onPress: () => router.push("/messages" as never),
      render: () => (
        <View>
          <MessageIcon size={ICON} color={OFF} />
          {unread > 0 ? <Badge count={unread} /> : null}
        </View>
      ),
    },
    {
      key: "notifications",
      label: "الإشعارات",
      spot: "tab.notifications",
      onPress: () => go("notifications"),
      render: (on) => (
        <View>
          <BellIcon size={ICON} color={on ? ON : OFF} />
          {unseen > 0 && !on ? <Badge /> : null}
        </View>
      ),
    },
    {
      key: "store",
      label: "المتجر",
      spot: "tab.store",
      onPress: () => go("store"),
      render: (on) => <StoreIcon size={ICON} color={on ? ON : OFF} />,
    },
    {
      key: "me",
      label: "أنا",
      spot: "tab.me",
      onPress: () => go("me"),
      render: (on) => (
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1.5,
            borderColor: on ? ON : "transparent",
          }}
        >
          <Avatar name={me?.name ?? ""} size={27} mediaId={me?.avatarMediaId ?? null} />
        </View>
      ),
    },
  ];

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
            overflow: "hidden",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,.16)",
            // أندرويد لا يغبّش بلا طريقةٍ تجريبيّة، فالأرضيةُ الداكنة تكفيه وحدها.
            backgroundColor: Platform.OS === "android" ? "rgba(20,24,28,.88)" : "rgba(20,24,28,.42)",
          }}
        >
          {Platform.OS !== "android" ? (
            <BlurView intensity={60} tint="systemUltraThinMaterialDark" style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }} />
          ) : null}

          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", paddingHorizontal: 6 }}>
            {items.map((item) => {
              const on = item.key === active;
              return (
                <Pressable
                  key={item.key}
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
                      backgroundColor: on && item.key !== "me" ? "rgba(255,255,255,.18)" : "transparent",
                    }}
                  >
                    <Spot id={item.spot}>{item.render(on)}</Spot>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}
