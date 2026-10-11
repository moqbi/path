import { View } from "react-native";
import { Text } from "./type";
import { MusicIcon, PlusIcon } from "./icons";
import { colors } from "../theme/tokens";

/**
 * فقاعةُ النوت (القاعدة ٢٦٩) فوق صورة صاحبها: سطرُ الأغنية ثمّ العبارة، وذيلٌ
 * صغير ينزل إلى الصورة — كفقاعة كلامٍ لا لافتة. وفارغةً لصاحبها «نوت» بزائد.
 */
export function NoteBubble({
  text,
  trackTitle,
  trackArtist,
  empty = false,
  size = "small",
  playing = false,
}: {
  text?: string | null;
  trackTitle?: string | null;
  trackArtist?: string | null;
  empty?: boolean;
  size?: "small" | "large";
  playing?: boolean;
}) {
  const large = size === "large";
  const width = large ? 220 : 78;
  return (
    <View style={{ alignItems: "center" }}>
      <View
        style={{
          maxWidth: width,
          minWidth: large ? 120 : 52,
          paddingHorizontal: large ? 14 : 8,
          paddingVertical: large ? 10 : 5,
          borderRadius: large ? 18 : 12,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.line,
          shadowColor: "#000",
          shadowOpacity: 0.12,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
          elevation: 3,
          alignItems: "center",
        }}
      >
        {empty ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
            <PlusIcon size={10} color={colors.muted} />
            <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "600" }}>نوت</Text>
          </View>
        ) : (
          <>
            {trackTitle ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, maxWidth: "100%" }}>
                <MusicIcon size={large ? 13 : 9} color={playing ? colors.live : colors.clayInk} />
                <Text
                  numberOfLines={1}
                  style={{ flexShrink: 1, color: colors.ink, fontSize: large ? 13 : 9.5, fontWeight: "700", writingDirection: "auto" }}
                >
                  {trackTitle}
                </Text>
              </View>
            ) : null}
            {trackTitle && trackArtist && (large || !text) ? (
              <Text numberOfLines={1} style={{ color: colors.muted, fontSize: large ? 11.5 : 8.5, writingDirection: "auto" }}>
                {trackArtist}
              </Text>
            ) : null}
            {text ? (
              <Text
                numberOfLines={large ? 3 : 2}
                style={{ color: colors.ink, fontSize: large ? 14 : 9.5, lineHeight: large ? 21 : 13, textAlign: "center", writingDirection: "auto" }}
              >
                {text}
              </Text>
            ) : null}
          </>
        )}
      </View>
      {/* الذيل: نقطتان تنزلان إلى الصورة. */}
      <View style={{ width: large ? 10 : 7, height: large ? 10 : 7, borderRadius: 5, marginTop: 2, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line }} />
    </View>
  );
}
