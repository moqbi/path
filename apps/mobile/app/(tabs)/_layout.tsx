import { View } from "react-native";
import { Tabs } from "expo-router";
import { BellIcon, CircleIcon, HomeIcon, StoreIcon, UserIcon } from "../../components/icons";
import { useNoteCount } from "../../lib/queries";
import { colors } from "../../theme/tokens";

/**
 * الشريط السفلي — نفس التبويبات الخمسة وبنفس ترتيبها في الويب.
 *
 * والنقطة فوق جرس الإشعارات عددٌ لا يُكتب: الرقم فوق الأيقونة يقول
 * «أنجز هذه المهام»، والنقطة تقول «فيه جديد» — وهذا ما نريده.
 */
function Dot() {
  return (
    <View
      style={{
        position: "absolute",
        top: -1,
        insetInlineEnd: -4,
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: colors.clay,
      }}
    />
  );
}

export default function TabsLayout() {
  const { data } = useNoteCount();
  const unseen = data?.unseen ?? 0;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.clayInk,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.line,
          height: 62,
          paddingTop: 4,
          paddingBottom: 6,
        },
        tabBarLabelStyle: { fontSize: 9.5, fontWeight: "500" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "اللحظات",
          tabBarIcon: ({ color }) => <HomeIcon size={19} color={color} />,
        }}
      />
      <Tabs.Screen
        name="circle"
        options={{
          title: "الأصدقاء",
          tabBarIcon: ({ color }) => <CircleIcon size={19} color={color} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "الإشعارات",
          tabBarIcon: ({ color, focused }) => (
            <View>
              <BellIcon size={19} color={color} />
              {unseen > 0 && !focused ? <Dot /> : null}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="store"
        options={{
          title: "المتجر",
          tabBarIcon: ({ color }) => <StoreIcon size={19} color={color} />,
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: "أنا",
          tabBarIcon: ({ color }) => <UserIcon size={19} color={color} />,
        }}
      />
    </Tabs>
  );
}
