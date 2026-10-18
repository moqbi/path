import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Text } from "../components/type";
import { ScreenHeader } from "../components/screen-header";
import { Avatar } from "../components/avatar";
import { BackIcon, ClockIcon } from "../components/icons";
import { api } from "../lib/api";
import { ar } from "../lib/format";
import { colors } from "../theme/tokens";

type Person = { id: string; name: string; avatarMediaId: string | null };
type CalendarDay = {
  date: string;
  /** `religious` غائبٌ في خادمٍ قديم فتُقرأ وطنيّة. */
  national: { name: string; greeting: string | null; religious?: boolean }[];
  friends: { friend: Person; months: number }[];
  memories: { count: number; months: number } | null;
};
type CalendarMonth = {
  month: string;
  today: string;
  country: string | null;
  days: CalendarDay[];
};

const MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
/** الأسبوعُ يبدأ بالأحد — وفي الصفّ من اليمين يكون الأحدُ أوّلَه. */
const WEEK = ["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];

/**
 * ألوانُ النقاط ثابتةٌ لا تتبع الثيم: اللمسةُ والكهرمانيّ لونٌ واحد في الثيم الأصليّ،
 * فكانت نقطتا الوطنيّة والصداقة لا تُفرَّقان. أخضرُ للوطنيّة، ووردٌ للصداقة، وأزرقُ للذكرى.
 */
const dots = () => ({ national: "#1F8A55", religious: "#C28A1A", friend: "#E0568A", memory: "#3D7BD9" });

const keyOf = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;
const shift = (y: number, m: number, by: number) => {
  const index = y * 12 + (m - 1) + by;
  return { y: Math.floor(index / 12), m: (index % 12) + 1 };
};

/** «شهر»، «٦ أشهر»، «سنة»، «سنتين»، «٣ سنوات». */
function period(months: number): string {
  if (months === 1) return "شهر";
  if (months < 12) return `${ar(months)} أشهر`;
  const years = Math.round(months / 12);
  if (years === 1) return "سنة";
  if (years === 2) return "سنتين";
  return `${ar(years)} ${years <= 10 ? "سنوات" : "سنة"}`;
}

const useMonth = (key: string) =>
  useQuery({
    queryKey: ["calendar", key],
    queryFn: () => api<CalendarMonth>(`/v1/calendar?month=${key}`),
    staleTime: 10 * 60_000,
  });

/**
 * التقويم (القاعدة ٢٩٢) — **بقرار المالك**: شهرٌ ميلاديّ بنقاطٍ على أيّامه —
 * المناسباتُ الوطنيّة لبلده، ومناسباتُ الصداقة، والذكريات — وتحته ما في اليوم
 * المختار حين يُختار. كلُّه يُشتقّ على الخادم (القاعدة
 * ٢٣٥) ولصاحبه وحده.
 */
export default function CalendarScreen() {
  const router = useRouter();
  const now = new Date();
  const [view, setView] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 });
  const [picked, setPicked] = useState<string | null>(null);

  const current = useMonth(keyOf(view.y, view.m));
  const today = current.data?.today ?? "";
  const byDate = useMemo(() => new Map((current.data?.days ?? []).map((day) => [day.date, day])), [current.data]);

  const first = new Date(Date.UTC(view.y, view.m - 1, 1)).getUTCDay();
  const length = new Date(Date.UTC(view.y, view.m, 0)).getUTCDate();
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);

  // ما في اليوم يظهر حين يُختار وحده — **بقرار المالك**: لا قائمةَ «قادمة» تحت الشهر.
  const selected = picked && picked.startsWith(keyOf(view.y, view.m)) ? picked : null;
  const day = selected ? byDate.get(selected) : undefined;

  const DOT = dots();
  const go = (by: number) => {
    // مدى الخادم (`CALENDAR_YEARS`): ما خارجه يُردّ، فلا يُتنقَّل إليه.
    const to = shift(view.y, view.m, by);
    if (to.y < 2020 || to.y > 2100) return;
    setView(to);
    setPicked(null);
  };

  return (
    <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: colors.ground }}>
      <ScreenHeader title="التقويم" back="/me" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 16, direction: "rtl" }}>
        {/* الشهر: سابقٌ في اليمين، وتالٍ في اليسار. */}
        <View style={{ borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, padding: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
            <Pressable accessibilityLabel="الشهر السابق" onPress={() => go(-1)} hitSlop={8} style={NAV}>
              <View style={{ transform: [{ scaleX: -1 }] }}>
                <BackIcon size={18} color={colors.ink2} />
              </View>
            </Pressable>
            <Text style={{ flex: 1, textAlign: "center", color: colors.ink, fontSize: 17, fontWeight: "800" }}>
              {MONTHS[view.m - 1]} {ar(view.y)}
            </Text>
            <Pressable accessibilityLabel="الشهر التالي" onPress={() => go(1)} hitSlop={8} style={NAV}>
              <BackIcon size={18} color={colors.ink2} />
            </Pressable>
          </View>

          <View style={{ flexDirection: "row" }}>
            {WEEK.map((name) => (
              <Text key={name} style={{ flex: 1, textAlign: "center", color: colors.faint, fontSize: 10.5, fontWeight: "600" }}>
                {name}
              </Text>
            ))}
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 6 }}>
            {cells.map((n, index) => {
              if (!n) return <View key={`e${index}`} style={{ width: `${100 / 7}%`, height: 50 }} />;
              const date = `${keyOf(view.y, view.m)}-${String(n).padStart(2, "0")}`;
              const entry = byDate.get(date);
              const isToday = date === today;
              const isPicked = date === selected;
              return (
                <Pressable
                  key={date}
                  accessibilityLabel={`${ar(n)} ${MONTHS[view.m - 1]}`}
                  onPress={() => setPicked(date)}
                  style={{ width: `${100 / 7}%`, height: 50, alignItems: "center", justifyContent: "center" }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: isPicked ? colors.clay : "transparent",
                      borderWidth: isToday && !isPicked ? 1.5 : 0,
                      borderColor: colors.clay,
                    }}
                  >
                    <Text style={{ color: isPicked ? colors.onBrand : colors.ink, fontSize: 14, fontWeight: isToday || isPicked ? "800" : "500" }}>
                      {ar(n)}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", gap: 3, height: 5, marginTop: 2 }}>
                    {entry?.national.some((item) => !item.religious) ? <Dot color={DOT.national} /> : null}
                    {entry?.national.some((item) => item.religious) ? <Dot color={DOT.religious} /> : null}
                    {entry?.friends.length ? <Dot color={DOT.friend} /> : null}
                    {entry?.memories ? <Dot color={DOT.memory} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>

          {current.isLoading ? <ActivityIndicator style={{ marginTop: 8 }} color={colors.clay} /> : null}

          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", columnGap: 14, rowGap: 4, marginTop: 10 }}>
            <Legend color={DOT.national} label="وطنية" />
            <Legend color={DOT.religious} label="إسلامية" />
            <Legend color={DOT.friend} label="صداقة" />
            <Legend color={DOT.memory} label="ذكرى" />
          </View>
        </View>

        {/* اليومُ المختار. */}
        {selected ? (
          <View style={{ gap: 8 }}>
            <Text style={{ color: colors.groundInk, fontSize: 14, fontWeight: "800" }}>
              {ar(Number(selected.slice(8)))} {MONTHS[view.m - 1]}
              {selected === today ? " · اليوم" : ""}
            </Text>
            {day ? (
              <DayCard day={day} isToday={selected === today} onFriend={(id) => router.push(`/u/${id}` as never)} onMemories={() => router.push("/" as never)} />
            ) : (
              <Text style={{ color: colors.groundMuted, fontSize: 12.5 }}>لا شيء في هذا اليوم.</Text>
            )}
          </View>
        ) : null}

      </ScrollView>
    </SafeAreaView>
  );
}

const NAV = { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" } as const;

const Dot = ({ color }: { color: string }) => <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: color }} />;

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
      <Dot color={color} />
      <Text style={{ color: colors.muted, fontSize: 11 }}>{label}</Text>
    </View>
  );
}

function DayCard({
  day,
  isToday,
  onFriend,
  onMemories,
}: {
  day: CalendarDay;
  isToday: boolean;
  onFriend: (id: string) => void;
  onMemories: () => void;
}) {
  const DOT = dots();
  return (
    <View style={{ borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, overflow: "hidden" }}>
      {day.national.map((item) => (
        <Row key={item.name} color={item.religious ? DOT.religious : DOT.national}>
          <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "700" }}>{item.name}</Text>
          {item.greeting ? <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 20 }}>{item.greeting}</Text> : null}
        </Row>
      ))}
      {day.friends.map(({ friend, months }) => (
        <Pressable key={friend.id} onPress={() => onFriend(friend.id)}>
          <Row color={DOT.friend} lead={<Avatar name={friend.name} mediaId={friend.avatarMediaId} size={34} />}>
            <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "700" }}>{friend.name}</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {isToday ? "اليوم " : ""}تكمل صداقتكما {period(months)}
            </Text>
          </Row>
        </Pressable>
      ))}
      {day.memories ? (
        <Pressable disabled={!isToday} onPress={onMemories}>
          <Row color={DOT.memory} lead={<ClockIcon size={20} color={colors.ink2} />}>
            <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "700" }}>
              {day.memories.count === 1 ? "ذكرى واحدة" : day.memories.count === 2 ? "ذكريان" : `${ar(day.memories.count)} ذكريات`}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              لحظاتٌ كتبتها قبل {period(day.memories.months)}{isToday ? " — تجدها في أعلى اللحظات" : ""}
            </Text>
          </Row>
        </Pressable>
      ) : null}
    </View>
  );
}

function Row({ color, lead, children }: { color: string; lead?: React.ReactNode; children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line }}>
      <View style={{ width: 4, alignSelf: "stretch", borderRadius: 2, backgroundColor: color }} />
      {lead}
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>{children}</View>
    </View>
  );
}
