import { View } from "react-native";
import { Image } from "expo-image";
import { gifUrl } from "../lib/status-notes";
import { Text } from "./type";
import { MusicIcon, PlusIcon } from "./icons";
import { colors } from "../theme/tokens";

/**
 * فقاعةُ النوت (القاعدة ٢٦٩) فوق صورة صاحبها: سطرُ الأغنية ثمّ العبارة، وذيلٌ
 * صغير ينزل إلى الصورة — كفقاعة كلامٍ لا لافتة. وفارغةً لصاحبها «نوت» بزائد.
 * والصورةُ المتحرّكة (القاعدة ٣١٥) أعلاها: وحدَها في الصغيرة — مكانُ الشريط لا يتّسع
 * لسطرٍ معها — وبنسبتها فوق الأغنية والعبارة في الكبيرة.
 */
export function NoteBubble({
  text,
  trackTitle,
  trackArtist,
  empty = false,
  size = "small",
  playing = false,
  gif,
}: {
  gif?: { id: string; w?: number | null; h?: number | null } | null;
  text?: string | null;
  trackTitle?: string | null;
  trackArtist?: string | null;
  empty?: boolean;
  size?: "small" | "large";
  playing?: boolean;
}) {
  const large = size === "large";
  const width = large ? 220 : 78;
  // الكبيرةُ بنسبتها حتى ١٨٠ عرضاً و١٦٠ ارتفاعاً، والصغيرةُ بارتفاعٍ يتّسع له الشريط.
  const ratio = gif?.w && gif?.h ? gif.w / gif.h : 1;
  const gifH = large ? Math.min(160, 180 / ratio) : 30;
  const gifW = Math.min(large ? 180 : 66, gifH * ratio);
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
        ) : gif && !large ? (
          <Image source={{ uri: gifUrl(gif.id) }} style={{ width: gifW, height: gifH, borderRadius: 6 }} contentFit="cover" />
        ) : (
          <>
            {gif ? (
              <Image
                source={{ uri: gifUrl(gif.id) }}
                style={{ width: gifW, height: gifH, borderRadius: 10, marginBottom: trackTitle || text ? 6 : 0 }}
                contentFit="cover"
              />
            ) : null}
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
                numberOfLines={large ? 3 : trackTitle ? 1 : 2}
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
