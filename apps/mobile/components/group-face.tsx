import { View } from "react-native";
import { MediaImage } from "./media-image";
import { WithIcon } from "./icons";
import { colors } from "../theme/tokens";

/**
 * وجهُ المجموعة (القاعدة ٢٤١): صورتُها إن اختارها المشرف، وإلّا رمزُ «مع» على
 * أرضيّةٍ كهرمانيّة — في قائمة المحادثات ورأس المجموعة وصفحة إدارتها سواء.
 */
export function GroupFace({ photoMediaId, size }: { photoMediaId?: string | null; size: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.claySoft,
      }}
    >
      {photoMediaId ? (
        <MediaImage mediaId={photoMediaId} style={{ width: size, height: size }} />
      ) : (
        <WithIcon size={Math.round(size * 0.48)} color={colors.clayInk} />
      )}
    </View>
  );
}
