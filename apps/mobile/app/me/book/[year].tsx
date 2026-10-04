import { useState } from "react";
import { View, FlatList, ActivityIndicator, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Text } from "../../../components/type";
import { ScreenHeader } from "../../../components/screen-header";
import { MediaImage } from "../../../components/media-image";
import { Avatar } from "../../../components/avatar";
import { AthrMark } from "../../../components/brand";
import { BookIcon, MoonIcon, MusicIcon, PinIcon, PlaneIcon, SunIcon } from "../../../components/icons";
import { api } from "../../../lib/api";
import { ar, MONTHS } from "../../../lib/format";
import { momentLine, type ArchiveMoment, type Book } from "../../../lib/archive";
import { colors } from "../../../theme/tokens";

type Page =
  | { type: "cover" }
  | { type: "intro" }
  | { type: "month"; month: number; count: number }
  | { type: "moment"; moment: ArchiveMoment }
  | { type: "end" };

/**
 * «سنتك في كتاب» (القاعدة ٢٤٤) — **بقرار المالك**: كانت بطاقةً تَعِد «مطبوعة
 * ومرسلة لبابك» ولا شيء خلفها. صارت كتاباً يُقرأ في التطبيق: غلافٌ باسمه
 * وسنته، ومقدّمةٌ بأرقامها ومدنها وأكثرِ مكانٍ وأغنية، ثمّ فاصلٌ لكلّ شهر،
 * ثمّ لحظةٌ في كلّ صفحة، وخاتمة. والصفحاتُ تُقلَب إلى أسفل صفحةً صفحة
 * (`pagingEnabled`) — التقليبُ الأفقيّ في جذرٍ من اليمين يتنازع مع اتجاهه.
 * والطباعةُ ليست هنا: لا مطبعةَ خلفنا، ووعدٌ بلا خدمةٍ خلفه لا يُكتب.
 */
export default function YearBook() {
  const router = useRouter();
  const { year } = useLocalSearchParams<{ year: string }>();
  const [height, setHeight] = useState(0);
  const [index, setIndex] = useState(0);

  const book = useQuery({
    queryKey: ["archive", "book", year],
    queryFn: () => api<Book>(`/v1/archive/book/${year}`),
  });

  const data = book.data;
  const pages: Page[] = [];
  if (data) {
    pages.push({ type: "cover" }, { type: "intro" });
    let last = -1;
    for (const moment of data.moments) {
      const month = new Date(moment.createdAt).getMonth();
      if (month !== last) {
        pages.push({ type: "month", month, count: data.moments.filter((m) => new Date(m.createdAt).getMonth() === month).length });
        last = month;
      }
      pages.push({ type: "moment", moment });
    }
    pages.push({ type: "end" });
  }

  return (
    <SafeAreaView edges={["bottom"]} style={{ flex: 1, backgroundColor: colors.night }}>
      <ScreenHeader title={`كتاب ${ar(Number(year))}`} back="/me/archive" />
      <View style={{ flex: 1 }} onLayout={(event) => setHeight(event.nativeEvent.layout.height)}>
        {!data || !height ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.clay} />
        ) : (
          <FlatList
            data={pages}
            keyExtractor={(_, i) => String(i)}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            getItemLayout={(_, i) => ({ length: height, offset: height * i, index: i })}
            onMomentumScrollEnd={(event) => setIndex(Math.round(event.nativeEvent.contentOffset.y / height))}
            renderItem={({ item }) => (
              <View style={{ height, padding: 18 }}>
                <View style={{ flex: 1, borderRadius: 22, backgroundColor: colors.card, overflow: "hidden" }}>
                  <PageBody page={item} book={data} onOpen={(id) => router.push(`/m/${id}` as never)} />
                </View>
              </View>
            )}
          />
        )}
        {data && height ? (
          <Text style={{ position: "absolute", bottom: 26, alignSelf: "center", color: colors.faint, fontSize: 11 }}>
            {ar(index + 1)} / {ar(pages.length)}
          </Text>
        ) : null}
      </View>
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

  const moment = page.moment;
  const date = new Date(moment.createdAt);
  const icon =
    moment.kind === "PLACE" ? <PinIcon size={18} color={colors.clayInk} /> :
    moment.kind === "MUSIC" ? <MusicIcon size={18} color={colors.clayInk} /> :
    moment.kind === "CITY" ? <PlaneIcon size={18} color={colors.clayInk} /> :
    moment.kind === "SLEEP" ? <MoonIcon size={18} color={colors.clayInk} /> :
    moment.kind === "WAKE" ? <SunIcon size={18} color={colors.clayInk} /> :
    <BookIcon size={18} color={colors.clayInk} />;
  const line = momentLine(moment);
  return (
    <Pressable onPress={() => onOpen(moment.id)} style={{ flex: 1 }}>
      {moment.mediaId ? (
        <MediaImage mediaId={moment.mediaId} style={{ width: "100%", flex: 1 }} position={moment.photoX != null ? { x: moment.photoX, y: moment.photoY ?? 50 } : undefined} />
      ) : null}
      <View style={{ padding: 20, gap: 10, flex: moment.mediaId ? 0 : 1, justifyContent: moment.mediaId ? "flex-start" : "center" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {icon}
          <Text style={{ color: colors.muted, fontSize: 12.5 }}>
            {ar(date.getDate())} {MONTHS[date.getMonth()]}
            {moment.placeName && moment.kind !== "PLACE" ? ` · ${moment.placeName}` : ""}
          </Text>
        </View>
        {line ? (
          <Text style={{ color: colors.ink, fontSize: moment.mediaId ? 15 : 22, fontWeight: moment.mediaId ? "500" : "700", lineHeight: moment.mediaId ? 26 : 36 }}>
            {line}
          </Text>
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
