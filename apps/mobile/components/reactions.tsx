import { Image } from "react-native";
import { Text } from "./type";

/**
 * الوجوه — نفس صور الويب بأعيانها، منسوخةً إلى أصول التطبيق.
 *
 * رسمُها إيموجي نظامٍ كان يجعلها تختلف بين أندرويد وiOS وبين الويب
 * والجوّال: الوجه الواحد أربعةُ وجوه. والصورة واحدةٌ في كل مكان.
 */
const SOURCES: Record<string, number> = {
  SMILE: require("../assets/reactions/smile.png"),
  LAUGH: require("../assets/reactions/laugh.png"),
  GASP: require("../assets/reactions/gasp.png"),
  SAD: require("../assets/reactions/sad.png"),
  LOVE: require("../assets/reactions/love.png"),
  SLEEPY: require("../assets/reactions/sleepy.png"),
};

/** الوجوه العامة، ويُزاد وجه النوم للحظات النوم وحدها. */
const OPEN_FACES = ["SMILE", "LAUGH", "GASP", "SAD", "LOVE"] as const;

export const facesFor = (kind?: string): readonly string[] =>
  kind === "SLEEP" ? [...OPEN_FACES, "SLEEPY"] : OPEN_FACES;

/**
 * الإيموجي الحرّ لمشتركي آثار+ — قائمتُه في `lib/emoji.ts`.
 *
 * كانت ثمانيةً وأربعين، والاشتراك يَعِد بـ«كل كيبوردك» — فصارت
 * مجموعاتٍ لها عناوين، نسخةً واحدةً مع الويب.
 */
export { CUSTOM, EMOJI_GROUPS, type EmojiGroup } from "../lib/emoji";

export function ReactionGlyph({
  kind,
  emoji,
  size = 20,
}: {
  kind: string;
  emoji?: string | null;
  size?: number;
}) {
  if (kind === "CUSTOM") {
    return <Text style={{ fontSize: size * 0.92 }}>{emoji ?? "🙂"}</Text>;
  }
  return (
    <Image
      source={SOURCES[kind] ?? SOURCES.SMILE}
      style={{ width: size, height: size }}
      resizeMode="contain"
    />
  );
}
