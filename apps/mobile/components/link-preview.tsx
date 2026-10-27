import { Image, Pressable, View, type ViewStyle } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Text } from "./type";
import { api } from "../lib/api";
import { openIn } from "../lib/browse";
import { DEV_FEATURES } from "../lib/dev-features";
import { firstUrl } from "../lib/links";
import { colors } from "../theme/tokens";

type Preview = {
  url: string;
  site: string;
  title: string | null;
  description: string | null;
  image: string | null;
};

/**
 * معاينةُ أوّل رابطٍ في النصّ (القاعدة ٣٦٦): صورتُه المصغّرة واسمُ موقعه
 * وعنوانُه وسطرٌ من وصفه، والضغطةُ تفتحه في المتصفّح المدمج (القاعدة ٦٢).
 * الخادمُ يجلبها (`/v1/links/preview`) فلا يخرج عنوانُ الجهاز إلى الموقع،
 * والصورةُ تصل `data:` في الردّ نفسه. وما لا معاينةَ له لا يُرسم شيئاً —
 * الرابطُ في النصّ كما هو. في نسخة التطوير وحدها (القاعدة ٢٩١).
 */
export function LinkPreview({ text, style }: { text: string | null | undefined; style?: ViewStyle }) {
  const url = DEV_FEATURES ? firstUrl(text) : null;
  const state = useQuery({
    queryKey: ["link-preview", url],
    queryFn: () => api<{ preview: Preview | null }>(`/v1/links/preview?url=${encodeURIComponent(url ?? "")}`),
    enabled: !!url,
    staleTime: Infinity,
    gcTime: 60 * 60 * 1000,
    retry: false,
  });
  const preview = state.data?.preview;
  if (!url || !preview) return null;

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`افتح ${preview.title ?? preview.site}`}
      onPress={() => void openIn(preview.url)}
      style={({ pressed }) => ({
        alignSelf: "stretch",
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        padding: 8,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.line,
        backgroundColor: colors.paper,
        opacity: pressed ? 0.8 : 1,
        marginBottom: 8,
        ...style,
      })}
    >
      {preview.image ? (
        <Image source={{ uri: preview.image }} style={{ width: 56, height: 56, borderRadius: 10, backgroundColor: colors.chip }} />
      ) : null}
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text numberOfLines={1} style={{ color: colors.faint, fontSize: 10.5 }}>
          {preview.site}
        </Text>
        {preview.title ? (
          <Text numberOfLines={2} style={{ color: colors.ink, fontSize: 12.5, fontWeight: "700", lineHeight: 18 }}>
            {preview.title}
          </Text>
        ) : null}
        {preview.description ? (
          <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11.5 }}>
            {preview.description}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
