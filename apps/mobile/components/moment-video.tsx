import { Pressable, View, type StyleProp, type ViewStyle } from "react-native";
import { Text } from "./type";
import { MediaImage } from "./media-image";
import { viewVideo } from "./video-viewer";
import { PlayIcon } from "./icons";
import { PHOTO_RATIO } from "./photo-frame";

/**
 * مقطعُ اللحظة (القاعدة ٤٣٤) في إطار صورتها: غلافُه وزرُّ تشغيلٍ في وسطه، والضغطةُ تفتحه
 * بملء الشاشة (`viewVideo` — القاعدة ٤٣٧) كالصورة. لا يبدأ وحده: خطٌّ زمنيٌّ يشغّل كلَّ
 * مقطعٍ يمرّ عليه يأكل باقة صاحبه وبطاريّته ويُسمع ما لم يطلبه.
 */
export function MomentVideo({
  videoId,
  posterId,
  style,
  ratio,
}: {
  /** نسبةُ إطار لحظة آثار+ (القاعدة ٤٧٤) — نسبةُ مقطعها، وبلاها نسبةُ البطاقة. */
  ratio?: number | null;
  videoId: string;
  posterId: string | null;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityLabel="شغّل المقطع"
      onPress={() => viewVideo(videoId)}
      style={[{ width: "100%", aspectRatio: ratio ?? PHOTO_RATIO, borderRadius: 14, overflow: "hidden", backgroundColor: "#0E1A24" }, style]}
    >
      {posterId ? <MediaImage mediaId={posterId} style={{ width: "100%", height: "100%" }} /> : null}
      <View pointerEvents="none" style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, alignItems: "center", justifyContent: "center" }}>
        <View style={{ width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(14,26,36,.62)", paddingLeft: 3 }}>
          <PlayIcon size={24} color="#fff" />
        </View>
      </View>
      <View pointerEvents="none" style={{ position: "absolute", bottom: 10, right: 10, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, backgroundColor: "rgba(14,26,36,.62)" }}>
        <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>فيديو</Text>
      </View>
    </Pressable>
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
