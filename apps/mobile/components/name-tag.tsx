import { View } from "react-native";
import { Text } from "./type";
import { SparkIcon } from "./icons";
import { SUPPORTER_TAG } from "@athar/shared";
import { colors } from "../theme/tokens";

export type Tag = { name: string; bg: string; fg: string } | null | undefined;

/**
 * الوسم — نسخةُ `NameTag` في الويب حرفاً بحرف.
 *
 * ما يُعرض بجانب الاسم: نجمةُ آثار+ أوّلاً، ثم وسمٌ يمنحه المشرف. ومكانٌ
 * واحد يرسمه في كل شاشة، فلا يختلف شكله بين الخط الزمني والتعليقات
 * والأصدقاء (القاعدة ١٦).
 *
 * والمشتركُ ينال النجمةَ ووسمَ «داعم» معها (`SUPPORTER_TAG`) — ووسمٌ
 * يمنحه المشرفُ لشخصٍ بعينه يسبقه.
 */
export function NameTag({
  isPlus,
  tag,
  size = 11,
}: {
  isPlus?: boolean;
  tag?: Tag;
  size?: number;
}) {
  if (!isPlus && !tag) return null;

  return (
    <>
      {isPlus ? (
        <SparkIcon size={Math.round(size * 1.25)} color={colors.clay} />
      ) : null}
      <TagPill tag={tag ?? (isPlus ? SUPPORTER_TAG : null)} size={size} />
    </>
  );
}

export function TagPill({ tag, size = 11 }: { tag: Tag; size?: number }) {
  if (!tag) return null;

  return (
    <View
      style={{
        flexShrink: 0,
        borderRadius: 999,
        paddingHorizontal: size * 0.64,
        paddingVertical: size * 0.2,
        backgroundColor: tag.bg,
      }}
    >
      <Text style={{ color: tag.fg, fontSize: size, fontWeight: "700" }}>{tag.name}</Text>
    </View>
  );
}
