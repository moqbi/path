import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { Text, TextInput } from "./type";
import { GifIcon, SearchIcon } from "./icons";
import { GlassSheet, useSheetScroll } from "./glass-sheet";
import { useGifs, type Gif } from "../lib/status-notes";

const COLUMNS = 3;
const GAP = 6;

/**
 * اختيارُ صورةٍ متحرّكة للنوت (القاعدة ٣١٥) — **بقرار المالك**: نافذةٌ زجاجيّة
 * (`GlassSheet`) في أعلاها البحث، وتحته الرائجةُ من GIPHY ثمّ نتائجُ ما كُتب،
 * والضغطةُ تختار. والبحثُ يُرسَل بعد أن يقف الإصبع لا مع كلّ حرف.
 */
export function GifPicker({ onPick, onClose }: { onPick: (gif: Gif) => void; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setTerm(query), 350);
    return () => clearTimeout(timer);
  }, [query]);
  const gifs = useGifs(term);
  const onScroll = useSheetScroll("gifs");

  // عرضُ النافذة (هامشُ ١٠ من كلّ جهة) ناقصاً حشوتَها ثمّ الفواصل.
  const cell = Math.floor((width - 20 - 24 - GAP * (COLUMNS - 1)) / COLUMNS);

  return (
    <GlassSheet icon={<GifIcon size={22} color="#fff" />} title="صور متحركة" onClose={onClose}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          marginHorizontal: 12,
          marginTop: 12,
          height: 42,
          paddingHorizontal: 12,
          borderRadius: 14,
          backgroundColor: "rgba(255,255,255,.12)",
        }}
      >
        <SearchIcon size={16} color="rgba(255,255,255,.6)" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="ابحث في GIPHY"
          placeholderTextColor="rgba(255,255,255,.45)"
          returnKeyType="search"
          autoCorrect={false}
          style={{ flex: 1, color: "#fff", fontSize: 14, textAlign: "right" }}
        />
      </View>

      <View style={{ height: Math.round(height * 0.46), marginTop: 10 }}>
        {gifs.isLoading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color="#fff" />
        ) : (
          <FlatList
            data={gifs.data?.gifs ?? []}
            keyExtractor={(item) => item.id}
            numColumns={COLUMNS}
            onScroll={onScroll}
            scrollEventThrottle={16}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            columnWrapperStyle={{ gap: GAP }}
            contentContainerStyle={{ paddingHorizontal: 12, gap: GAP, paddingBottom: 12 }}
            ListEmptyComponent={
              <Text style={{ color: "rgba(255,255,255,.6)", fontSize: 13, textAlign: "center", marginTop: 40 }}>
                {gifs.isError ? (gifs.error as Error).message : "ما لقينا شي بهالكلمة."}
              </Text>
            }
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="اختر هذه الصورة"
                onPress={() => onPick(item)}
                style={{ width: cell, height: cell, borderRadius: 10, overflow: "hidden", backgroundColor: "rgba(255,255,255,.08)" }}
              >
                <Image source={{ uri: item.preview }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
              </Pressable>
            )}
          />
        )}
      </View>

      {/* شرطُ GIPHY: اسمُه حيث تُعرض صورُه. */}
      <Text style={{ color: "rgba(255,255,255,.45)", fontSize: 10.5, textAlign: "center", paddingVertical: 8 }}>
        Powered by GIPHY
      </Text>
    </GlassSheet>
  );
}
