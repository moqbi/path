import { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { create } from "zustand";
import { Text } from "./type";
import { MediaImage } from "./media-image";
import { Spinner } from "./spinner";
import { api } from "../lib/api";
import { colors } from "../theme/tokens";

type Card = { id: string; cardTitle: string; cardBody: string; mediaId: string | null };

const useOpenBroadcast = create<{ id: string | null }>(() => ({ id: null }));
/** يفتح بطاقةَ تنبيه المشرف بمعرّفه — من ضغطة التنبيه في الجذر (القاعدة ٣٦٣). */
export const openBroadcast = (id: string | null) => useOpenBroadcast.setState({ id });

/**
 * بطاقةُ تنبيه المشرف (القاعدة ٣٦٣) — **بقرار المالك**، بهيئة بطاقة إعلان الصنف
 * (القاعدة ٢٦٧): الصورةُ بنسبتها، ثمّ «من آثار»، فالعبارة، فالنصّ، و«إغلاق».
 * **طبقةٌ في الجذر لا `Modal`** (القاعدة ١٧٣). والنصُّ الطويل يُمرَّر داخلها.
 */
export function BroadcastCard() {
  const id = useOpenBroadcast((state) => state.id);
  const [card, setCard] = useState<Card | null>(null);
  const [failed, setFailed] = useState(false);
  const [ratio, setRatio] = useState<number | null>(null);

  useEffect(() => {
    setCard(null);
    setFailed(false);
    setRatio(null);
    if (!id) return;
    let live = true;
    api<{ card: Card }>(`/v1/broadcasts/${id}`)
      .then((row) => live && setCard(row.card))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [id]);

  if (!id) return null;
  const close = () => openBroadcast(null);

  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 60,
        elevation: 60,
        backgroundColor: "rgba(14,26,36,.55)",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 28,
        paddingVertical: 60,
      }}
    >
      <Pressable accessibilityLabel="إغلاق" onPress={close} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
      <View style={{ width: "100%", maxWidth: 340, maxHeight: "100%", borderRadius: 24, backgroundColor: colors.card, overflow: "hidden" }}>
        {!card ? (
          <View style={{ height: 180, alignItems: "center", justifyContent: "center", gap: 10 }}>
            {failed ? (
              <Text style={{ color: colors.muted, fontSize: 13.5 }}>تعذّر فتح التنبيه</Text>
            ) : (
              <Spinner color={colors.clay} />
            )}
          </View>
        ) : (
          <ScrollView bounces={false} contentContainerStyle={{ flexGrow: 0 }}>
            {card.mediaId ? (
              <View style={{ aspectRatio: shape(ratio), backgroundColor: colors.paper }}>
                {/* ما زاد عن حدَّي النسبة تملؤه نسخةٌ مغبّشة (القاعدة ٢٨٥). */}
                <MediaImage mediaId={card.mediaId} blurRadius={18} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
                <MediaImage
                  mediaId={card.mediaId}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="contain"
                  onSize={(width, height) => setRatio(width / height)}
                />
              </View>
            ) : null}
            <View style={{ padding: 22, gap: 6 }}>
              <Text style={{ color: colors.clayInk, fontSize: 11.5, fontWeight: "700" }}>من آثار</Text>
              <Text style={{ color: colors.ink, fontSize: 19, fontWeight: "700", writingDirection: "auto" }}>{card.cardTitle}</Text>
              <Text style={{ color: colors.ink2, fontSize: 14, lineHeight: 24, writingDirection: "auto" }}>{card.cardBody}</Text>
            </View>
          </ScrollView>
        )}
        <Pressable onPress={close} style={{ height: 50, alignItems: "center", justifyContent: "center", borderTopWidth: 1, borderTopColor: colors.line }}>
          <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "600" }}>إغلاق</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** نسبةُ صندوق الصورة: نسبتُها هي، بين طوليّةٍ لا تتجاوز الشاشة وعرضيّةٍ لا تصير شريطاً. */
function shape(ratio: number | null) {
  if (!ratio) return 340 / 260;
  return Math.min(2, Math.max(0.7, ratio));
}
