import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { create } from "zustand";
import { Text, TextInput } from "./type";
import { GlassSheet, SheetScrollView } from "./glass-sheet";
import { Avatar } from "./avatar";
import { MediaImage } from "./media-image";
import { Spinner } from "./spinner";
import { MusicIcon, PinIcon, SearchIcon, SparkIcon, WithIcon } from "./icons";
import { api } from "../lib/api";
import { ar, dayLabel } from "../lib/format";
import { useSession } from "../lib/session";
import type { Moment } from "../lib/queries";
import { colors } from "../theme/tokens";

type Result = {
  friends: { id: string; name: string; avatarMediaId: string | null; together: number | null }[];
  places: { name: string; city: string | null; count: number }[];
  cities: { name: string; count: number }[];
  moments: Moment[];
  suggest?: boolean;
};

const useSearchSheet = create<{ open: boolean }>(() => ({ open: false }));

/** يفتح البحثَ الذكيّ (القاعدة ٣٣٥) — من رأس اللحظات. */
export const openSearch = () => useSearchSheet.setState({ open: true });

const glassRow = { backgroundColor: "rgba(255,255,255,.08)", borderRadius: 16 } as const;
const EXAMPLES = ["نورة", "الرياض", "قهوة", "مع خالد"];

/**
 * البحثُ الذكيّ نافذةٌ زجاجيّة (القاعدة ٣٣٥) — **بقرار المالك**، بهيئة «إضافة صديق»
 * (القاعدة ٢٨١): سطرٌ واحد يُفهم — صديقٌ ومكانٌ ومدينةٌ ونصّ — والنتائجُ أقسام:
 * أصدقاءُ بأثرهم المشترك، فأماكن، فمدن، فلحظات. وقبل الكتابة أكثرُ أماكنه ومدنه.
 * والضغطةُ على مكانٍ أو مدينة تبحث بها، وعلى صديقٍ تفتح «آثارنا» لمشتركي آثار+ وملفَّه
 * لغيرهم. ومركّبةٌ في الجذر (القاعدة ١٣٧).
 */
export function SearchSheet() {
  const open = useSearchSheet((s) => s.open);
  if (!open) return null;
  return <Body close={() => useSearchSheet.setState({ open: false })} />;
}

function Body({ close }: { close: () => void }) {
  const router = useRouter();
  const isPlus = useSession((s) => Boolean(s.me?.isPlus));
  const [query, setQuery] = useState("");
  const [asked, setAsked] = useState("");

  // يُسأل بعد أن يقف الإصبع ٣٥٠ مللي — لا مع كلّ حرف.
  useEffect(() => {
    const id = setTimeout(() => setAsked(query.trim()), 350);
    return () => clearTimeout(id);
  }, [query]);

  const result = useQuery({
    queryKey: ["search", asked],
    queryFn: () => api<Result>(`/v1/search?q=${encodeURIComponent(asked)}`),
    placeholderData: (previous) => previous,
    staleTime: 30_000,
  });
  const data = result.data;
  const empty =
    data && !data.suggest && asked.length >= 2 &&
    !data.friends.length && !data.places.length && !data.cities.length && !data.moments.length;

  const go = (to: string) => {
    close();
    router.push(to as never);
  };

  const heading = (label: string) => (
    <Text style={{ color: "rgba(255,255,255,.55)", fontSize: 12, fontWeight: "700", marginTop: 6 }}>{label}</Text>
  );
  const chip = (key: string, label: string, count: number, icon: React.ReactNode) => (
    <Pressable
      key={key}
      onPress={() => setQuery(label)}
      style={[glassRow, { flexDirection: "row", alignItems: "center", gap: 6, height: 36, paddingHorizontal: 12, borderRadius: 999 }]}
    >
      {icon}
      <Text numberOfLines={1} style={{ color: "#fff", fontSize: 13, fontWeight: "600", maxWidth: 160, writingDirection: "auto" }}>
        {label}
      </Text>
      <Text style={{ color: "rgba(255,255,255,.5)", fontSize: 11.5 }}>{ar(count)}</Text>
    </Pressable>
  );

  return (
    <GlassSheet icon={<SearchIcon size={20} color="#fff" />} title="البحث الذكي" subtitle="لحظة، مكان، مدينة، أو صديق" onClose={close}>
      <SheetScrollView name="search" keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 10 }}>
        <View style={[glassRow, { flexDirection: "row", alignItems: "center", gap: 8, height: 48, paddingHorizontal: 14 }]}>
          <SearchIcon size={18} color="rgba(255,255,255,.6)" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            autoFocus
            placeholder="مثلاً: نورة جدة، أو ستاربكس"
            placeholderTextColor="rgba(255,255,255,.4)"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => setAsked(query.trim())}
            style={{ flex: 1, color: "#fff", fontSize: 15 }}
          />
          {result.isFetching ? <Spinner size="small" color="#fff" /> : null}
        </View>

        {asked.length < 2 ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {EXAMPLES.map((one) => (
              <Pressable key={one} onPress={() => setQuery(one)} style={[glassRow, { height: 32, paddingHorizontal: 12, borderRadius: 999, justifyContent: "center" }]}>
                <Text style={{ color: "rgba(255,255,255,.75)", fontSize: 12.5 }}>{one}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {data?.friends.length ? (
          <>
            {heading("أصدقاء")}
            {data.friends.map((person) => (
              <Pressable
                key={person.id}
                onPress={() => go(isPlus ? `/together/${person.id}` : `/u/${person.id}`)}
                style={[glassRow, { flexDirection: "row", alignItems: "center", gap: 12, padding: 10 }]}
              >
                <Avatar name={person.name} mediaId={person.avatarMediaId} size={40} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ color: "#fff", fontSize: 14.5, fontWeight: "700", writingDirection: "auto" }}>
                    {person.name}
                  </Text>
                  <Text style={{ color: "rgba(255,255,255,.6)", fontSize: 12 }}>
                    {person.together === null
                      ? "آثاركم المشتركة مع آثار+"
                      : person.together > 0
                        ? `${ar(person.together)} لحظة جمعتكم`
                        : "ما فيه لحظة جمعتكم بعد"}
                  </Text>
                </View>
                {person.together === null ? <SparkIcon size={16} color={colors.gold} /> : <WithIcon size={18} color={colors.clay} />}
              </Pressable>
            ))}
          </>
        ) : null}

        {data?.places.length ? (
          <>
            {heading(data.suggest ? "أماكن رجعت لها" : "أماكن")}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {data.places.map((place) => chip(`p-${place.name}`, place.name, place.count, <PinIcon size={14} color={colors.clay} />))}
            </View>
          </>
        ) : null}

        {data?.cities.length ? (
          <>
            {heading(data.suggest ? "مدنك" : "مدن")}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {data.cities.map((city) => chip(`c-${city.name}`, city.name, city.count, <PinIcon size={14} color="rgba(255,255,255,.7)" />))}
            </View>
          </>
        ) : null}

        {data?.moments.length ? (
          <>
            {heading(`لحظات · ${ar(data.moments.length)}`)}
            {data.moments.map((moment) => (
              <MomentRow key={moment.id} moment={moment} onPress={() => go(`/m/${moment.id}`)} />
            ))}
          </>
        ) : null}

        {empty ? (
          <Text style={{ color: "rgba(255,255,255,.6)", fontSize: 13.5, textAlign: "center", marginTop: 18 }}>
            ما لقينا شيء بـ«{asked}» — جرّب اسم مكان أو مدينة أو صديق
          </Text>
        ) : null}
      </SheetScrollView>
    </GlassSheet>
  );
}

/** سطرُ اللحظة: صورتُها أو أيقونةُ نوعها، ثمّ ما يُقرأ منها، ثمّ صاحبُها ويومُها. */
function MomentRow({ moment, onPress }: { moment: Moment; onPress: () => void }) {
  const line =
    moment.text ||
    (moment.musicTitle ? `${moment.musicTitle}${moment.musicArtist ? ` — ${moment.musicArtist}` : ""}` : null) ||
    (moment.placeName ? `في ${moment.placeName}` : null) ||
    (moment.placeCity ? `في ${moment.placeCity}` : "لحظة");
  const where = [moment.placeName, moment.placeCity].filter(Boolean).filter((one, index, all) => all.indexOf(one) === index).join("، ");
  return (
    <Pressable onPress={onPress} style={[glassRow, { flexDirection: "row", alignItems: "center", gap: 12, padding: 10 }]}>
      <View style={{ width: 48, height: 48, borderRadius: 12, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.1)" }}>
        {moment.mediaId ? (
          <MediaImage mediaId={moment.mediaId} style={{ width: 48, height: 48 }} resizeMode="cover" />
        ) : moment.musicTitle ? (
          <MusicIcon size={20} color={colors.clay} />
        ) : moment.placeName || moment.placeCity ? (
          <PinIcon size={20} color={colors.clay} />
        ) : (
          <Avatar name={moment.author.name} mediaId={moment.author.avatarMediaId} size={36} />
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text numberOfLines={2} style={{ color: "#fff", fontSize: 14, lineHeight: 21, writingDirection: "auto" }}>
          {line}
        </Text>
        <Text numberOfLines={1} style={{ color: "rgba(255,255,255,.55)", fontSize: 11.5 }}>
          {moment.author.name} · {dayLabel(new Date(moment.createdAt))}
          {where && moment.text ? ` · ${where}` : ""}
        </Text>
      </View>
    </Pressable>
  );
}
