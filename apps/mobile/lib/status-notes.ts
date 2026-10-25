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
  /** صورةٌ متحرّكة من GIPHY (القاعدة ٣١٥) — وخادمٌ قديم بلا الحقول لا يرسلها. */
  gifId?: string | null;
  gifW?: number | null;
  gifH?: number | null;
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

/** صورةٌ متحرّكة في نتائج GIPHY: معرّفُها ومقاسُها ومصغّرتُها للشبكة. */
export type Gif = { id: string; w: number; h: number; preview: string };

/**
 * رابطُ الصورة يُبنى من معرّفها (القاعدة ٣١٥) — لا يُحفظ عنوانٌ كتبه جهاز. وعرضُها
 * ٢٠٠ (`200w`): أكبرُ ما تُرسم فيه فقاعةُ النوت.
 */
export const gifUrl = (id: string) => `https://media.giphy.com/media/${id}/200w.gif`;

/** الرائجةُ قبل الكتابة، ثمّ البحثُ — من خادمنا (`/v1/gifs`). */
export function useGifs(query: string) {
  const q = query.trim();
  return useQuery({
    queryKey: ["gifs", q],
    queryFn: () =>
      api<{ enabled: boolean; gifs: Gif[] }>(q ? `/v1/gifs/search?q=${encodeURIComponent(q)}` : "/v1/gifs/trending"),
    staleTime: 5 * 60_000,
  });
}

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
type Player = {
  key: string | null;
  playing: boolean;
  loading: boolean;
  /** من أين بدأ المقطعُ ومتى وكم يدوم — لمؤشّر التشغيل في شريط القصّ (القاعدة ٣٣٩). */
  from: number;
  seconds: number;
  startedAt: number;
};
const usePlayer = create<Player>(() => ({ key: null, playing: false, loading: false, from: 0, seconds: 0, startedAt: 0 }));
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
    usePlayer.setState({ key, playing: true, loading: false, from: start, seconds, startedAt: Date.now() });
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
  const mine = state.key === key;
  return {
    playing: mine && state.playing,
    loading: mine && state.loading,
    from: state.from,
    seconds: state.seconds,
    startedAt: mine ? state.startedAt : 0,
  };
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
