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
import { BookIcon, MoonIcon, MusicIcon, PinIcon, PlaneIcon, PrivateIcon, SunIcon } from "../../../components/icons";
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
          contentContainerStyle={{ padding: 18, gap: 14, direction: "rtl" }}
          renderItem={({ item }) => (
            <View
              style={{
                minHeight: item.type === "day" ? undefined : item.type === "month" ? height * 0.3 : height * 0.55,
                borderRadius: 22,
                backgroundColor: colors.card,
                overflow: "hidden",
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

function PageBody({ page, book, onOpen }: { page: Page; book: Book; onOpen: (id: string) => void }) {
  if (page.type === "cover") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.night, padding: 24 }}>
        <AthrMark size={64} />
        <Text style={{ color: "#f7f5ef", fontSize: 54, fontWeight: "800", marginTop: 24 }}>{ar(book.year)}</Text>
        <View style={{ marginTop: 28, alignItems: "center" }}>
          <Avatar name={book.name} mediaId={book.avatarMediaId} size={72} />
          <Text style={{ color: "#f7f5ef", fontSize: 20, fontWeight: "800", marginTop: 10 }}>{book.name}</Text>
          <Text style={{ color: "rgba(247,245,239,.6)", fontSize: 12, marginTop: 2 }}>عضوية رقم {ar(book.memberNo)}</Text>
        </View>
        <Text style={{ color: "#F6B93B", fontSize: 15, fontWeight: "700", marginTop: 36 }}>لحظاتك، مع ناسك.</Text>
      </View>
    );
  }

  if (page.type === "intro") {
    const s = book.stats;
    const rows = [
      [ar(s.moments), "لحظة"],
      [ar(s.photos), "صورة"],
      [ar(s.places), "مكان"],
      [ar(s.songs), "أغنية"],
    ].filter(([n]) => n !== "٠");
    return (
      <View style={{ flex: 1, padding: 24, justifyContent: "center", gap: 20 }}>
        <Text style={{ color: colors.ink, fontSize: 24, fontWeight: "800" }}>سنتك بالأرقام</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {rows.map(([n, label]) => (
            <View key={label} style={{ flexGrow: 1, minWidth: "45%", borderRadius: 16, backgroundColor: colors.paper, padding: 14 }}>
              <Text style={{ color: colors.ink, fontSize: 28, fontWeight: "800" }}>{n}</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>{label}</Text>
            </View>
          ))}
        </View>
        {s.cities.length ? <Line icon={<PlaneIcon size={16} color={colors.clayInk} />} text={`مدنك: ${s.cities.join("، ")}`} /> : null}
        {s.topPlace ? (
          <Line icon={<PinIcon size={16} color={colors.clayInk} />} text={`أكثر مكان رجعت له: ${s.topPlace.name}${s.topPlace.visits > 1 ? ` — ${ar(s.topPlace.visits)} مرّات` : ""}`} />
        ) : null}
        {s.topSong ? <Line icon={<MusicIcon size={16} color={colors.clayInk} />} text={`أغنيتك: ${s.topSong}`} /> : null}
        {book.partial ? (
          <Text style={{ color: colors.muted, fontSize: 11.5 }}>
            الكتاب من آخر ستة أشهر — السنة كاملة مع آثار+.
          </Text>
        ) : null}
      </View>
    );
  }

  if (page.type === "month") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.goldSoft }}>
        <Text style={{ color: colors.clayInk, fontSize: 14, fontWeight: "700" }}>{ar(book.year)}</Text>
        <Text style={{ color: colors.ink, fontSize: 44, fontWeight: "800", marginTop: 6 }}>{MONTHS[page.month]}</Text>
        <Text style={{ color: colors.muted, fontSize: 13, marginTop: 6 }}>{ar(page.count)} لحظة</Text>
      </View>
    );
  }

  if (page.type === "end") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: colors.night }}>
        <AthrMark size={48} />
        <Text style={{ color: "#f7f5ef", fontSize: 20, fontWeight: "800", marginTop: 16, textAlign: "center" }}>
          {ar(book.stats.moments)} لحظة تركت أثرها في {ar(book.year)}
        </Text>
        <Text style={{ color: "rgba(247,245,239,.6)", fontSize: 13, marginTop: 8 }}>والصفحة الجاية تكتبها أنت.</Text>
      </View>
    );
  }

  const [y, m, d] = page.day.day.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  return (
    <View style={{ padding: 18 }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", borderBottomWidth: 2, borderBottomColor: "#F6B93B", paddingBottom: 8, marginBottom: 14 }}>
        <Text style={{ color: colors.ink, fontSize: 24, fontWeight: "800" }}>
          {ar(d)} {MONTHS[m - 1]}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 12.5 }}>
          {weekday} · {ar(page.day.moments.length)} لحظة
        </Text>
      </View>
      <View style={{ gap: 16 }}>
        {page.day.moments.map((moment, index) => (
          <DayMoment key={moment.id} moment={moment} n={index + 1} onOpen={onOpen} />
        ))}
      </View>
    </View>
  );
}

/** لحظةٌ في صفحة يومها: رقمُها، وساعتُها، وصورتُها، وسطرُها، ولمن كانت. */
function DayMoment({ moment, n, onOpen }: { moment: BookMoment; n: number; onOpen: (id: string) => void }) {
  const icon =
    moment.kind === "PLACE" ? <PinIcon size={14} color={colors.clayInk} /> :
    moment.kind === "MUSIC" ? <MusicIcon size={14} color={colors.clayInk} /> :
    moment.kind === "CITY" ? <PlaneIcon size={14} color={colors.clayInk} /> :
    moment.kind === "SLEEP" ? <MoonIcon size={14} color={colors.clayInk} /> :
    moment.kind === "WAKE" ? <SunIcon size={14} color={colors.clayInk} /> :
    <BookIcon size={14} color={colors.clayInk} />;
  const line = momentLine(moment);
  const together = withNames(moment);
  const note = privateNote(moment);
  return (
    <Pressable onPress={() => onOpen(moment.id)} style={{ flexDirection: "row", gap: 10 }}>
      <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: colors.night, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: "#F6B93B", fontSize: 12.5, fontWeight: "800" }}>{ar(n)}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {icon}
          <Text style={{ color: colors.muted, fontSize: 11.5 }}>
            {timeOfDay(new Date(moment.createdAt))}
            {moment.placeName && moment.kind !== "PLACE" ? ` · ${moment.placeName}` : ""}
          </Text>
        </View>
        {moment.mediaId ? (
          <MediaImage
            mediaId={moment.mediaId}
            style={{ width: "100%", aspectRatio: 5 / 4, borderRadius: 12 }}
            position={moment.photoX != null ? { x: moment.photoX, y: moment.photoY ?? 50 } : undefined}
          />
        ) : null}
        {line ? (
          <Text style={{ color: colors.ink, fontSize: moment.mediaId ? 14.5 : 16.5, fontWeight: moment.mediaId ? "500" : "700", lineHeight: moment.mediaId ? 24 : 28 }}>
            {line}
          </Text>
        ) : null}
        {together ? <Text style={{ color: colors.ink2, fontSize: 12.5 }}>{together}</Text> : null}
        {note ? (
          <View style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.goldSoft, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
            <PrivateIcon size={12} color={colors.clayInk} />
            <Text style={{ color: colors.clayInk, fontSize: 11.5 }}>{note}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

function Line({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      {icon}
      <Text style={{ flex: 1, color: colors.ink2, fontSize: 14 }}>{text}</Text>
    </View>
  );
}
