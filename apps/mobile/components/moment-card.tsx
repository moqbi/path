import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Avatar, firstColor } from "./avatar";
import { MediaImage } from "./media-image";
import { PinIcon, PlayIcon, WithIcon, SunIcon, MoonIcon, PlaneIcon, GiftIcon, SparkIcon } from "./icons";
import { ReactionGlyph, facesFor } from "./reactions";
import { colors } from "../theme/tokens";
import { ar, relative, timeOfDay } from "../lib/format";
import { useReact, type Moment } from "../lib/queries";

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
 * زرّ التفاعل في طرف اللحظة.
 *
 * زرٌّ واحد يفتح الوجوه؛ ولوحةٌ مفتوحة على كل لحظةٍ ضجيج. ويُطوى بعد
 * الاختيار — الوجه فعلٌ كامل بنفسه.
 */
function ReactButton({ moment, isPlus }: { moment: Moment; isPlus: boolean }) {
  const [open, setOpen] = useState(false);
  const react = useReact(moment.id);
  const mine = moment.reactions.find((r) => r.mine) ?? null;
  const faces = facesFor(moment.kind);

  return (
    <View style={{ alignItems: "center" }}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityLabel="تفاعل"
        style={{
          width: 34,
          height: 34,
          borderRadius: 17,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: mine ? colors.goldLine : colors.line,
          backgroundColor: mine ? colors.goldSoft : colors.card,
        }}
      >
        {mine ? (
          <ReactionGlyph kind={mine.kind} emoji={mine.emoji} size={19} />
        ) : (
          <SparkIcon size={15} color={colors.muted} />
        )}
      </Pressable>

      {open ? (
        <View
          style={{
            position: "absolute",
            top: 40,
            insetInlineStart: -6,
            zIndex: 20,
            flexDirection: "row-reverse",
            gap: 4,
            padding: 6,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: colors.line,
            backgroundColor: colors.card,
          }}
        >
          {faces.map((face) => (
            <Pressable
              key={face}
              onPress={() => {
                setOpen(false);
                react.mutate({ kind: face });
              }}
              hitSlop={4}
            >
              <ReactionGlyph kind={face} size={24} />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
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
    return (
      <View style={{ flexDirection: "row-reverse", alignItems: "flex-start", gap: 8, paddingBottom: 20 }}>
        {spine}

        <Pressable onPress={open} style={{ flex: 1, flexDirection: "row-reverse", gap: 10, paddingTop: 4 }}>
          <EventIcon kind={moment.kind} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "600", lineHeight: 21 }}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={{ color: colors.ink2, fontSize: 12, fontWeight: "500", marginTop: 2 }}>
                {subtitle}
              </Text>
            ) : null}
            {withNames.length > 0 && moment.kind !== "GIFT_SENT" && moment.kind !== "GIFT_GOT" ? (
              <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 5, marginTop: 2 }}>
                <WithIcon size={12} color={colors.ink2} />
                <Text style={{ color: colors.ink2, fontSize: 11.5, fontWeight: "500" }}>
                  مع {withNames.join(" و")}
                </Text>
              </View>
            ) : null}

            {moment.mediaId ? (
              <MediaImage
                mediaId={moment.mediaId}
                style={{ width: "100%", height: 190, borderRadius: 14, marginTop: 10 }}
              />
            ) : null}
          </View>
        </Pressable>

        <ReactButton moment={moment} isPlus={isPlus} />
      </View>
    );
  }

  return (
    <View style={{ flexDirection: "row-reverse", alignItems: "flex-start", gap: 8, paddingBottom: 20 }}>
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
        {/* زرّ التفاعل أعلى البطاقة: يُلمس قبل القراءة لا بعدها. */}
        <View style={{ alignItems: "flex-start", paddingHorizontal: 10, paddingTop: 8 }}>
          <ReactButton moment={moment} isPlus={isPlus} />
        </View>

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

            {moment.placeName ? (
              <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 5, marginBottom: 8 }}>
                <PinIcon size={12} color={colors.muted} />
                <Text style={{ color: colors.muted, fontSize: 12 }}>{moment.placeName}</Text>
              </View>
            ) : null}

            {withNames.length > 0 ? (
              <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 5 }}>
                <WithIcon size={13} color={colors.muted} />
                <Text style={{ color: colors.muted, fontSize: 12 }}>مع {withNames.join(" و")}</Text>
              </View>
            ) : null}
          </View>
        </Pressable>

        <View style={{ paddingHorizontal: 14, paddingBottom: 12, paddingTop: 8 }}>
          {moment.reactions.length > 0 ? (
            <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 4 }}>
              {moment.reactions.slice(0, 5).map((r) => (
                <ReactionGlyph key={r.userId} kind={r.kind} emoji={r.emoji} size={17} />
              ))}
              <Text style={{ color: colors.muted, fontSize: 11.5, marginStart: 3 }}>
                {moment.reactions.map((r) => r.name).join("، ")}
              </Text>
            </View>
          ) : null}

          {moment.comments.length > 0 ? (
            <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10, gap: 8 }}>
              {moment.comments.map((c) => (
                <View key={c.id} style={{ flexDirection: "row-reverse", gap: 8 }}>
                  <Avatar name={c.user.name} size={26} mediaId={c.user.avatarMediaId} />
                  <Text style={{ flex: 1, color: colors.ink2, fontSize: 12.5, lineHeight: 20 }}>
                    <Text style={{ fontWeight: "700", color: colors.ink }}>{c.user.name} </Text>
                    {c.body}
                  </Text>
                </View>
              ))}
              {moment._count.comments > moment.comments.length ? (
                <Pressable onPress={open}>
                  <Text style={{ color: colors.clayInk, fontSize: 12, fontWeight: "600" }}>
                    كل التعليقات ({ar(moment._count.comments)})
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}
