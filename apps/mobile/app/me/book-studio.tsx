import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Switch, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BOOK_COVER_LABEL,
  BOOK_COVERS,
  BOOK_DEDICATION_MAX,
  BOOK_FIXED,
  BOOK_SECTION_LABEL,
  BOOK_TITLE_MAX,
  DEFAULT_BOOK_PREFS,
  type BookPrefs,
  type BookSection,
} from "@athar/shared";
import { Text } from "../../components/type";
import { Spinner } from "../../components/spinner";
import { ScreenHeader } from "../../components/screen-header";
import { BookCoverPage } from "../../components/book-cover";
import { BackIcon, LockIcon, SparkIcon } from "../../components/icons";
import { api } from "../../lib/api";
import { ar } from "../../lib/format";
import type { Book } from "../../lib/archive";
import { colors } from "../../theme/tokens";

/** ما يقوله كلُّ قسمٍ تحته — من أرقام السنة نفسها حيث تُعرف. */
function hint(id: BookSection, book: Book): string {
  const s = book.stats;
  switch (id) {
    case "numbers":
      return `${ar(s.moments)} لحظة · ${ar(s.photos)} صورة`;
    case "places":
      return s.cities.length ? s.cities.slice(0, 3).join("، ") : "مدنك وأكثر مكان رجعت له";
    case "song":
      return s.topSong ?? "أكثر أغنية نشرتها";
    case "circle":
      return "أقرب الناس وأكثر لحظة حرّكتهم";
    case "months":
      return "يومٌ لكلّ صفحة — متن الكتاب";
    case "end":
      return "صفحة الختام";
  }
}

/**
 * «تجهيز الكتاب» (القاعدة ٣٧٨) — **بقرار المالك**، لمشتركي آثار+: غلافٌ من ثلاثة،
 * وعنوانٌ وإهداء، وأقسامٌ تُظهر وتُخفى وتُرتَّب بسهمين. والكتابُ نفسه معاينتُها: «احفظ»
 * يرجع إليه وقد تبدّل، والـPDF يُطبع منه. ولغير المشترك الشاشةُ نفسها مقفلةً بدعوة —
 * يرى ما يُفتح قبل أن يشترك، والخادمُ يردّ الحفظ لا الشاشة.
 */
export default function BookStudio() {
  const router = useRouter();
  const client = useQueryClient();
  const { year } = useLocalSearchParams<{ year: string }>();
  const book = useQuery({
    queryKey: ["archive", "book", year],
    queryFn: () => api<Book>(`/v1/archive/book/${year}`),
  });
  const [draft, setDraft] = useState<BookPrefs | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (book.data && !draft) setDraft(book.data.prefs ?? DEFAULT_BOOK_PREFS);
  }, [book.data, draft]);

  const data = book.data;
  const open = Boolean(data?.custom);

  const move = (index: number, by: -1 | 1) =>
    setDraft((now) => {
      if (!now) return now;
      const to = index + by;
      if (to < 0 || to >= now.sections.length) return now;
      const sections = [...now.sections];
      [sections[index], sections[to]] = [sections[to], sections[index]];
      return { ...now, sections };
    });

  const save = async () => {
    if (!draft || saving) return;
    setSaving(true);
    try {
      const prefs = await api<BookPrefs>(`/v1/archive/book/${year}/prefs`, { method: "PUT", body: JSON.stringify(draft) });
      client.setQueryData<Book>(["archive", "book", year], (old) => (old ? { ...old, prefs } : old));
      router.back();
    } catch (problem) {
      Alert.alert("ما انحفظ", problem instanceof Error ? problem.message : "حاول مرة ثانية");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView edges={["bottom"]} style={{ flex: 1, backgroundColor: colors.ground }}>
      <ScreenHeader
        title={`تجهيز كتاب ${ar(Number(year))}`}
        back={`/me/book/${year}`}
        right={
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#F6B93B", borderRadius: 14, paddingHorizontal: 10, height: 26 }}>
            <SparkIcon size={11} color="#3a2700" />
            <Text style={{ color: "#3a2700", fontSize: 11.5, fontWeight: "800" }}>آثار+</Text>
          </View>
        }
      />
      {!data || !draft ? (
        <Spinner style={{ marginTop: 40 }} color={colors.clay} />
      ) : (
        <>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30, gap: 14, direction: "rtl" }}>
            {open ? null : (
              <View style={{ backgroundColor: "#0E1A24", borderRadius: 18, padding: 16, gap: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <SparkIcon size={15} color="#F6B93B" />
                  <Text face="display" style={{ color: "#fff", fontSize: 16, fontWeight: "800" }}>كتابك كما تريده مع آثار+</Text>
                </View>
                {["سنتك كاملة لا آخر ستة أشهر", "ثلاثة أغلفة، وعنوان وإهداء بكلماتك", "اختر الأقسام ورتّبها قبل التصدير"].map((line) => (
                  <Text key={line} style={{ color: "rgba(255,255,255,.85)", fontSize: 12.5 }}>
                    ✦ {line}
                  </Text>
                ))}
                <Pressable
                  onPress={() => router.push("/subscribe" as never)}
                  style={{ marginTop: 6, height: 40, borderRadius: 12, backgroundColor: "#F6B93B", alignItems: "center", justifyContent: "center" }}
                >
                  <Text face="display" style={{ color: "#3a2700", fontSize: 14, fontWeight: "800" }}>اشترك في آثار+</Text>
                </Pressable>
              </View>
            )}

            <View pointerEvents={open ? "auto" : "none"} style={{ gap: 14, opacity: open ? 1 : 0.55 }}>
              <Text style={{ color: colors.groundInk, fontSize: 13.5, fontWeight: "800" }}>الغلاف</Text>
              <View style={{ flexDirection: "row", gap: 12 }}>
                {BOOK_COVERS.map((cover) => {
                  const on = draft.cover === cover;
                  return (
                    <Pressable key={cover} onPress={() => setDraft({ ...draft, cover })} style={{ flex: 1, alignItems: "center", gap: 6 }} accessibilityLabel={`غلاف ${BOOK_COVER_LABEL[cover]}`}>
                      <View
                        style={{
                          width: "100%",
                          aspectRatio: 0.7,
                          borderRadius: 8,
                          overflow: "hidden",
                          borderWidth: on ? 3 : 1,
                          borderColor: on ? "#F6B93B" : colors.line,
                        }}
                      >
                        <BookCoverPage book={{ ...data, prefs: { ...draft, cover } }} scale={0.34} />
                        {open ? null : cover === "night" ? null : (
                          <View style={{ position: "absolute", inset: 0, backgroundColor: "rgba(14,26,36,.45)", alignItems: "center", justifyContent: "center" }}>
                            <LockIcon size={18} color="#F6B93B" />
                          </View>
                        )}
                      </View>
                      <Text style={{ color: colors.groundInk, fontSize: 12, fontWeight: on ? "800" : "600" }}>{BOOK_COVER_LABEL[cover]}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={{ backgroundColor: colors.card, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 6 }}>
                <Field
                  label="عنوان الكتاب"
                  placeholder="مثلاً: سنة البحر والرياض"
                  value={draft.title ?? ""}
                  max={BOOK_TITLE_MAX}
                  onChange={(title) => setDraft({ ...draft, title })}
                />
                <View style={{ height: 1, backgroundColor: colors.line }} />
                <Field
                  label="الإهداء — صفحة بعد الغلاف"
                  placeholder="إلى نورة وخالد، رفاق كل اللحظات"
                  value={draft.dedication ?? ""}
                  max={BOOK_DEDICATION_MAX}
                  multiline
                  onChange={(dedication) => setDraft({ ...draft, dedication })}
                />
              </View>

              <Text style={{ color: colors.groundInk, fontSize: 13.5, fontWeight: "800" }}>الأقسام وترتيبها</Text>
              <View style={{ backgroundColor: colors.card, borderRadius: 16, paddingHorizontal: 10 }}>
                {draft.sections.map((row, index) => {
                  const fixed = BOOK_FIXED.includes(row.id);
                  return (
                    <View
                      key={row.id}
                      style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, borderTopWidth: index ? 1 : 0, borderTopColor: colors.line }}
                    >
                      <View style={{ gap: 2 }}>
                        <Arrow up disabled={index === 0} onPress={() => move(index, -1)} />
                        <Arrow disabled={index === draft.sections.length - 1} onPress={() => move(index, 1)} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0, opacity: row.on ? 1 : 0.5 }}>
                        <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "700" }}>{BOOK_SECTION_LABEL[row.id]}</Text>
                        <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11.5 }}>
                          {row.on ? hint(row.id, data) : "مخفي من الكتاب"}
                        </Text>
                      </View>
                      <Switch
                        value={row.on}
                        disabled={fixed}
                        trackColor={{ true: colors.clay, false: colors.line }}
                        onValueChange={(on) =>
                          setDraft({ ...draft, sections: draft.sections.map((one) => (one.id === row.id ? { ...one, on } : one)) })
                        }
                      />
                    </View>
                  );
                })}
              </View>
              <Text style={{ color: colors.groundInk, fontSize: 11.5, lineHeight: 19 }}>
                الشهور متن الكتاب فلا تُخفى، وتنتقل بالسهمين. وما تختاره يظهر في الكتاب وفي ملف PDF معاً.
              </Text>
            </View>
          </ScrollView>
          {open ? (
            <View style={{ padding: 16, paddingTop: 8 }}>
              <Pressable
                onPress={save}
                disabled={saving}
                style={{ height: 50, borderRadius: 16, backgroundColor: colors.clay, alignItems: "center", justifyContent: "center" }}
              >
                {saving ? (
                  <Spinner size="small" color={colors.onBrand} />
                ) : (
                  <Text face="display" style={{ color: colors.onBrand, fontSize: 16, fontWeight: "800" }}>احفظ وشوف كتابك</Text>
                )}
              </Pressable>
            </View>
          ) : null}
        </>
      )}
    </SafeAreaView>
  );
}

function Arrow({ up, disabled, onPress }: { up?: boolean; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityLabel={up ? "انقله لأعلى" : "انقله لأسفل"}
      style={{ width: 26, height: 20, borderRadius: 6, alignItems: "center", justifyContent: "center", backgroundColor: colors.paper, opacity: disabled ? 0.3 : 1 }}
    >
      <View style={{ transform: [{ rotate: up ? "90deg" : "-90deg" }] }}>
        <BackIcon size={14} color={colors.ink} />
      </View>
    </Pressable>
  );
}

function Field({
  label,
  placeholder,
  value,
  max,
  multiline,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  max: number;
  multiline?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <View style={{ paddingVertical: 8 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: colors.muted, fontSize: 11.5 }}>{label}</Text>
        <Text style={{ color: colors.muted, fontSize: 11 }}>{ar(max - value.length)}</Text>
      </View>
      <TextInput
        value={value}
        onChangeText={(text) => onChange(text.slice(0, max))}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        multiline={multiline}
        maxLength={max}
        style={{ color: colors.ink, fontSize: 15, textAlign: "right", paddingVertical: 6, minHeight: multiline ? 54 : undefined }}
      />
    </View>
  );
}
