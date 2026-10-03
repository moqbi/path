import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import type { Moment } from "./queries";

/** الذكرياتُ ومناسباتُ الصداقة وآثرك السنويّ (القاعدة ٢٣٥). */
export type MemoryGroup = { months: number; label: string; moments: Moment[] };

export type Occasion = {
  id: string;
  kind: "FRIENDVERSARY" | "STREAK" | "FIRST_TOGETHER";
  friend: { id: string; name: string; avatarMediaId: string | null };
  title: string;
  detail: string | null;
  momentId: string | null;
};

export type Today = {
  day: string;
  recapYear: number | null;
  memories: MemoryGroup[];
  occasions: Occasion[];
  moments: Moment[];
};

/** بطاقةُ اليوم — تُسأل مرّةً لكلّ ساعة: ما فيها لا يتغيّر في اليوم إلا بطيّها. */
export const useToday = (enabled: boolean) =>
  useQuery({
    queryKey: ["memories", "today"],
    queryFn: () => api<Today>("/v1/memories/today"),
    enabled,
    staleTime: 60 * 60_000,
  });

export type Person = { id: string; name: string; avatarMediaId: string | null; count: number };

export type Recap = {
  year: number;
  moments: number;
  byKind: { photos: number; places: number; thoughts: number; songs: number };
  activeDays: number;
  cities: string[];
  topPlace: { name: string; count: number } | null;
  topSong: { title: string; artist: string | null; thumb: string | null; url: string | null; count: number } | null;
  youLoved: Person | null;
  lovedYou: Person | null;
  reactionsGot: number;
  commentsGot: number;
  newFriends: number;
  topMoment: Moment | null;
};

export const useRecap = (year: number) =>
  useQuery({
    queryKey: ["recap", year],
    queryFn: () => api<{ recap: Recap | null }>(`/v1/recap/${year}`),
    enabled: Number.isFinite(year),
  });

/** جمهورُ المشاركة: الدائرة كلّها أو أشخاصٌ بأعيانهم. */
export type ShareAudience = { audience: "CIRCLE" } | { audience: "PICKED"; viewers: string[] };
