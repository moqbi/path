import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

export type Mood = { id: string; emoji: string; name: string; color: string; mediaId: string | null };

/**
 * المودات من اللوحة (القاعدة ٤٨٤) — والمكتوبةُ هنا ريثما تصل، بمعرّفاتها
 * المبذورة نفسها: من فتح الشاشةَ بلا شبكةٍ يرى الوجوه ولا يرى فراغاً.
 */
export const FALLBACK_MOODS: Mood[] = [
  { id: "mood_sad", emoji: "😔", name: "متضايق", color: "#7A8FB0", mediaId: null },
  { id: "mood_angry", emoji: "😠", name: "معصّب", color: "#E8634F", mediaId: null },
  { id: "mood_sleepy", emoji: "😴", name: "نعسان", color: "#7E95E6", mediaId: null },
  { id: "mood_calm", emoji: "😌", name: "رايق", color: "#6FBF92", mediaId: null },
  { id: "mood_chill", emoji: "😊", name: "مروّق", color: "#F6B93B", mediaId: null },
  { id: "mood_excited", emoji: "🤩", name: "متحمس", color: "#FF9A3C", mediaId: null },
  { id: "mood_missing", emoji: "🥰", name: "مشتاق", color: "#F07FA2", mediaId: null },
  { id: "mood_tired", emoji: "😩", name: "تعبان", color: "#A39C92", mediaId: null },
  { id: "mood_sick", emoji: "🤒", name: "مريض", color: "#8FB3B3", mediaId: null },
  { id: "mood_cold", emoji: "🥶", name: "بردان", color: "#6FB7E6", mediaId: null },
];

export function useMoods() {
  return useQuery({
    queryKey: ["moods"],
    queryFn: () => api<{ moods: Mood[] }>("/v1/site/moods"),
    staleTime: 10 * 60_000,
    select: (data) => (data.moods.length ? data.moods : FALLBACK_MOODS),
  });
}
