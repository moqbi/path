import { useMemo, useState } from "react";
import { View, SectionList, Pressable, ScrollView, ActivityIndicator, RefreshControl } from "react-native";
import { Text } from "../../components/type";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Avatar, firstColor } from "../../components/avatar";
import { MediaImage } from "../../components/media-image";
import { ScreenHeader } from "../../components/screen-header";
import { ReactionGlyph } from "../../components/reactions";
import { MessageIcon, SparkIcon, StoreIcon, TagIcon, WithIcon } from "../../components/icons";
import { useNotes, type Note } from "../../lib/queries";
import { usePullRefresh } from "../../lib/refresh";
import { dayLabel, relative } from "../../lib/format";
import { colors } from "../../theme/tokens";

/**
 * الوجهة تُفكّ هنا.
 *
 * الخادم يرسل وجهةً منطقية (`moment:<id>`) لا مسار صفحة: الويب والموبايل
 * يرتّبان شاشاتهما كما يشاءان، والخادم لا يعرف تسمية أيّهما.
 */
function go(href: string): string | null {
  const [kind, id] = href.split(":");
  if (kind === "moment" && id) return `/m/${id}`;
  if (kind === "user" && id) return `/u/${id}`;
  if (kind === "circle") return "/circle";
  if (kind === "me") return "/me";
  if (kind === "store") return "/store";
  return null;
}

/** الشرائح والتجميع بأعيانها من `src/app/notifications/page.tsx`. */
const FILTERS = [
  { key: "", label: "الكل" },
  { key: "reactions", label: "التفاعلات" },
  { key: "tags", label: "الإشارات" },
  { key: "messages", label: "الرسائل" },
  /*
    «آثار»: ما يأتي من التطبيق نفسه لا من صديق — جديدُ المتجر وما كان
    لفترةٍ محدودة، وما يُضاف بعدها من أخبار. خبرُ المتجر بين تفاعلات
    الأصدقاء يُقرأ إعلاناً في غير مكانه.
  */
  { key: "athar", label: "آثار" },
] as const;

const OF: Record<string, Note["kind"][]> = {
  reactions: ["REACTION", "COMMENT"],
  tags: ["TAG"],
  messages: ["MESSAGE"],
  athar: ["STORE"],
};

/** لون دائرة النوع: التفاعل كهرماني، الإشارة مرجانية، الصداقة خضراء. */
const KIND_STYLE: Record<Note["kind"], { bg: string; ink: string }> = {
  REACTION: { bg: colors.claySoft, ink: colors.clayInk },
  COMMENT: { bg: colors.chip, ink: colors.ink2 },
  TAG: { bg: colors.liveSoft, ink: colors.live },
  FRIEND: { bg: "#e3f3e8", ink: "#2f9e58" },
  MESSAGE: { bg: colors.goldSoft, ink: colors.goldInk },
  GIFT: { bg: colors.goldSoft, ink: colors.goldInk },
  STORE: { bg: colors.claySoft, ink: colors.clayInk },
};

function KindBadge({ note }: { note: Note }) {
  const style = KIND_STYLE[note.kind];

  return (
    <View
      style={{
        position: "absolute",
        bottom: -4,
        left: -4,
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: style.bg,
        borderWidth: 1.5,
        borderColor: colors.card,
      }}
    >
      {note.kind === "REACTION" ? (
        <ReactionGlyph kind={note.reaction ?? "SMILE"} emoji={note.emoji} size={12} />
      ) : note.kind === "TAG" ? (
        <TagIcon size={11} color={style.ink} />
      ) : note.kind === "FRIEND" ? (
        <WithIcon size={11} color={style.ink} />
      ) : note.kind === "GIFT" ? (
        <SparkIcon size={11} color={style.ink} />
      ) : note.kind === "STORE" ? (
        <StoreIcon size={11} color={style.ink} />
      ) : (
        <MessageIcon size={11} color={style.ink} />
      )}
    </View>
  );
}

/**
 * الإشعارات — بالشكل نفسه في الويب والجوّال.
 *
 * شرائح التصفية، ثم عناوين الأيام، ثم صفٌّ في قالبٍ أبيض: الصورة ومعها
 * دائرة النوع (من فعل، وماذا فعل)، ثم النصّ والوقت، ثم مصغّرة اللحظة.
 * والصفّ العاري بلا قالبٍ كان يجعل الإشعارات تُقرأ قائمةً واحدة طويلة
 * لا أحداثاً منفصلة.
 *
 * ودائرةُ النوع تُستثنى من مقعد التميمة (القاعدة ٤٧): ركنُها مشغول.
 */
export default function Notifications() {
  const notes = useNotes();
  const pullRefresh = usePullRefresh(notes.refetch);
  const router = useRouter();
  const [filter, setFilter] = useState<string>("");

  const days = useMemo(() => {
    const all = notes.data?.notes ?? [];
    const kinds = filter ? OF[filter] : undefined;
    const shown = kinds ? all.filter((note) => kinds.includes(note.kind)) : all;

    const out: { title: string; data: Note[] }[] = [];
    for (const note of shown) {
      const label = dayLabel(new Date(note.at));
      const last = out.at(-1);
      if (last && last.title === label) last.data.push(note);
      else out.push({ title: label, data: [note] });
    }
    return out;
  }, [notes.data, filter]);

  return (
    <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScreenHeader title="الإشعارات" />

      {/* الشرائح خارج منطقة التمرير: تبقى تحت اليد مهما نزلت القائمة. */}
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ flexDirection: "row", gap: 8 }}
        >
          {FILTERS.map((one) => {
            const on = filter === one.key;
            return (
              <Pressable
                key={one.key || "all"}
                onPress={() => setFilter(one.key)}
                style={{
                  borderRadius: 999,
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  backgroundColor: on ? colors.clay : colors.card,
                  borderWidth: 1,
                  borderColor: on ? colors.clay : colors.line,
                }}
              >
                <Text
                  style={{
                    color: on ? colors.onBrand : colors.ink2,
                    fontSize: 12.5,
                    fontWeight: "600",
                  }}
                >
                  {one.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <SectionList
        sections={days}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 90, flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            {...pullRefresh}
            tintColor={colors.clay}
          />
        }
        renderSectionHeader={({ section }) => (
          <Text
            style={{
              color: colors.faint,
              fontSize: 11.5,
              fontWeight: "600",
              letterSpacing: 0.3,
              paddingHorizontal: 4,
              paddingBottom: 8,
              textAlign: "right",
            }}
          >
            {section.title}
          </Text>
        )}
        renderItem={({ item }) => {
          const target = go(item.href);
          return (
            <Pressable
              onPress={() => target && router.push(target as never)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.line,
                backgroundColor: colors.card,
                padding: 12,
                marginBottom: 8,
              }}
            >
              <View>
                {item.person ? (
                  <Avatar
                    name={item.person.name}
                    size={44}
                    mediaId={item.person.avatarMediaId}
                  />
                ) : (
                  /* خبرُ المتجر لا صاحب له، فرسمُ الصنف مكان الصورة. */
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      overflow: "hidden",
                      backgroundColor: firstColor(item.item?.spec, colors.chip),
                    }}
                  >
                    {item.item?.mediaId ? (
                      <MediaImage
                        mediaId={item.item.mediaId}
                        style={{ width: 44, height: 44 }}
                      />
                    ) : null}
                  </View>
                )}
                <KindBadge note={item} />
              </View>

              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={{ color: colors.ink, fontSize: 13.5, lineHeight: 21, textAlign: "right" }}
                  numberOfLines={2}
                >
                  {item.text}
                </Text>
                <Text style={{ color: colors.faint, fontSize: 11, marginTop: 2, textAlign: "right" }}>
                  {relative(new Date(item.at))}
                </Text>
              </View>

              {item.thumb ? (
                <MediaImage mediaId={item.thumb} style={{ width: 44, height: 44, borderRadius: 12 }} />
              ) : null}
            </Pressable>
          );
        }}
        ListEmptyComponent={
          notes.isLoading ? (
            <View style={{ paddingTop: 60, alignItems: "center" }}>
              <ActivityIndicator color={colors.clay} />
            </View>
          ) : (
            <View style={{ paddingTop: 60, paddingHorizontal: 30, alignItems: "center", gap: 8 }}>
              <Text style={{ color: colors.ink, fontSize: 14.5, fontWeight: "700" }}>
                ما فيه إشعارات
              </Text>
              <Text
                style={{ color: colors.muted, fontSize: 12.5, lineHeight: 21, textAlign: "center" }}
              >
                حين يتفاعل أحدٌ من أصدقائك أو يشير إليك، يظهر هنا.
              </Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}
