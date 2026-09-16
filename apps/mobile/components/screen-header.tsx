import { View, Pressable } from "react-native";
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
}: {
  title: string;
  back?: string;
  right?: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        minHeight: 56,
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: colors.chrome,
      }}
    >
      <AthrMark size={32} />
      <Text face="display" style={{ flex: 1, color: colors.chromeInk, fontSize: 16, fontWeight: "700" }}>
        {title}
      </Text>

      {right}

      {back !== undefined ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="رجوع"
          hitSlop={12}
          onPress={() => (router.canGoBack() ? router.back() : router.replace(back as never))}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path
              d="M9 5l7 7-7 7"
              stroke={colors.chromeInk}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </Pressable>
      ) : null}
    </View>
  );
}
