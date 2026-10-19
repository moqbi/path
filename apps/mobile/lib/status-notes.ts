import { useEffect, useState } from "react";
import { Audio } from "expo-av";
import { useQuery } from "@tanstack/react-query";
import { create } from "zustand";
import { api } from "./api";
import { DEV_FEATURES } from "./dev-features";

/**
 * النوت (القاعدة ٢٦٩): فقاعةٌ فوق صورة صاحبها في شريط القصص — سطرٌ أو
 * مقطعُ أغنيةٍ من دِيزر بعشرين ثانية، يوماً ثمّ يذهب.
 */

export type NotePerson = {
  id: string;
  name: string;
  avatarMediaId: string | null;
  frame: { spec: string; mediaId: string | null; frameHole: number | null } | null;
  charm: { spec: string; mediaId: string | null } | null;
};

export type StatusNote = {
  id: string;
  authorId: string;
  text: string | null;
  trackId: string | null;
  trackTitle: string | null;
  trackArtist: string | null;
  trackCover: string | null;
  trackStart: number;
  groupId: string | null;
  groupName: string | null;
  createdAt: string;
  expiresAt: string;
  author: NotePerson;
  seen: boolean;
  myReaction: string | null;
  seconds: number | null;
};

export type Track = {
  id: string;
  title: string;
  artist: string;
  cover: string | null;
  duration: number;
  /** `apple` يُكتب بجانبها «Apple Music» (القاعدة ٣٠٤) — والقديمُ بلا الحقل دِيزر. */
  source?: "deezer" | "apple";
};

export const NOTE_TEXT_MAX = 60;
export const PREVIEW_SECONDS = 30;
export const NOTE_SECONDS = 20;

export const noteKeys = { all: ["statusNotes"] as const };

export function useStatusNotes() {
  return useQuery({
    queryKey: noteKeys.all,
    queryFn: () => api<{ notes: StatusNote[] }>("/v1/notes"),
    refetchInterval: 60_000,
  });
}

/** النوتُ المفتوحة في النافذة — تُركَّب في الجذر (القاعدة ١٣٧). */
export const useOpenNote = create<{ noteId: string | null }>(() => ({ noteId: null }));
export const openNote = (noteId: string | null) => useOpenNote.setState({ noteId });

/**
 * مشغّلٌ واحد للنوت ومعاينات الأغاني: تشغيلُ مقطعٍ يوقف ما قبله، والمقطعُ
 * يقف بعد عشرين ثانيةً من بدايته — المعاينةُ ثلاثون والنوتُ عشرون منها.
 */
type Player = { key: string | null; playing: boolean; loading: boolean };
const usePlayer = create<Player>(() => ({ key: null, playing: false, loading: false }));
let sound: Audio.Sound | null = null;
let stopTimer: ReturnType<typeof setTimeout> | null = null;
let ticket = 0;

export async function stopClip() {
  ticket += 1;
  if (stopTimer) clearTimeout(stopTimer);
  stopTimer = null;
  const old = sound;
  sound = null;
  usePlayer.setState({ key: null, playing: false, loading: false });
  if (old) await old.unloadAsync().catch(() => {});
}

export async function playClip(key: string, url: string, start: number, seconds = NOTE_SECONDS, onDone?: () => void) {
  await stopClip();
  const mine = ++ticket;
  usePlayer.setState({ key, playing: false, loading: true });
  try {
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    const made = await Audio.Sound.createAsync(
      { uri: url },
      { shouldPlay: true, positionMillis: Math.round(start * 1000) },
    );
    if (mine !== ticket) {
      await made.sound.unloadAsync().catch(() => {});
      return;
    }
    sound = made.sound;
    usePlayer.setState({ key, playing: true, loading: false });
    stopTimer = setTimeout(() => {
      if (mine !== ticket) return;
      void stopClip();
      onDone?.();
    }, seconds * 1000);
  } catch {
    if (mine === ticket) usePlayer.setState({ key: null, playing: false, loading: false });
  }
}

export function useClip(key: string) {
  const state = usePlayer();
  return { playing: state.key === key && state.playing, loading: state.key === key && state.loading };
}

/** مقطعُ نوتٍ برابطٍ طازج من خادمنا. */
export async function playNote(noteId: string, onDone?: () => void) {
  const { url, start, seconds } = await api<{ url: string; start: number; seconds: number }>(
    `/v1/notes/${noteId}/audio`,
  );
  await playClip(`note:${noteId}`, url, start, seconds, onDone);
}

/** معاينةُ أغنيةٍ قبل اختيارها — للقائمة وشريط القصّ. */
export async function previewOf(trackId: string): Promise<string> {
  const { url } = await api<{ url: string }>(`/v1/music/${trackId}/preview`);
  return url;
}

/** البحثُ مؤجَّلاً: حرفٌ يُكتب لا يُرسل طلباً حتى يقف الإصبع. */
export function useTracks(query: string) {
  const [needle, setNeedle] = useState(query.trim());
  useEffect(() => {
    const timer = setTimeout(() => setNeedle(query.trim()), 350);
    return () => clearTimeout(timer);
  }, [query]);
  return useQuery({
    queryKey: ["music", needle],
    queryFn: () =>
      api<{ tracks: Track[] }>(
        // Apple Music مع دِيزر في نسخة التطوير وحدها حتى يُعتمد (القاعدة ٣٠٤).
        needle ? `/v1/music/search?q=${encodeURIComponent(needle)}${DEV_FEATURES ? "&apple=1" : ""}` : "/v1/music/top",
      ),
    staleTime: 5 * 60_000,
  });
}
