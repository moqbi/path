import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Avatar, firstColor } from "./avatar";
import { MediaImage } from "./media-image";
import { PinIcon, PlayIcon, StarIcon } from "./icons";
import { colors } from "../theme/tokens";
import { ar, relative, timeOfDay } from "../lib/format";
import type { Moment } from "../lib/queries";

/**
 * اللحظات التي تُقرأ سطراً لا بطاقة.
 *
 * «وصل إلى الرياض» و«نمت» خبرٌ في سطر، لا بطاقةٌ بصورةٍ ونصّ. والتفريق
 * هنا لا في الخادم: نفس الصفّ يُعرض سطراً أو بطاقةً بحسب نوعه.
 */
const EVENTS = new Set([
  "CITY",
  "PLACE",
  "SLEEP",
  "WAKE",
  "MUSIC",
  "FRIEND_ADDED",
  "GIFT_SENT",
  "GIFT_GOT",
]);

const EVENT_STYLE: Record<string, { bg: string; ink: string }> = {
  CITY: { bg: colors.night, ink: "#f7f5ef" },
  PLACE: { bg: colors.liveSoft, ink: colors.live },
  SLEEP: { bg: colors.night2, ink: "#f7f5ef" },
  WAKE: { bg: colors.goldSoft, ink: colors.goldInk },
  MUSIC: { bg: colors.clay, ink: colors.onBrand },
  FRIEND_ADDED: { bg: colors.goldSoft, ink: colors.goldInk },
  GIFT_SENT: { bg: colors.claySoft, ink: colors.clayInk },
  GIFT_GOT: { bg: colors.claySoft, ink: colors.clayInk },
};

/** نصّ الخبر — نفس الصياغة التي في الويب، لا ترجمةً حرّة لها. */
function eventText(moment: Moment, withNames: string[]) {
  switch (moment.kind) {
    case "CITY":
      return { title: `وصل إلى ${moment.text ?? "مدينة"}`, subtitle: null };
    case "SLEEP":
      return { title: "نمت", subtitle: "تصبح على خير" };
    case "WAKE":
      // خبر «صحيت» ساعتُه: تُقرأ من طابع اللحظة لا من نصٍّ محفوظ.
      return { title: "صحيت", subtitle: `الساعة ${timeOfDay(new Date(moment.createdAt))}` };
    case "FRIEND_ADDED":
      return { title: `أصبح صديق ${moment.text ?? "أحدهم"}`, subtitle: null };
    case "GIFT_SENT":
      return { title: `أهديت ${withNames[0] ?? "صديقاً"} ${moment.text ?? "هدية"}`, subtitle: null };
    case "GIFT_GOT":
      return {
        title: `وصلتك هدية من ${withNames[0] ?? "صديق"}: ${moment.text ?? "هدية"}`,
        subtitle: null,
      };
    case "MUSIC":
      return {
        title: `يسمع ${moment.musicTitle ?? "أغنية"}${moment.musicArtist ? ` لـ${moment.musicArtist}` : ""}`,
        subtitle: null,
      };
    default:
      return {
        title: `في ${moment.placeName ?? "مكان"}`,
        subtitle: [moment.placeCity, moment.text].filter(Boolean).join(" · ") || null,
      };
  }
}

function Tag({ tag }: { tag: { name: string; bg: string; fg: string } }) {
  return (
    <View style={{ backgroundColor: tag.bg, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 }}>
      <Text style={{ color: tag.fg, fontSize: 9.5, fontWeight: "700" }}>{tag.name}</Text>
    </View>
  );
}

export function MomentCard({ moment }: { moment: Moment }) {
  const router = useRouter();
  const withNames = moment.tags.map((t) => t.name);
  const open = () => router.push(`/m/${moment.id}` as never);

  if (EVENTS.has(moment.kind)) {
    const style = EVENT_STYLE[moment.kind] ?? EVENT_STYLE.PLACE;
    const { title, subtitle } = eventText(moment, withNames);

    return (
      <Pressable onPress={open} style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 16 }}>
        <Avatar
          name={moment.author.name}
          size={34}
          mediaId={moment.author.avatarMediaId}
          frameSpec={moment.author.frame?.spec}
          charm={moment.author.charm}
        />
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: style.bg,
          }}
        >
          {moment.kind === "PLACE" || moment.kind === "CITY" ? (
            <PinIcon size={15} color={style.ink} />
          ) : (
            <StarIcon size={13} color={style.ink} />
          )}
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.ink, fontSize: 13.5 }} numberOfLines={2}>
            <Text style={{ fontWeight: "700" }}>{moment.author.name} </Text>
            {title}
          </Text>
          {subtitle ? (
            <Text style={{ color: colors.muted, fontSize: 11.5, marginTop: 1 }}>{subtitle}</Text>
          ) : null}
        </View>

        {/* زرّ التشغيل فوق صورة الأغنية لا بجانبها. */}
        {moment.kind === "MUSIC" && moment.musicThumb ? (
          <View style={{ width: 44, height: 44, borderRadius: 8, overflow: "hidden", backgroundColor: colors.chip }}>
            <View style={{ position: "absolute", top: 3, insetInlineStart: 3, zIndex: 2 }}>
              <PlayIcon size={12} color="#fff" />
            </View>
          </View>
        ) : null}

        <Text style={{ color: colors.faint, fontSize: 10.5 }}>
          {relative(new Date(moment.createdAt))}
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={open}
      style={{
        marginHorizontal: 16,
        marginBottom: 12,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.line,
        backgroundColor: colors.card,
        overflow: "hidden",
      }}
    >
      <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10, padding: 12 }}>
        <Avatar
          name={moment.author.name}
          size={38}
          mediaId={moment.author.avatarMediaId}
          frameSpec={moment.author.frame?.spec}
          charm={moment.author.charm}
        />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 5 }}>
            <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "700" }}>
              {moment.author.name}
            </Text>
            {moment.author.tag ? <Tag tag={moment.author.tag} /> : null}
            {moment.author.isPlus ? <StarIcon size={12} color={colors.clay} /> : null}
          </View>
          <Text style={{ color: colors.faint, fontSize: 11 }}>
            {relative(new Date(moment.createdAt))}
            {withNames.length > 0 ? ` · مع ${withNames.join("، ")}` : ""}
          </Text>
        </View>
      </View>

      {moment.text ? (
        <Text style={{ color: colors.ink, fontSize: 14, lineHeight: 23, paddingHorizontal: 12, paddingBottom: 10 }}>
          {moment.text}
        </Text>
      ) : null}

      {moment.mediaId ? (
        <MediaImage mediaId={moment.mediaId} style={{ width: "100%", aspectRatio: 1 }} />
      ) : moment.imageSpec ? (
        <View style={{ width: "100%", aspectRatio: 1, backgroundColor: firstColor(moment.imageSpec, colors.chip) }} />
      ) : null}

      {moment.placeName ? (
        <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingTop: 9 }}>
          <PinIcon size={13} color={colors.muted} />
          <Text style={{ color: colors.muted, fontSize: 11.5 }}>
            {[moment.placeName, moment.placeCity].filter(Boolean).join(" · ")}
          </Text>
        </View>
      ) : null}

      <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 12, padding: 12 }}>
        {moment.reactions.length > 0 ? (
          <Text style={{ color: colors.muted, fontSize: 11.5 }}>
            {ar(moment.reactions.length)} تفاعل
          </Text>
        ) : null}
        {moment._count.comments > 0 ? (
          <Text style={{ color: colors.muted, fontSize: 11.5 }}>
            {ar(moment._count.comments)} تعليق
          </Text>
        ) : null}
        <View style={{ flex: 1 }} />
        {moment._count.views > 0 ? (
          <Text style={{ color: colors.faint, fontSize: 11 }}>
            شافها {ar(moment._count.views)}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
