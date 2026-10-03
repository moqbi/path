import { View } from "react-native";
import { Text } from "./type";
import { AvatarMenu, type WornItem } from "./avatar-menu";
import { frameBleed, type Charm, type Frame } from "./avatar";
import { NameTag } from "./name-tag";
import { colors } from "../theme/tokens";

/** مقاسُ الصورة في رأس الملفّ — «أنا» وملفُّ الصديق سواء. */
export const PROFILE_AVATAR = 104;

/**
 * هويّةُ الملفّ تحت الغلاف (القاعدة ٢٣٣) — **بقرار المالك**، ونسخةٌ واحدة
 * لـ«أنا» وملفّ الصديق: الصورةُ في طرف البداية تعبر حافّةَ الغلاف، والاسمُ
 * ووسمُه والمعرّفُ بجانبها في الوسط، ثمّ النبذةُ وسطرُ العضويّة بعرض الشاشة.
 * كان الملفّان يرسمان الصورةَ في الوسط بمقاسين (١٠٤ و٧٨) فيُقرآن صفحتين من
 * تطبيقين.
 */
export function ProfileHead({
  name,
  isPlus,
  tag,
  handle,
  bio,
  meta,
  mediaId,
  frame,
  charm,
  frameItem,
  charmItem,
}: {
  name: string;
  isPlus: boolean;
  tag?: { name: string; bg: string; fg: string } | null;
  handle?: string | null;
  bio?: string | null;
  meta: string;
  mediaId: string | null;
  frame?: Frame;
  charm?: Charm;
  frameItem: WornItem;
  charmItem: WornItem;
}) {
  const size = PROFILE_AVATAR;
  return (
    <View style={{ paddingHorizontal: 20 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", marginTop: -size / 2 }}>
        <AvatarMenu
          name={name}
          size={size}
          mediaId={mediaId}
          frame={frame}
          charm={charm}
          frameItem={frameItem}
          charmItem={charmItem}
        />
        {/* التميمةُ تتدلّى من ركن الصورة نحو الاسم (القاعدة ٥٩): مسافةٌ تتّسع لها. */}
        <View style={{ flex: 1, minWidth: 0, alignItems: "center", paddingRight: 18, paddingBottom: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, maxWidth: "100%" }}>
            <Text
              numberOfLines={1}
              style={{ color: colors.ink, fontSize: 20, fontWeight: "700", flexShrink: 1, writingDirection: "auto" }}
            >
              {name}
            </Text>
            <NameTag isPlus={isPlus} tag={tag} size={12} />
          </View>
          {handle ? (
            <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2, writingDirection: "ltr" }}>@{handle}</Text>
          ) : null}
        </View>
      </View>

      {/* ما يخرج من الإطار تحت الصورة لا يلتصق بما بعده. */}
      <View style={{ alignItems: "center", marginTop: 12 + frameBleed(size, frame) }}>
        {bio ? (
          <Text style={{ color: colors.ink2, fontSize: 13, textAlign: "center", lineHeight: 22, maxWidth: 320 }}>
            {bio}
          </Text>
        ) : null}
        <Text style={{ color: colors.muted, fontSize: 11.5, marginTop: bio ? 6 : 0, textAlign: "center" }}>{meta}</Text>
      </View>
    </View>
  );
}
