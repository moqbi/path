import { Platform } from "react-native";
import { Tabs } from "expo-router";
import { NativeTabs, Icon, Label, Badge } from "expo-router/unstable-native-tabs";
import { GlassBar, useAppBadge } from "../../components/glass-bar";
import { ar } from "../../lib/format";
import { colors } from "../../theme/tokens";
import { useSession } from "../../lib/session";
import { useTabAvatar } from "../../lib/tab-avatar";

/**
 * التبويباتُ الخمسة: اللحظات، الأصدقاء، المحادثات، المتجر، أنا.
 *
 * **على آبل شريطُ النظام نفسه** (`NativeTabs` ← `UITabBarController`) — **بقرار
 * المالك** (القاعدة ٢٦١): عدسةُ الزجاج التي تكبّر ما تحتها وتلوّنه لا يرسمها
 * تطبيقٌ بنفسه، يرسمها شريطُ آبل لمن يستعمله — كالهاتف وواتساب. وكلُّ تقليدٍ لها
 * في جافاسكربت خرج مغبّشاً أو طبقتين. والثمنُ ما يفرضه النظام: خمسةُ تبويباتٍ
 * لا ستّة (الإشعاراتُ صارت أيقونةً في رأس اللحظات)، ولا ضغطةَ مطوّلة (العدساتُ
 * أزرارٌ فوق اللحظات)، وما لا تبويبَ له يُفتح فوق الشريط لا تحته (ملفُّ الصديق
 * والإشعارات في المكدّس الجذر).
 *
 * وأندرويد والويب على الشريط الزجاجيّ المرسوم (`GlassBar`) كما كان، بالتبويبات
 * الخمسة نفسها.
 */
export default function TabsLayout() {
  const { unread } = useAppBadge();
  // «أنا» صورةُ صاحبها كما كانت في الشريط الزجاجيّ (القاعدة ٢٢٨).
  const avatar = useTabAvatar(useSession((state) => state.me?.avatarMediaId));

  if (Platform.OS === "ios") {
    return (
      <NativeTabs
        backBehavior="history"
        tintColor={colors.clay}
        badgeBackgroundColor={colors.live}
      >
        <NativeTabs.Trigger name="index">
          <Icon sf={{ default: "house", selected: "house.fill" }} />
          <Label>اللحظات</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="circle">
          <Icon sf={{ default: "person.2", selected: "person.2.fill" }} />
          <Label>الأصدقاء</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="messages">
          <Icon sf={{ default: "bubble.left", selected: "bubble.left.fill" }} />
          <Label>المحادثات</Label>
          {unread > 0 ? <Badge>{unread > 99 ? "+٩٩" : ar(unread)}</Badge> : <Badge hidden />}
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="store">
          <Icon sf={{ default: "bag", selected: "bag.fill" }} />
          <Label>المتجر</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="me">
          {avatar ? (
            <Icon src={avatar} />
          ) : (
            <Icon sf={{ default: "person.crop.circle", selected: "person.crop.circle.fill" }} />
          )}
          <Label>أنا</Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    );
  }

  return (
    <Tabs
      // الرجوعُ بتاريخ التنقّل لا إلى أوّل تبويب.
      backBehavior="history"
      // الشريطُ زجاجٌ عائمٌ يُرسم بنفسه (القاعدة ٢٢٨)، والمحتوى يمرّ تحته.
      tabBar={(props) => <GlassBar {...props} />}
      screenOptions={{
        headerShown: false,
        // الشاشةُ على أرضيّتها — شفّافةً حين يلبس صاحبُها ثيماً بصورة.
        sceneStyle: { backgroundColor: colors.ground },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "اللحظات" }} />
      <Tabs.Screen name="circle" options={{ title: "الأصدقاء" }} />
      <Tabs.Screen name="messages" options={{ title: "المحادثات" }} />
      <Tabs.Screen name="store" options={{ title: "المتجر" }} />
      <Tabs.Screen name="me" options={{ title: "أنا" }} />
    </Tabs>
  );
}
