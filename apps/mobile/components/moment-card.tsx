import { View, Text, Pressable, Image, Linking } from "react-native";
import { useRouter } from "expo-router";
import { Avatar, firstColor } from "./avatar";
import { MediaImage } from "./media-image";
import { PinIcon, PlayIcon, WithIcon, SunIcon, MoonIcon, PlaneIcon, GiftIcon, SparkIcon } from "./icons";
import { MomentBar } from "./moment-bar";
import { Bubble, CommentList, Reactors } from "./reactors";
import { colors } from "../theme/tokens";
import { ar, relative, timeOfDay } from "../lib/format";
import type { Moment } from "../lib/queries";

/** عمود الصور على محور الخط: نفس ٥٦ التي في الويب (`w-14`). */
export const SPINE_W = 56;

/**
 * ما يُقرأ سطراً لا بطاقة.
 *
 * «وصل إلى الرياض» و«نمت» خبرٌ في سطرٍ على ورق الخط نفسه، لا بطاقةٌ
 * بإطار. والتفريق في العرض لا في الخادم.
 */
const EVENTS = new Set([
  "CITY", "PLACE", "SLEEP", "WAKE", "MUSIC", "FRIEND_ADDED", "GIFT_SENT", "GIFT_GOT",
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

function EventIcon({ kind }: { kind: string }) {
  const style = EVENT_STYLE[kind] ?? EVENT_STYLE.PLACE;
  const glyph =
    kind === "CITY" ? <PlaneIcon size={16} color={style.ink} />
    : kind === "SLEEP" ? <MoonIcon size={16} color={style.ink} />
    : kind === "WAKE" ? <SunIcon size={16} color={style.ink} />
    : kind === "MUSIC" ? <PlayIcon size={14} color={style.ink} />
    : kind === "FRIEND_ADDED" ? <WithIcon size={15} color={style.ink} />
    : kind === "GIFT_SENT" || kind === "GIFT_GOT" ? <GiftIcon size={15} color={style.ink} />
    : <PinIcon size={16} color={style.ink} />;

  return (
    <View
      style={{
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: style.bg,
      }}
    >
      {glyph}
    </View>
  );
}

/** نصّ الخبر — منقولٌ من الويب لا مترجماً عنه. */
function eventText(moment: Moment, withNames: string[]) {
  switch (moment.kind) {
    case "CITY":
      return { title: `وصل إلى ${moment.text ?? "مدينة"}`, subtitle: null };
    case "SLEEP":
      return { title: "نمت", subtitle: "تصبح على خير" };
    case "WAKE":
      // ساعتُه خبرُه: تُقرأ من الطابع لا من نصٍّ محفوظ يتجمّد.
      return { title: "صحيت", subtitle: `الساعة ${timeOfDay(new Date(moment.createdAt))}` };
    case "FRIEND_ADDED":
      return { title: `أصبح صديق ${moment.text ?? "أحدهم"}`, subtitle: null };
    case "GIFT_SENT":
      return { title: `أهديت ${withNames[0] ?? "صديقاً"} ${moment.text ?? "هدية"}`, subtitle: null };
    case "GIFT_GOT":
      return { title: `وصلتك هدية من ${withNames[0] ?? "صديق"}: ${moment.text ?? "هدية"}`, subtitle: null };
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

/**
 * صفُّ اللحظة: عمودُ الصورة والساعة على محور الخط، ثم المتن، ثم زرّ
 * التفاعل في الطرف — ترتيبُ الويب نفسه.
 */
export function MomentCard({
  moment,
  viewerId,
  isPlus,
}: {
  moment: Moment;
  viewerId: string;
  isPlus: boolean;
}) {
  const router = useRouter();
  const withNames = moment.tags.map((t) => t.name);
  const open = () => router.push(`/m/${moment.id}` as never);
  const isEvent = EVENTS.has(moment.kind);
  const found = moment.reactions.find((r) => r.mine);
  const mineReaction = found ? { kind: found.kind, emoji: found.emoji } : null;

  const spine = (
    <View style={{ width: SPINE_W, alignItems: "center", gap: 5 }}>
      <Pressable
        onPress={() =>
          router.push((moment.author.id === viewerId ? "/me" : `/u/${moment.author.id}`) as never)
        }
      >
        <Avatar
          name={moment.author.name}
          size={46}
          mediaId={moment.author.avatarMediaId}
          frameSpec={moment.author.frame?.spec}
          charm={moment.author.charm}
        />
      </Pressable>
      <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "600" }}>
        {timeOfDay(new Date(moment.createdAt))}
      </Text>
    </View>
  );

  if (isEvent) {
    const { title, subtitle } = eventText(moment, withNames);

    const line = (
      <Pressable onPress={open} style={{ flexDirection: "row", gap: 10 }}>
        <EventIcon kind={moment.kind} />
        <View style={{ flex: 1, paddingTop: 2 }}>
          <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "600", lineHeight: 21 }}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={{ color: colors.ink2, fontSize: 12, fontWeight: "500", marginTop: 2 }}>
              {subtitle}
            </Text>
          ) : null}
          {withNames.length > 0 && moment.kind !== "GIFT_SENT" && moment.kind !== "GIFT_GOT" ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 }}>
              <WithIcon size={12} color={colors.ink2} />
              <Text style={{ color: colors.ink2, fontSize: 11.5, fontWeight: "500" }}>
                مع {withNames.join(" و")}
              </Text>
            </View>
          ) : null}
        </View>

        {/*
          صورة الأغنية هي زرّ تشغيلها: زرٌّ ثالثٌ بجانبها كان يزاحم زرّ
          التفاعل في الطرف نفسه. والمثلّث فوقها لا في وسطها — الوسط يحجب
          وجهها.
        */}
        {moment.kind === "MUSIC" && moment.musicThumb ? (
          <Pressable
            accessibilityLabel="استمع"
            disabled={!moment.musicUrl}
            onPress={() => moment.musicUrl && void Linking.openURL(moment.musicUrl)}
            style={{ width: 44, height: 44, borderRadius: 12, overflow: "hidden", backgroundColor: colors.chip }}
          >
            <Image source={{ uri: moment.musicThumb }} style={{ width: 44, height: 44 }} resizeMode="cover" />
            {moment.musicUrl ? (
              <View
                style={{
                  position: "absolute",
                  top: 3,
                  insetInlineStart: 3,
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(14,26,36,.68)",
                }}
              >
                <PlayIcon size={11} color="#fff" />
              </View>
            ) : null}
          </Pressable>
        ) : null}
      </Pressable>
    );

    return (
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, paddingBottom: 20 }}>
        {spine}
        <View style={{ flex: 1 }}>
          <MomentBar
            momentId={moment.id}
            momentKind={moment.kind}
            mine={mineReaction}
            isPlus={isPlus}
            author={moment.author.id === viewerId}
            head={line}
            extra={
              <>
                {moment.mediaId ? (
                  <MediaImage
                    mediaId={moment.mediaId}
                    style={{ width: "100%", height: 190, borderRadius: 14, marginTop: 10 }}
                  />
                ) : null}
                <Bubble moment={moment} viewerId={viewerId} />
              </>
            }
          />
        </View>
      </View>
    );
  }

  const head = (
    <Pressable onPress={open}>
      {moment.mediaId ? (
        <MediaImage mediaId={moment.mediaId} style={{ width: "100%", height: 230 }} />
      ) : moment.imageSpec ? (
        <View style={{ height: 132, backgroundColor: firstColor(moment.imageSpec, colors.chip) }} />
      ) : null}

      <View style={{ paddingHorizontal: 14, paddingTop: 10 }}>
        {moment.text ? (
          <Text style={{ color: colors.ink, fontSize: 13.5, lineHeight: 23, marginBottom: 8 }}>
            {moment.text}
          </Text>
        ) : null}

        {/* الموقع على لحظةٍ أو صورة: سطرٌ صغير، لا حدثُ مكانٍ مستقل. */}
        {moment.placeName ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 8 }}>
            <PinIcon size={12} color={colors.muted} />
            <Text style={{ color: colors.muted, fontSize: 12 }}>{moment.placeName}</Text>
          </View>
        ) : null}

        {withNames.length > 0 ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <WithIcon size={13} color={colors.muted} />
            <Text style={{ color: colors.muted, fontSize: 12 }}>مع {withNames.join(" و")}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );

  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, paddingBottom: 20 }}>
      {spine}

      <View
        style={{
          flex: 1,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.line,
          backgroundColor: colors.card,
          overflow: "hidden",
        }}
      >
        {/* زرّ التفاعل في أعلى البطاقة: يُلمس قبل القراءة لا بعدها. */}
        <MomentBar
          momentId={moment.id}
          momentKind={moment.kind}
          mine={mineReaction}
          isPlus={isPlus}
          author={moment.author.id === viewerId}
          inset
          panelFirst
          extra={
            <>
              {head}
              <View style={{ paddingHorizontal: 14, paddingBottom: 12, paddingTop: 8 }}>
                {moment.reactions.length > 0 ? (
                  <Reactors reactions={moment.reactions} viewerId={viewerId} />
                ) : null}
                {moment.comments.length > 0 ? (
                  <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10 }}>
                    <CommentList comments={moment.comments} viewerId={viewerId} />
                    {moment._count.comments > moment.comments.length ? (
                      <Pressable onPress={open} style={{ marginTop: 8 }}>
                        <Text style={{ color: colors.clayInk, fontSize: 12, fontWeight: "600" }}>
                          كل التعليقات ({ar(moment._count.comments)})
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </View>
            </>
          }
        />
      </View>
    </View>
  );
}
