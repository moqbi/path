import { View, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "./type";
import { useRouter } from "expo-router";
import Svg, { Path } from "react-native-svg";
import { AthrMark } from "./brand";
import { colors } from "../theme/tokens";

/**
 * رأس الشاشة: الشعار ثابتٌ ثم العنوان.
 *
 * الشعار لا يختفي ليحلّ العنوان مكانه — كان ذلك يجعل كل شاشةٍ تبدو
 * تطبيقاً آخر. والرجوع في الطرف، وسهمُه يشير يميناً لأنّ القراءة من
 * اليمين: سهمٌ يساريّ في واجهةٍ عربية يعني «للأمام».
 */
export function ScreenHeader({
  title,
  back,
  right,
  onTitlePress,
}: {
  title: string;
  back?: string;
  right?: React.ReactNode;
  /** اسمٌ في الرأس قد يكون باباً: اسمُ من تحادثه يفتح ملفّه. */
  onTitlePress?: () => void;
}) {
  const router = useRouter();
  /*
    حشوةُ الحافّة العليا في الرأس نفسه لا في `SafeAreaView` فوقه.

    كانت الشاشة تُغلَّف بـ`edges={["top"]}` على أرضيةٍ فاتحة، فيخرج
    شريطُ الحالة فاتحاً فوق رأسٍ داكن — يُقرأ فراغاً فوق التطبيق لا
    جزءاً منه. والرأسُ داكنٌ أصلاً (القاعدة ٢٩)، فإذا ابتلع الحشوة
    امتدّ إلى أعلى الشاشة واتّصل بها.
  */
  const insets = useSafeAreaInsets();

  const backButton =
    back !== undefined ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="رجوع"
        hitSlop={12}
        onPress={() => (router.canGoBack() ? router.back() : router.replace(back as never))}
      >
        <BackChevron />
      </Pressable>
    ) : null;

  /*
    **الرجوعُ في طرف البداية — اليمين** (القاعدة ٣٣٠): أوّلُ صفٍّ في جذرٍ من اليمين يجلس
    يميناً، والقارئُ العربيّ يبدأ من هناك كما يبدأ سحبُ آبل الأصليّ من الحافّة اليمنى. ثمّ
    العلامةُ والعنوان، وما في `right` من أزرارٍ في الطرف الآخر — اليسار (الاسمُ تاريخيّ).
  */
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        minHeight: 56,
        paddingHorizontal: 16,
        paddingTop: insets.top + 8,
        paddingBottom: 8,
        backgroundColor: colors.chrome,
      }}
    >
      {backButton}
      <AthrMark size={32} />
      {onTitlePress ? (
        <Pressable accessibilityRole="link" onPress={onTitlePress} style={{ flex: 1, minWidth: 0 }} hitSlop={8}>
          <Text face="display" style={{ color: colors.chromeInk, fontSize: 16, fontWeight: "700" }}>
            {title}
          </Text>
        </Pressable>
      ) : (
        <Text face="display" style={{ flex: 1, color: colors.chromeInk, fontSize: 16, fontWeight: "700" }}>
          {title}
        </Text>
      )}

      {right}
    </View>
  );
}

/** سهمُ الرجوع: يشير يميناً — إلى حيث جئت في قراءةٍ من اليمين. */
export function BackChevron({ color = colors.chromeInk }: { color?: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M9 5l7 7-7 7" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
