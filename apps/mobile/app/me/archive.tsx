import { Spinner } from "../../components/spinner";
import { useMemo } from "react";
import { View, Pressable, FlatList, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Text } from "../../components/type";
import { ScreenHeader } from "../../components/screen-header";
import { MediaImage } from "../../components/media-image";
import { BookIcon, MoonIcon, MusicIcon, PinIcon, PlaneIcon, SparkIcon, SunIcon } from "../../components/icons";
import { api } from "../../lib/api";
import { ar, MONTHS } from "../../lib/format";
import { momentLine, type ArchiveMoment, type ArchivePage } from "../../lib/archive";
import { colors } from "../../theme/tokens";
import { DEV_FEATURES } from "../../lib/dev-features";
import { GalleryLobby } from "../../components/gallery-lobby";

const COLUMNS = 3;
const GAP = 6;

/**
 * «أرشيفي» (القاعدة ٢٤٤) — **بقرار المالك**: كان بطاقةً في آخر «أنا» على الويب
 * لا تفتح شيئاً، وبلاطاتُها تدرّجاتٌ لا صور، ولا يصلها أحدٌ إلا بعد أن يمرّ
 * بلحظاته كلّها — وغائبةً عن الجوّال. الآن شاشةٌ تُفتح من رأس «لحظاتي»: لحظاتُه
 * شبكةً بالشهور، والصورةُ صورتُها، وما بلا صورةٍ سطرُه وأيقونتُه. وفي أعلاها
 * «سنتك في كتاب» لكلّ سنة. ولغير المشترك آخرُ ستّة أشهر ويُقال كم خلفها.
 */
export default function Archive() {
  // «المعرض وكتاب السنة» بدل الأرشيف (القاعدة ٣٤٦) — في نسخة التطوير وحدها (القاعدة ٢٩١).
  return DEV_FEATURES ? <GalleryLobby /> : <ArchiveGrid />;
}

function ArchiveGrid() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const tile = (width - 40 - GAP * (COLUMNS - 1)) / COLUMNS;

  const years = useQuery({
    queryKey: ["archive", "years"],
    queryFn: () => api<{ years: { year: number; moments: number }[] }>("/v1/archive/years"),
  });
  const pages = useInfiniteQuery({
    queryKey: ["archive"],
    initialPageParam: "",
    queryFn: ({ pageParam }) =>
      api<ArchivePage>(`/v1/archive?limit=60${pageParam ? `&cursor=${pageParam}` : ""}`),
    getNextPageParam: (last) => last.nextCursor,
  });

  // صفوفٌ بالشهور: عنوانُ الشهر ثمّ بلاطاتُه ثلاثاً ثلاثاً.
  const rows = useMemo(() => {
    const out: ({ type: "month"; key: string; label: string; count: number } | { type: "row"; key: string; items: ArchiveMoment[] })[] = [];
    const moments = pages.data?.pages.flatMap((page) => page.moments) ?? [];
    const months = new Map<string, ArchiveMoment[]>();
    for (const moment of moments) {
      const date = new Date(moment.createdAt);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      if (!months.has(key)) months.set(key, []);
      months.get(key)!.push(moment);
    }
    for (const [key, items] of months) {
      const [year, month] = key.split("-").map(Number);
      out.push({ type: "month", key: `m-${key}`, label: `${MONTHS[month]} ${ar(year)}`, count: items.length });
      for (let i = 0; i < items.length; i += COLUMNS) {
        out.push({ type: "row", key: `r-${key}-${i}`, items: items.slice(i, i + COLUMNS) });
      }
    }
    return out;
  }, [pages.data]);

  const first = pages.data?.pages[0];

  return (
    <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: colors.ground }}>
      <ScreenHeader title="أرشيفي" back="/me" />
      <FlatList
        data={rows}
        keyExtractor={(row) => row.key}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        onEndReached={() => pages.hasNextPage && !pages.isFetchingNextPage && void pages.fetchNextPage()}
        onEndReachedThreshold={0.6}
        ListHeaderComponent={
          <View style={{ paddingTop: 16 }}>
            {/* «سنتك في كتاب»: لحظاتُ السنة صفحاتٍ من أوّلها. */}
            <View style={{ borderRadius: 18, borderWidth: 1, borderColor: colors.goldLine, backgroundColor: colors.goldSoft, padding: 14 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.goldLine }}>
                  <BookIcon size={19} color={colors.clayInk} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.ink, fontSize: 14.5, fontWeight: "800" }}>سنتك في كتاب</Text>
                  <Text style={{ color: colors.muted, fontSize: 11.5, marginTop: 1 }}>لحظات السنة من أوّلها، صفحةً صفحة</Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                {(years.data?.years ?? []).map((row) => (
                  <Pressable
                    key={row.year}
                    onPress={() => router.push(`/me/book/${row.year}` as never)}
                    style={{ paddingHorizontal: 14, height: 36, borderRadius: 18, backgroundColor: colors.night, flexDirection: "row", alignItems: "center", gap: 6 }}
                  >
                    <Text style={{ color: "#f7f5ef", fontSize: 13.5, fontWeight: "700" }}>{ar(row.year)}</Text>
                    <Text style={{ color: "rgba(247,245,239,.6)", fontSize: 11 }}>{ar(row.moments)} لحظة</Text>
                  </Pressable>
                ))}
                {years.isLoading ? <Spinner color={colors.clay} /> : null}
                {years.data && years.data.years.length === 0 ? (
                  <Text style={{ color: colors.muted, fontSize: 12 }}>انشر لحظتك الأولى ويبدأ كتابك.</Text>
                ) : null}
              </View>
            </View>

            {first?.limited && first.hidden > 0 ? (
              <Pressable
                onPress={() => router.push("/subscribe" as never)}
                style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, padding: 12 }}
              >
                <SparkIcon size={16} color={colors.clay} />
                <Text style={{ flex: 1, color: colors.ink2, fontSize: 12.5 }}>
                  هنا آخر ستة أشهر — و{ar(first.hidden)} لحظة أقدم محفوظة لك، تفتحها آثار+.
                </Text>
              </Pressable>
            ) : null}
          </View>
        }
        renderItem={({ item: row }) =>
          row.type === "month" ? (
            <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingTop: 20, paddingBottom: 8 }}>
              <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "800" }}>{row.label}</Text>
              <Text style={{ color: colors.muted, fontSize: 11.5 }}>{ar(row.count)} لحظة</Text>
            </View>
          ) : (
            <View style={{ flexDirection: "row", gap: GAP, marginBottom: GAP }}>
              {row.items.map((moment) => (
                <Tile key={moment.id} moment={moment} size={tile} onPress={() => router.push(`/m/${moment.id}` as never)} />
              ))}
            </View>
          )
        }
        ListEmptyComponent={
          pages.isLoading ? (
            <Spinner style={{ marginTop: 24 }} color={colors.clay} />
          ) : (
            <Text style={{ color: colors.muted, fontSize: 13, textAlign: "center", marginTop: 24 }}>ما نشرت شي بعد.</Text>
          )
        }
        ListFooterComponent={pages.isFetchingNextPage ? <Spinner style={{ marginTop: 12 }} color={colors.clay} /> : null}
      />
    </SafeAreaView>
  );
}

function Tile({ moment, size, onPress }: { moment: ArchiveMoment; size: number; onPress: () => void }) {
  const day = ar(new Date(moment.createdAt).getDate());
  if (moment.mediaId) {
    return (
      <Pressable onPress={onPress} style={{ width: size, height: size, borderRadius: 12, overflow: "hidden", backgroundColor: colors.chip }}>
        <MediaImage
          mediaId={moment.mediaId}
          style={{ width: "100%", height: "100%" }}
          position={moment.photoX != null ? { x: moment.photoX, y: moment.photoY ?? 50 } : undefined}
        />
        <Text style={{ position: "absolute", top: 6, right: 8, color: "#fff", fontSize: 11, fontWeight: "800", textShadowColor: "rgba(0,0,0,.5)", textShadowRadius: 3 }}>
          {day}
        </Text>
      </Pressable>
    );
  }
  const icon =
    moment.kind === "PLACE" ? <PinIcon size={15} color={colors.clayInk} /> :
    moment.kind === "MUSIC" ? <MusicIcon size={15} color={colors.clayInk} /> :
    moment.kind === "CITY" ? <PlaneIcon size={15} color={colors.clayInk} /> :
    moment.kind === "SLEEP" ? <MoonIcon size={15} color={colors.clayInk} /> :
    moment.kind === "WAKE" ? <SunIcon size={15} color={colors.clayInk} /> :
    <BookIcon size={15} color={colors.clayInk} />;
  return (
    <Pressable
      onPress={onPress}
      style={{ width: size, height: size, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, padding: 8, justifyContent: "space-between" }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        {icon}
        <Text style={{ color: colors.faint, fontSize: 11, fontWeight: "700" }}>{day}</Text>
      </View>
      <Text numberOfLines={3} style={{ color: colors.ink, fontSize: 11.5, lineHeight: 17 }}>
        {momentLine(moment)}
      </Text>
    </Pressable>
  );
}
