import { useState } from "react";
import { View, FlatList, ActivityIndicator, Pressable, Alert, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Text } from "../../../components/type";
import { ScreenHeader } from "../../../components/screen-header";
import { MediaImage } from "../../../components/media-image";
import { Avatar } from "../../../components/avatar";
import { AthrMark } from "../../../components/brand";
import { PrivateIcon } from "../../../components/icons";
import { ReactionGlyph } from "../../../components/reactions";
import { api } from "../../../lib/api";
import { ar, MONTHS, timeOfDay } from "../../../lib/format";
import { momentLine, privateNote, withNames, type Book, type BookMoment } from "../../../lib/archive";
import { canDownloadBook, downloadBook } from "../../../lib/book-pdf";
import { colors } from "../../../theme/tokens";

type Day = { day: string; moments: BookMoment[] };

type Page =
  | { type: "cover" }
  | { type: "intro" }
  | { type: "month"; month: number; count: number }
  | { type: "day"; day: Day }
  | { type: "end" };

const WEEKDAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

/** صفحاتُ الأيّام من الخادم، أو تُجمَّع هنا من قائمةٍ مسطّحة يردّها خادمٌ قديم. */
function daysOf(book: Book): Day[] {
  if (book.days) return book.days;
  const out: Day[] = [];
  for (const moment of book.moments) {
    const at = new Date(moment.createdAt);
    const key = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(at.getDate()).padStart(2, "0")}`;
    const last = out.at(-1);
    if (last && last.day === key) last.moments.push(moment);
    else out.push({ day: key, moments: [moment] });
  }
  return out;
}

/**
 * «سنتك في كتاب» (القاعدة ٢٤٤) — **صفحةٌ لكلّ يوم** (القاعدة ٢٥٦، **بقرار المالك**):
 * «٥ أكتوبر» ولحظاتُه فيه مرقّمةً ١، ٢، ٣ بترتيبها، والخاصّةُ تقول لمن كانت.
 * غلافٌ ومقدّمةٌ وفاصلٌ لكلّ شهر وخاتمة. والصفحاتُ بطاقاتٌ بطولها لا شاشاتٌ
 * تُقلَب: يومٌ فيه عشرُ لحظاتٍ لا يتّسع لشاشةٍ واحدة، وتمريرٌ داخل تقليبٍ
 * من الاتجاه نفسه يتنازعان الإصبع. و**«تحميل PDF»** يحفظه كتاباً بصفحاتٍ حقيقيّة.
 * والحدُّ حدُّ الأرشيف: السنةُ كاملةً لآثار+، وآخرُ ستّة أشهر لغيره.
 */
export default function YearBook() {
  const router = useRouter();
  const { year } = useLocalSearchParams<{ year: string }>();
  const { height } = useWindowDimensions();
  const [saving, setSaving] = useState(false);

  const book = useQuery({
    queryKey: ["archive", "book", year],
    queryFn: () => api<Book>(`/v1/archive/book/${year}`),
  });

  const data = book.data;
  const pages: Page[] = [];
  if (data) {
    const days = daysOf(data);
    pages.push({ type: "cover" }, { type: "intro" });
    let last = -1;
    for (const day of days) {
      const month = Number(day.day.slice(5, 7)) - 1;
      if (month !== last) {
        const count = days
          .filter((d) => Number(d.day.slice(5, 7)) - 1 === month)
          .reduce((sum, d) => sum + d.moments.length, 0);
        pages.push({ type: "month", month, count });
        last = month;
      }
      pages.push({ type: "day", day });
    }
    pages.push({ type: "end" });
  }

  const download = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await downloadBook(Number(year));
    } catch (problem) {
      Alert.alert("تعذّر تحميل الكتاب", problem instanceof Error ? problem.message : "حاول مرة ثانية");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView edges={["bottom"]} style={{ flex: 1, backgroundColor: colors.night }}>
      <ScreenHeader
        title={`كتاب ${ar(Number(year))}`}
        back="/me/archive"
        right={
          data ? (
            <Pressable
              onPress={download}
              disabled={saving}
              accessibilityLabel="تحميل الكتاب PDF"
              style={{ height: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: "rgba(255,255,255,.12)", alignItems: "center", justifyContent: "center", opacity: canDownloadBook ? 1 : 0.6 }}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#F6B93B" />
              ) : (
                <Text style={{ color: "#F6B93B", fontSize: 12.5, fontWeight: "700" }}>تحميل PDF</Text>
              )}
            </Pressable>
          ) : null
        }
      />
      {!data ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.clay} />
      ) : (
        <FlatList
          data={pages}
          keyExtractor={(page, i) => (page.type === "day" ? page.day.day : `${page.type}-${i}`)}
          contentContainerStyle={{ padding: 20, gap: 22, direction: "rtl" }}
          renderItem={({ item }) => (
            <View
              style={{
                minHeight: item.type === "day" ? undefined : item.type === "month" ? height * 0.42 : height * 0.62,
                borderRadius: 6,
                backgroundColor: PAPER,
                overflow: "hidden",
                shadowColor: "#000",
                shadowOpacity: 0.35,
                shadowRadius: 14,
                shadowOffset: { width: 0, height: 8 },
                elevation: 6,
              }}
            >
              <PageBody page={item} book={data} onOpen={(id) => router.push(`/m/${id}` as never)} />
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

// ورقُ الكتاب وحبرُه — كالـPDF حرفاً بحرف (`book-print.ts`)، لا ألوانُ الثيم.
const PAPER = "#FBF8F1";
const INK = "#182830";
const RULE = "#E4DCC8";
const MUTED = "#8a949a";
const KICKER = "#b07d1c";
const NIGHT = "#0E1A24";
const GOLD = "#F6B93B";
// صوتُ الراوي: بنّيٌّ دافئ يفصله عن كلام صاحب اللحظة (القاعدة ٢٥٩).
const STORY = "#6a5420";

function Gold({ center }: { center?: boolean }) {
  return <View style={{ width: 36, height: 2, borderRadius: 2, backgroundColor: GOLD, alignSelf: center ? "center" : "flex-start" }} />;
}

function PageBody({ page, book, onOpen }: { page: Page; book: Book; onOpen: (id: string) => void }) {
  if (page.type === "cover") {
    return (
      <View style={{ flex: 1, alignItems: "center", backgroundColor: NIGHT, paddingTop: 44, paddingBottom: 28, paddingHorizontal: 24 }}>
        <AthrMark size={60} />
        <Text style={{ color: "rgba(247,245,239,.55)", fontSize: 11, letterSpacing: 3, marginTop: 28 }}>كتاب السنة</Text>
        <Text face="display" style={{ color: "#f7f5ef", fontSize: 78, fontWeight: "700", lineHeight: 92, marginTop: 4 }}>{ar(book.year)}</Text>
        <View style={{ marginTop: 14 }}>
          <Gold center />
        </View>
        <View style={{ flex: 1 }} />
        <Avatar name={book.name} mediaId={book.avatarMediaId} size={64} />
        <Text face="display" style={{ color: "#f7f5ef", fontSize: 19, fontWeight: "700", marginTop: 10 }}>{book.name}</Text>
        <Text style={{ color: "rgba(247,245,239,.5)", fontSize: 11, marginTop: 2 }}>عضوية رقم {ar(book.memberNo)}</Text>
        <Text style={{ color: GOLD, fontSize: 12.5, letterSpacing: 1, marginTop: 26 }}>لحظاتك، مع ناسك.</Text>
      </View>
    );
  }

  if (page.type === "intro") {
    const s = book.stats;
    const days = daysOf(book).length;
    const tiles = (
      [
        [s.moments, "لحظة"],
        [days, "يوماً كتبت فيها"],
        [s.photos, "صورة"],
        [s.places, "مكان"],
        [s.songs, "أغنية"],
        [s.cities.length, "مدينة"],
      ] as [number, string][]
    ).filter(([n]) => n > 0);
    const facts = [
      s.cities.length ? ["مدنك", s.cities.join("، ")] : null,
      s.topPlace ? ["أكثر مكان رجعت له", `${s.topPlace.name}${s.topPlace.visits > 1 ? ` — ${ar(s.topPlace.visits)} مرّات` : ""}`] : null,
      s.topSong ? ["أغنيتك", s.topSong] : null,
    ].filter(Boolean) as [string, string][];
    return (
      <View style={{ padding: 24 }}>
        <Text style={{ color: KICKER, fontSize: 10.5, letterSpacing: 3 }}>مقدّمة</Text>
        <Text face="display" style={{ color: INK, fontSize: 26, fontWeight: "700", marginTop: 2 }}>سنتك بالأرقام</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 20, borderTopWidth: 1, borderTopColor: RULE }}>
          {tiles.map(([n, label], i) => (
            <View
              key={label}
              style={{
                width: "50%",
                paddingVertical: 16,
                paddingLeft: i % 2 ? 0 : 14,
                paddingRight: i % 2 ? 14 : 0,
                borderBottomWidth: 1,
                borderBottomColor: RULE,
                borderLeftWidth: i % 2 ? 0 : 1,
                borderLeftColor: RULE,
              }}
            >
              <Text face="display" style={{ color: INK, fontSize: 36, fontWeight: "700", lineHeight: 42 }}>{ar(n)}</Text>
              <Text style={{ color: "#6b7880", fontSize: 11.5 }}>{label}</Text>
            </View>
          ))}
        </View>
        {facts.length ? (
          <View style={{ marginTop: 18 }}>
            {facts.map(([k, v]) => (
              <View key={k} style={{ flexDirection: "row", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#EFE8D8" }}>
                <Text style={{ width: 92, color: "#8a7a55", fontSize: 11.5, paddingTop: 2 }}>{k}</Text>
                <Text style={{ flex: 1, color: INK, fontSize: 13.5 }}>{v}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {s.circleLines?.length ? (
          <View style={{ marginTop: 20, paddingTop: 14, borderTopWidth: 1, borderTopColor: RULE }}>
            <Text style={{ color: KICKER, fontSize: 10.5, letterSpacing: 3, marginBottom: 6 }}>دائرتك</Text>
            {s.circleLines.map((text) => (
              <Text key={text} style={{ color: "#3c4a52", fontSize: 13, lineHeight: 24 }}>
                {text}
              </Text>
            ))}
          </View>
        ) : null}
        {book.partial ? (
          <Text style={{ color: MUTED, fontSize: 11, marginTop: 16 }}>هذا الكتاب من آخر ستة أشهر — السنة كاملة مع آثار+.</Text>
        ) : null}
      </View>
    );
  }

  if (page.type === "month") {
    return (
      <View style={{ flex: 1, justifyContent: "flex-end", padding: 24, paddingBottom: 32 }}>
        <Text
          face="display"
          style={{ position: "absolute", top: 4, left: 16, color: "#F1E8D2", fontSize: 150, fontWeight: "700", lineHeight: 170 }}
        >
          {ar(page.month + 1)}
        </Text>
        <Text style={{ color: KICKER, fontSize: 11, letterSpacing: 3 }}>{ar(book.year)}</Text>
        <Text face="display" style={{ color: INK, fontSize: 46, fontWeight: "700", lineHeight: 56, marginTop: 2 }}>{MONTHS[page.month]}</Text>
        <View style={{ marginTop: 10 }}>
          <Gold />
        </View>
        <Text style={{ color: "#6b7880", fontSize: 12, marginTop: 10 }}>{ar(page.count)} لحظة</Text>
      </View>
    );
  }

  if (page.type === "end") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: NIGHT }}>
        <AthrMark size={48} />
        <Text face="display" style={{ color: "#f7f5ef", fontSize: 21, fontWeight: "700", marginTop: 18, textAlign: "center", lineHeight: 32 }}>
          {ar(book.stats.moments)} لحظة تركت أثرها{"\n"}في {ar(book.year)}
        </Text>
        <View style={{ marginTop: 14 }}>
          <Gold center />
        </View>
        <Text style={{ color: "rgba(247,245,239,.6)", fontSize: 12.5, marginTop: 12 }}>والصفحة الجاية تكتبها أنت.</Text>
      </View>
    );
  }

  const [y, m, d] = page.day.day.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  const count = page.day.moments.length;
  return (
    <View style={{ padding: 20 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: RULE, marginBottom: 16 }}>
        <Text face="display" style={{ color: INK, fontSize: 46, fontWeight: "700", lineHeight: 48 }}>{ar(d)}</Text>
        <View style={{ flex: 1, paddingBottom: 3 }}>
          <Text face="display" style={{ color: INK, fontSize: 17, fontWeight: "700" }}>{MONTHS[m - 1]}</Text>
          <Text style={{ color: "#6b7880", fontSize: 11.5 }}>{weekday}</Text>
        </View>
        <View style={{ borderWidth: 1, borderColor: RULE, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 2, marginBottom: 4 }}>
          <Text style={{ color: "#8a7a55", fontSize: 11 }}>
            {ar(count)} {count === 1 ? "لحظة" : "لحظات"}
          </Text>
        </View>
      </View>
      {page.day.moments.map((moment, index) => (
        <DayMoment key={moment.id} moment={moment} n={index + 1} last={index === count - 1} onOpen={onOpen} />
      ))}
    </View>
  );
}

/** لحظةٌ في صفحة يومها: رقمُها على خطّ اليوم، وساعتُها، وصورتُها، وسطرُها، ولمن كانت. */
function DayMoment({ moment, n, last, onOpen }: { moment: BookMoment; n: number; last: boolean; onOpen: (id: string) => void }) {
  // الراوي (القاعدة ٢٥٩): ما فعله يُروى، وكلامُه هو يبقى كما كتبه. وخادمٌ قديمٌ بلا
  // جملةٍ يُرسم بسطره كما كان.
  const told = Boolean(moment.story);
  const line = told
    ? moment.kind === "PHOTO" || moment.kind === "THOUGHT"
      ? (moment.text ?? "")
      : ""
    : momentLine(moment);
  const together = told ? null : withNames(moment);
  const note = privateNote(moment);
  const quote = moment.echo?.quote;
  return (
    <Pressable onPress={() => onOpen(moment.id)} style={{ flexDirection: "row", gap: 12 }}>
      <View style={{ width: 22, alignItems: "center" }}>
        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: NIGHT, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: GOLD, fontSize: 11, fontWeight: "700" }}>{ar(n)}</Text>
        </View>
        {last ? null : <View style={{ flex: 1, width: 1, backgroundColor: RULE, marginTop: 2 }} />}
      </View>
      <View style={{ flex: 1, minWidth: 0, paddingBottom: last ? 0 : 20 }}>
        <Text style={{ color: MUTED, fontSize: 11, marginBottom: 6, marginTop: 3 }}>
          {timeOfDay(new Date(moment.createdAt))}
          {moment.placeName && (told ? moment.kind === "PHOTO" : moment.kind !== "PLACE") ? ` · ${moment.placeName}` : ""}
        </Text>
        {told ? <Text style={{ color: STORY, fontSize: 13.5, lineHeight: 24, marginBottom: 8 }}>{moment.story}</Text> : null}
        {moment.mediaId ? (
          <MediaImage
            mediaId={moment.mediaId}
            style={{ width: "100%", aspectRatio: 5 / 4, borderRadius: 10, marginBottom: 8 }}
            position={moment.photoX != null ? { x: moment.photoX, y: moment.photoY ?? 50 } : undefined}
          />
        ) : null}
        {line ? (
          moment.mediaId ? (
            <Text style={{ color: INK, fontSize: 14, lineHeight: 25 }}>{line}</Text>
          ) : (
            <Text face="display" style={{ color: INK, fontSize: 18, fontWeight: "700", lineHeight: 28 }}>{line}</Text>
          )
        ) : null}
        {together ? <Text style={{ color: "#3c4a52", fontSize: 12, marginTop: 4 }}>{together}</Text> : null}
        {moment.echoText ? (
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 10 }}>
            {moment.echo?.top ? (
              <View style={{ marginTop: 2 }}>
                <ReactionGlyph kind={moment.echo.top.kind} emoji={moment.echo.top.emoji} size={20} />
              </View>
            ) : null}
            <Text style={{ flex: 1, color: "#3c4a52", fontSize: 12.5, lineHeight: 22 }}>{moment.echoText}</Text>
          </View>
        ) : null}
        {quote ? (
          <View style={{ marginTop: 6, paddingVertical: 8, paddingHorizontal: 12, borderRightWidth: 2, borderRightColor: GOLD, backgroundColor: "#F6EFDD", borderTopLeftRadius: 8, borderBottomLeftRadius: 8 }}>
            <Text style={{ color: INK, fontSize: 13.5, lineHeight: 24 }}>«{quote.text}»</Text>
            <Text style={{ color: "#8a7a55", fontSize: 11, marginTop: 2 }}>— {quote.name}</Text>
          </View>
        ) : null}
        {note ? (
          <View style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#FBF1DA", borderWidth: 1, borderColor: "#EBD9AE", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, marginTop: 7 }}>
            {moment.private?.audience === "EXCEPT" ? null : <PrivateIcon size={11} color="#8a5f10" />}
            <Text style={{ color: "#8a5f10", fontSize: 11 }}>{note}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}
