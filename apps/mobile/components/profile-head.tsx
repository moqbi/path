import { Pressable, View } from "react-native";
import { Text } from "./type";
import { AvatarMenu, type WornItem } from "./avatar-menu";
import { NoteBubble } from "./note-bubble";
import { openNote } from "../lib/status-notes";
import { frameBleed, type Charm, type Frame } from "./avatar";
import { NameTag } from "./name-tag";
import { BackIcon } from "./icons";
import { PulseRing } from "./pulse-ring";
import { MarqueeName } from "./marquee-name";
import { colors } from "../theme/tokens";
import { ar, membership } from "../lib/format";

/** مقاسُ الصورة في رأس الملفّ — «أنا» وملفُّ الصديق سواء. */
export const PROFILE_AVATAR = 104;

/**
 * هويّةُ الملفّ تحت الغلاف (القاعدة ٢٣٣) — **بقرار المالك**، ونسخةٌ واحدة
 * لـ«أنا» وملفّ الصديق: الصورةُ في طرف البداية تعبر حافّةَ الغلاف، والاسمُ
 * ووسمُه بجانبها في الوسط، ثمّ النبذةُ وسطرُ العضويّة بعرض الشاشة.
 * كان الملفّان يرسمان الصورةَ في الوسط بمقاسين (١٠٤ و٧٨) فيُقرآن صفحتين من
 * تطبيقين.
 */
export function ProfileHead({
  name,
  isPlus,
  tag,
  handle,
  bio,
  memberNo,
  city,
  since,
  mediaId,
  frame,
  charm,
  frameItem,
  charmItem,
  note,
  onAccounts,
  actions,
  story,
}: {
  /** أقراصُ الأفعال في طرف سطر الاسم — ملفُّ الصديق (القاعدة ٣٢٠). */
  actions?: React.ReactNode;
  /**
   * قصّتُه على صورته (القاعدة ٣٢٠): الضغطُ يفتحها بدل قائمة الصورة، ودوائرُ تنبض حولها
   * ما دام فيها ما لم يُشاهَد (`fresh`)، وحلقةٌ ساكنة بعدها.
   */
  story?: { fresh: boolean; open: () => void } | null;
  /** سهمٌ على يمين الاسم يفتح نافذةَ الحسابات (القاعدة ٣١٦) — في «أنا» وحدها. */
  onAccounts?: () => void;
  /** النوتُ فوق الصورة (القاعدة ٢٦٩) — ضغطُها يفتحها ويُسمع أغنيتها. */
  note?: { id: string; text: string | null; trackTitle: string | null; trackArtist: string | null; gifId?: string | null; gifW?: number | null; gifH?: number | null } | null;
  name: string;
  isPlus: boolean;
  tag?: { name: string; bg: string; fg: string } | null;
  handle?: string | null;
  bio?: string | null;
  memberNo: number;
  city?: string | null;
  /** تاريخُ الانضمام — يُقرأ «لك معانا …» (القاعدة ٧٥). */
  since: string;
  mediaId: string | null;
  frame?: Frame;
  charm?: Charm;
  frameItem: WornItem;
  charmItem: WornItem;
}) {
  const size = PROFILE_AVATAR;
  /*
    سطرُ العضويّة **بقرار المالك**: «عضوية رقم │ المعرّف │ المدينة │ لك معانا»،
    والمعرّفُ فيه لا تحت الاسم. والمعرّفُ لاتينيٌّ داخل سطرٍ عربيّ، فيُعزَل
    (`\u2068…\u2069`) وإلّا جرّ الفاصلَ بعده إلى جهته فاختلّ الترتيب.
  */
  const meta = [
    `عضوية رقم ${ar(memberNo)}`,
    handle ? `\u2068@${handle}\u2069` : null,
    city || null,
    `لك معانا ${membership(since)}`,
  ]
    .filter(Boolean)
    .join("  │  ");
  return (
    <View style={{ paddingHorizontal: 20 }}>
      {/*
        الصورةُ في طرف البداية تعبر حافّةَ الغلاف، والاسمُ بجانبها **تحت** الحافّة
        لا عليها، وكلُّ ما يُقرأ بعده — النبذةُ وسطرُ العضويّة — على الطرف نفسه:
        كان الاسمُ يتوسّط ما بقي من السطر والنبذةُ تتوسّط الشاشة، فيُقرأ كلٌّ في
        جهة، ويلتصق الاسمُ بالغلاف حين يكون تحته معرّف.
      */}
      <View style={{ flexDirection: "row", alignItems: "flex-start", marginTop: -size / 2 }}>
        <View>
          {story?.fresh ? <PulseRing size={size} /> : null}
          <AvatarMenu
            name={name}
            size={size}
            mediaId={mediaId}
            frame={frame}
            charm={charm}
            frameItem={frameItem}
            charmItem={charmItem}
          />
          {story ? (
            <Pressable
              accessibilityLabel={`قصة ${name}`}
              onPress={story.open}
              style={{ position: "absolute", left: 0, top: 0, width: size, height: size, borderRadius: size / 2, zIndex: 2 }}
            >
              {story.fresh ? null : (
                <View pointerEvents="none" style={{ position: "absolute", left: -4, top: -4, right: -4, bottom: -4, borderRadius: size, borderWidth: 2, borderColor: colors.groundInk, opacity: 0.35 }} />
              )}
            </Pressable>
          ) : null}
          {note ? (
            <Pressable
              accessibilityLabel="النوت"
              onPress={() => openNote(note.id)}
              style={{ position: "absolute", bottom: size - 6, left: -30, right: -30, alignItems: "center", zIndex: 3 }}
            >
              <NoteBubble text={note.text} trackTitle={note.trackTitle} trackArtist={note.trackArtist} gif={note.gifId ? { id: note.gifId, w: note.gifW, h: note.gifH } : null} />
            </Pressable>
          ) : null}
        </View>
        {/* التشارم تتدلّى من ركن الصورة نحو الاسم (القاعدة ٥٩): مسافةٌ تتّسع لها. */}
        <View style={{ flex: 1, minWidth: 0, alignItems: "flex-start", paddingRight: 34, paddingLeft: actions ? 8 : 0, marginTop: size / 2 + 10 }}>
          <Pressable
            disabled={!onAccounts}
            onPress={onAccounts}
            accessibilityLabel={onAccounts ? "الحسابات" : undefined}
            hitSlop={8}
            style={{ flexDirection: "row", alignItems: "center", gap: 8, maxWidth: "100%" }}
          >
            {onAccounts ? (
              <View style={{ transform: [{ rotate: "-90deg" }] }}>
                <BackIcon size={16} color={colors.groundInk} />
              </View>
            ) : null}
            {actions ? (
              // أقراصٌ في طرف السطر: الاسمُ الطويل ينزلق في مكانه لا يُقصّ (القاعدة ٣٢٢).
              <MarqueeName name={name} style={{ color: colors.groundInk, fontSize: 20, fontWeight: "700", writingDirection: "auto" }} />
            ) : (
            <Text
              numberOfLines={1}
              style={{ color: colors.groundInk, fontSize: 20, fontWeight: "700", flexShrink: 1, writingDirection: "auto" }}
            >
              {name}
            </Text>
            )}
            <NameTag isPlus={isPlus} tag={tag} size={12} />
          </Pressable>
        </View>
        {actions ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: size / 2 + 6 }}>{actions}</View>
        ) : null}
      </View>

      {/* ما يخرج من الإطار تحت الصورة لا يلتصق بما بعده. */}
      <View style={{ alignItems: "flex-start", marginTop: 12 + frameBleed(size, frame) }}>
        {bio ? (
          <Text style={{ color: colors.groundInk, fontSize: 13.5, textAlign: "right", lineHeight: 22, writingDirection: "auto" }}>
            {bio}
          </Text>
        ) : null}
        <Text style={{ color: colors.groundInk, fontSize: 11.5, marginTop: bio ? 6 : 0, textAlign: "right" }}>{meta}</Text>
      </View>
    </View>
  );
}
