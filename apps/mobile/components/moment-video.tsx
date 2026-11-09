import { useState } from "react";
import { Pressable, View, type StyleProp, type ViewStyle } from "react-native";
import { Text } from "./type";
import { MediaImage } from "./media-image";
import { StoryVideo } from "./story-video";
import { PlayIcon } from "./icons";
import { PHOTO_RATIO } from "./photo-frame";

/**
 * مقطعُ اللحظة (القاعدة ٤٣٤) في إطار صورتها: غلافُه وزرُّ تشغيلٍ في وسطه، والضغطةُ
 * تشغّله في مكانه بصوته. لا يبدأ وحده: خطٌّ زمنيٌّ يشغّل كلَّ مقطعٍ يمرّ عليه
 * يأكل باقة صاحبه وبطاريّته ويُسمع ما لم يطلبه.
 */
export function MomentVideo({
  videoId,
  posterId,
  style,
}: {
  videoId: string;
  posterId: string | null;
  style?: StyleProp<ViewStyle>;
}) {
  const [playing, setPlaying] = useState(false);
  const [width, setWidth] = useState(0);
  const height = width / PHOTO_RATIO;
  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={[{ width: "100%", aspectRatio: PHOTO_RATIO, borderRadius: 14, overflow: "hidden", backgroundColor: "#0E1A24" }, style]}
    >
      {playing && width ? (
        <StoryVideo source={videoId} width={width} height={height} cover />
      ) : (
        <Pressable accessibilityLabel="شغّل المقطع" onPress={() => setPlaying(true)} style={{ flex: 1 }}>
          {posterId ? <MediaImage mediaId={posterId} style={{ width: "100%", height: "100%" }} /> : null}
          <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, alignItems: "center", justifyContent: "center" }}>
            <View style={{ width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(14,26,36,.62)", paddingLeft: 3 }}>
              <PlayIcon size={24} color="#fff" />
            </View>
          </View>
          <View style={{ position: "absolute", bottom: 10, right: 10, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, backgroundColor: "rgba(14,26,36,.62)" }}>
            <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>فيديو</Text>
          </View>
        </Pressable>
      )}
    </View>
  );
}

/**
 * علامةُ الفيديو على غلاف المقطع حيث لا يُشغَّل (القاعدة ٤٣٤): الكتابُ ورقٌ، والمعرضُ
 * لوحاتٌ معلّقة، والأرشيفُ شبكةٌ — تُرى الصورةُ ويُقال إنّها من مقطع.
 */
export function VideoBadge({ small = false }: { small?: boolean }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        bottom: small ? 5 : 8,
        left: small ? 5 : 8,
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        borderRadius: 999,
        paddingHorizontal: small ? 5 : 8,
        paddingVertical: small ? 2 : 3,
        backgroundColor: "rgba(14,26,36,.66)",
      }}
    >
      <PlayIcon size={small ? 9 : 11} color="#fff" />
      {small ? null : <Text style={{ color: "#fff", fontSize: 10.5, fontWeight: "700" }}>فيديو</Text>}
    </View>
  );
}
