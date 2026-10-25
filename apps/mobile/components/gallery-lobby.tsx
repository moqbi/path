import { useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Spinner } from "./spinner";
import { Text } from "./type";
import { ScreenHeader } from "./screen-header";
import { DownloadIcon, LockIcon, SparkIcon } from "./icons";
import { api } from "../lib/api";
import { ar } from "../lib/format";
import type { ArchivePage } from "../lib/archive";
import { HALL_SKIN } from "../lib/gallery-skin";
import { canDownloadBook, downloadBook } from "../lib/book-pdf";
import { colors } from "../theme/tokens";

type Years = { years: { year: number; moments: number }[] };

/**
 * «المعرض وكتاب السنة» (القاعدة ٣٤٦) — بدل «أرشيفي»: في أعلاها كتابُ السنة كما هو،
 * وتحته بابُ القاعة — قاعةٌ لكلّ سنة، تُدخل وتُمشى بالإصبع (`app/me/hall/[year].tsx`).
 * والأقدمُ من ستّة أشهر لغير المشترك قاعاتٌ خلف آثار+ (القاعدة ٢٤٤).
 */
export function GalleryLobby() {
  const router = useRouter();
  const skin = HALL_SKIN;
  const years = useQuery({ queryKey: ["archive", "years"], queryFn: () => api<Years>("/v1/archive/years") });
  const head = useQuery({ queryKey: ["archive", "head"], queryFn: () => api<ArchivePage>("/v1/archive?limit=1") });
  const list = years.data?.years ?? [];
  const [latest, ...older] = list;
  const locked = head.data?.limited && head.data.hidden > 0;
  const [saving, setSaving] = useState<number | null>(null);
  // الـPDF من هنا مباشرةً كزرّه في الكتاب (القاعدة ٢٥٦) — لا يُفتح الكتابُ ليُحمَّل.
  const pdf = async (year: number) => {
    if (saving) return;
    setSaving(year);
    try {
      await downloadBook(year);
    } catch (problem) {
      Alert.alert("تعذّر تحميل الكتاب", problem instanceof Error ? problem.message : "حاول مرة ثانية");
    } finally {
      setSaving(null);
    }
  };

  return (
    <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: colors.ground }}>
      <ScreenHeader title="المعرض وكتاب السنة" back="/me" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 12 }}>
        <Text style={{ color: colors.groundInk, fontSize: 12.5, fontWeight: "800" }}>كتاب السنة</Text>
        {years.isLoading ? <Spinner color={colors.clay} /> : null}
        {list.length === 0 && years.data ? (
          <Text style={{ color: colors.groundInk, fontSize: 13 }}>انشر لحظتك الأولى ويبدأ كتابك ومعرضك.</Text>
        ) : null}
        {list.map((row) => (
          <View key={row.year} style={{ flexDirection: "row", gap: 14, backgroundColor: colors.card, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: colors.line }}>
            {/* الغلافُ بألوان الكتاب الثابتة (القاعدة ٢٥٦). */}
            <View style={{ width: 78, height: 104, borderRadius: 6, borderTopRightRadius: 12, borderBottomRightRadius: 12, backgroundColor: "#FBF8F1", borderLeftWidth: 6, borderLeftColor: "#E6DCC6", padding: 10, justifyContent: "space-between", shadowColor: "#000", shadowOpacity: 0.16, shadowRadius: 8, shadowOffset: { width: 0, height: 5 }, elevation: 4 }}>
              <Text face="display" style={{ color: "#0E1A24", fontSize: 22, fontWeight: "800" }}>{ar(row.year)}</Text>
              <Text style={{ color: "#5B5446", fontSize: 9.5 }}>{ar(row.moments)} لحظة</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
              <Text face="display" style={{ color: colors.ink, fontSize: 16, fontWeight: "800" }}>سنتك في كتاب</Text>
              <Text style={{ color: colors.muted, fontSize: 12.5, lineHeight: 20 }}>يومٌ لكلّ صفحة، ويُروى بلسانك.</Text>
              <View style={{ flexDirection: "row", gap: 8, marginTop: "auto" }}>
                <Pressable
                  onPress={() => router.push(`/me/book/${row.year}` as never)}
                  style={{ height: 34, paddingHorizontal: 14, borderRadius: 17, justifyContent: "center", backgroundColor: colors.clay }}
                >
                  <Text style={{ color: colors.onBrand, fontSize: 12.5, fontWeight: "800" }}>افتح الكتاب</Text>
                </Pressable>
                <Pressable
                  onPress={() => void pdf(row.year)}
                  style={{ height: 34, paddingHorizontal: 12, borderRadius: 17, flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: colors.line, opacity: canDownloadBook ? 1 : 0.6 }}
                >
                  {saving === row.year ? <Spinner size="small" color={colors.ink} /> : <DownloadIcon size={13} color={colors.ink} />}
                  <Text style={{ color: colors.ink, fontSize: 12.5, fontWeight: "700" }}>PDF</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ))}

        {latest ? (
          <>
            <Text style={{ color: colors.groundInk, fontSize: 12.5, fontWeight: "800", marginTop: 6 }}>المعرض</Text>
            {/* بابُ القاعة: قوسٌ مضيء وثلاثُ لوحاتٍ على جدارها — من ثوبها نفسه. */}
            <Pressable
              onPress={() => router.push(`/me/hall/${latest.year}` as never)}
              accessibilityLabel={`ادخل قاعة ${latest.year}`}
              style={{ height: 270, borderRadius: 22, overflow: "hidden", backgroundColor: skin.ceiling }}
            >
              <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 86, backgroundColor: skin.floor }} />
              <View style={{ position: "absolute", alignSelf: "center", bottom: 86, width: 220, height: 160, borderTopLeftRadius: 110, borderTopRightRadius: 110, backgroundColor: skin.wall, borderWidth: 8, borderBottomWidth: 0, borderColor: "#2A3946", alignItems: "center", justifyContent: "flex-end", paddingBottom: 26, flexDirection: "row", gap: 9, paddingHorizontal: 30 }}>
                {[
                  { w: 40, h: 50, c: "#2B4A63", f: "#3A2A1C" },
                  { w: 52, h: 64, c: "#C86F4F", f: skin.photo.frame },
                  { w: 40, h: 50, c: "#8FA38A", f: "#3A2A1C" },
                ].map((frame, at) => (
                  <View key={at} style={{ width: frame.w, height: frame.h, backgroundColor: frame.c, borderWidth: 4, borderColor: frame.f, marginBottom: at === 1 ? 6 : 0 }} />
                ))}
              </View>
              <View style={{ position: "absolute", left: 16, right: 16, bottom: 16, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
                <View>
                  <Text face="display" style={{ color: "#FDFCF8", fontSize: 21, fontWeight: "800" }}>قاعة {ar(latest.year)}</Text>
                  <Text style={{ color: "rgba(253,252,248,.8)", fontSize: 12 }}>{ar(latest.moments)} لحظة — شهرٌ لكلّ جدار</Text>
                </View>
                <View style={{ height: 36, paddingHorizontal: 16, borderRadius: 18, justifyContent: "center", backgroundColor: skin.accent.bg }}>
                  <Text style={{ color: skin.accent.ink, fontSize: 13, fontWeight: "800" }}>ادخل</Text>
                </View>
              </View>
            </Pressable>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {older.map((row) => (
                <Pressable
                  key={row.year}
                  onPress={() => router.push(`/me/hall/${row.year}` as never)}
                  style={{ flexGrow: 1, flexBasis: "45%", backgroundColor: colors.card, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: colors.line }}
                >
                  <Text face="display" style={{ color: colors.ink, fontSize: 15, fontWeight: "800" }}>قاعة {ar(row.year)}</Text>
                  <Text style={{ color: colors.muted, fontSize: 11.5 }}>{ar(row.moments)} لحظة</Text>
                </Pressable>
              ))}
              {locked ? (
                <Pressable
                  onPress={() => router.push("/subscribe" as never)}
                  style={{ flexGrow: 1, flexBasis: "45%", borderRadius: 16, padding: 12, borderWidth: 1, borderStyle: "dashed", borderColor: colors.line, backgroundColor: colors.paper }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <LockIcon size={13} color={colors.muted} />
                    <Text face="display" style={{ color: colors.muted, fontSize: 15, fontWeight: "800" }}>لحظات أقدم</Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <SparkIcon size={12} color={colors.clay} />
                    <Text style={{ color: colors.clayInk, fontSize: 11.5 }}>{ar(head.data!.hidden)} لحظة مع آثار+</Text>
                  </View>
                </Pressable>
              ) : null}
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
