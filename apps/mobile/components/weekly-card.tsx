import { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Text } from "./type";
import { Avatar } from "./avatar";
import { BookIcon, CameraIcon, CloseIcon, MusicIcon, PinIcon, PlaneIcon, SunIcon, WithIcon } from "./icons";
import { api } from "../lib/api";
import { ar } from "../lib/format";
import { getItem, setItem } from "../lib/store";
import { colors } from "../theme/tokens";

type Person = { id: string; name: string; avatarMediaId: string | null };
type Weekly = {
  from: string;
  circle: { moments: number; photos: number; places: number; songs: number; thoughts: number; stories: number; posters: number };
  travelers: { person: Person; city: string }[];
  joined: Person[];
  newFriends: Person[];
  topMoment: { id: string; person: Person; kind: string; text: string | null; reactions: number; comments: number } | null;
  topPlace: { name: string; visits: number } | null;
  mine: { moments: number; reactions: number; comments: number; views: number };
};

const KEY = "athr.weekly.closed";

/**
 * «أسبوعك في دائرتك» الجمعةَ والسبت (القاعدة ٢٤٥) — **بقرار المالك**: ملخّصٌ
 * شامل لما جرى في دائرته وما جرى له، وكلُّ وجهٍ فيه بابٌ إلى صاحبه. و«×» يطويه
 * لهذا الأسبوع على الجهاز.
 */
export function WeeklyCard() {
  const router = useRouter();
  const [closed, setClosed] = useState<string | null | undefined>(undefined);
  const weekly = useQuery({
    queryKey: ["weekly"],
    queryFn: () => api<{ week: Weekly | null }>("/v1/memories/weekly"),
    staleTime: 10 * 60_000,
  });

  useEffect(() => {
    void getItem(KEY)
      .catch(() => null)
      .then((value) => setClosed(value));
  }, []);

  const week = weekly.data?.week;
  // الأسبوعُ يُعرف بأوّل يومه: ما طُوي الجمعة يبقى مطويّاً السبت ويعود الجمعة القادمة.
  const id = week ? week.from.slice(0, 10) : null;
  if (!week || closed === undefined || closed === id) return null;

  const close = () => {
    setClosed(id);
    void setItem(KEY, id!).catch(() => {});
  };
  const open = (person: Person) => router.push(`/u/${person.id}` as never);

  const tiles = [
    { icon: <BookIcon size={15} color={colors.clayInk} />, value: week.circle.moments, label: "لحظة" },
    { icon: <CameraIcon size={15} color={colors.clayInk} />, value: week.circle.photos, label: "صورة" },
    { icon: <PinIcon size={15} color={colors.clayInk} />, value: week.circle.places, label: "مكان" },
    { icon: <MusicIcon size={15} color={colors.clayInk} />, value: week.circle.songs, label: "أغنية" },
    { icon: <SunIcon size={15} color={colors.clayInk} />, value: week.circle.stories, label: "قصة" },
    { icon: <WithIcon size={15} color={colors.clayInk} />, value: week.circle.posters, label: "نشروا" },
  ].filter((tile) => tile.value > 0);

  return (
    <View style={{ marginTop: 14, borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card }}>
      <View style={{ backgroundColor: colors.night, paddingHorizontal: 14, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: "#f7f5ef", fontSize: 15.5, fontWeight: "800" }}>أسبوعك في دائرتك</Text>
          <Text style={{ color: "rgba(247,245,239,.65)", fontSize: 11.5, marginTop: 1 }}>
            ملخّص الجمعة — آخر سبعة أيام
          </Text>
        </View>
        <Pressable accessibilityLabel="إخفاء لهذا الأسبوع" hitSlop={8} onPress={close} style={{ padding: 4 }}>
          <CloseIcon size={14} color="rgba(247,245,239,.7)" />
        </Pressable>
      </View>

      <View style={{ padding: 14, gap: 14 }}>
        {tiles.length ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {tiles.map((tile) => (
              <View
                key={tile.label}
                style={{ flexGrow: 1, minWidth: "30%", borderRadius: 14, backgroundColor: colors.paper, paddingVertical: 10, alignItems: "center", gap: 2 }}
              >
                {tile.icon}
                <Text style={{ color: colors.ink, fontSize: 17, fontWeight: "800" }}>{ar(tile.value)}</Text>
                <Text style={{ color: colors.muted, fontSize: 11 }}>{tile.label}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {week.travelers.length ? (
          <Section icon={<PlaneIcon size={15} color={colors.ink2} />} title={`${ar(week.travelers.length)} ${week.travelers.length === 1 ? "سافر" : "سافروا"}`}>
            <People rows={week.travelers.map((row) => ({ person: row.person, note: row.city }))} onOpen={open} />
          </Section>
        ) : null}

        {week.topMoment ? (
          <Section icon={<SunIcon size={15} color={colors.ink2} />} title="أكثر لحظة حرّكت الدائرة">
            <Pressable
              onPress={() => router.push(`/m/${week.topMoment!.id}` as never)}
              style={{ flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 14, backgroundColor: colors.paper, padding: 10 }}
            >
              <Avatar name={week.topMoment.person.name} mediaId={week.topMoment.person.avatarMediaId} size={36} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "700" }}>{week.topMoment.person.name}</Text>
                <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12 }}>
                  {week.topMoment.text || kindLabel(week.topMoment.kind)}
                </Text>
              </View>
              <Text style={{ color: colors.clayInk, fontSize: 12, fontWeight: "700" }}>
                {ar(week.topMoment.reactions)} تفاعل{week.topMoment.comments ? `، ${ar(week.topMoment.comments)} تعليق` : ""}
              </Text>
            </Pressable>
          </Section>
        ) : null}

        {week.topPlace ? (
          <Section icon={<PinIcon size={15} color={colors.ink2} />} title="أكثر مكان رجعوا له">
            <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "700" }}>
              {week.topPlace.name}
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "400" }}>
                {week.topPlace.visits > 1 ? `  — ${ar(week.topPlace.visits)} مرّات` : ""}
              </Text>
            </Text>
          </Section>
        ) : null}

        {week.newFriends.length ? (
          <Section icon={<WithIcon size={15} color={colors.ink2} />} title="أصدقاء جدد في دائرتك">
            <People rows={week.newFriends.map((person) => ({ person }))} onOpen={open} />
          </Section>
        ) : null}

        {week.joined.length ? (
          <Section icon={<SunIcon size={15} color={colors.ink2} />} title="انضمّوا إلى آثار هالأسبوع">
            <People rows={week.joined.map((person) => ({ person }))} onOpen={open} />
          </Section>
        ) : null}

        <View style={{ borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12 }}>
          <Text style={{ color: colors.ink2, fontSize: 12.5, fontWeight: "700", marginBottom: 4 }}>وأنت هالأسبوع</Text>
          <Text style={{ color: colors.muted, fontSize: 12.5, lineHeight: 20 }}>
            {week.mine.moments
              ? `نشرت ${ar(week.mine.moments)} لحظة، وجاتك ${ar(week.mine.reactions)} تفاعل و${ar(week.mine.comments)} تعليق، وشافها ${ar(week.mine.views)}.`
              : "ما نشرت شي هالأسبوع — دائرتك تنتظر لحظتك."}
          </Text>
        </View>
      </View>
    </View>
  );
}

function kindLabel(kind: string) {
  return kind === "PHOTO" ? "صورة" : kind === "PLACE" ? "مكان" : kind === "MUSIC" ? "أغنية" : "لحظة";
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
        {icon}
        <Text style={{ color: colors.ink2, fontSize: 12.5, fontWeight: "700" }}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function People({ rows, onOpen }: { rows: { person: Person; note?: string }[]; onOpen: (person: Person) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
      {rows.map(({ person, note }) => (
        <Pressable key={person.id} onPress={() => onOpen(person)} style={{ alignItems: "center", width: 64 }}>
          <Avatar name={person.name} mediaId={person.avatarMediaId} size={46} />
          <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 11.5, fontWeight: "600", marginTop: 4 }}>
            {person.name}
          </Text>
          {note ? (
            <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 10.5 }}>
              {note}
            </Text>
          ) : null}
        </Pressable>
      ))}
    </ScrollView>
  );
}
