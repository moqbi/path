import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

/**
 * أسئلة الخادم في مكانٍ واحد.
 *
 * المفاتيح مكتوبةٌ هنا لا في الشاشات: شاشتان تكتبان `["feed"]` و
 * `["timeline"]` لنفس الشيء تعنيان ذاكرتين لا تتفقان أبداً.
 */
export const keys = {
  feed: (view: string) => ["feed", view] as const,
  moment: (id: string) => ["moment", id] as const,
  circle: ["circle"] as const,
  suggestions: ["circle", "suggestions"] as const,
  notes: ["notes"] as const,
  noteCount: ["notes", "count"] as const,
  store: ["store"] as const,
  me: ["me"] as const,
  user: (id: string) => ["user", id] as const,
  userMoments: (id: string) => ["user", id, "moments"] as const,
  dm: ["dm"] as const,
  thread: (id: string) => ["dm", id] as const,
};

export type Person = {
  id: string;
  name: string;
  isPlus: boolean;
  avatarMediaId: string | null;
  frame: { spec: string; mediaId: string | null } | null;
  charm: { spec: string; mediaId: string | null } | null;
  tag: { name: string; bg: string; fg: string } | null;
};

export type Moment = {
  id: string;
  kind: string;
  text: string | null;
  placeName: string | null;
  placeCity: string | null;
  musicTitle: string | null;
  musicArtist: string | null;
  musicUrl: string | null;
  musicThumb: string | null;
  imageSpec: string | null;
  mediaId: string | null;
  createdAt: string;
  author: Person;
  tags: { id: string; name: string }[];
  reactions: {
    userId: string;
    kind: string;
    emoji: string | null;
    name: string;
    avatarMediaId: string | null;
    mine: boolean;
  }[];
  comments: {
    id: string;
    body: string;
    createdAt: string;
    user: { id: string; name: string; avatarMediaId: string | null };
  }[];
  _count: { views: number; comments: number };
};

type Page = { moments: Moment[]; nextCursor?: string };

/**
 * الخطّ الزمني بصفحاتٍ بمؤشّر.
 *
 * المؤشّر لا الرقم: لحظةٌ تُنشر أثناء التصفّح تزيح كل شيء صفحةً، فيتكرّر
 * ما قُرئ ويسقط ما لم يُقرأ.
 */
export function useFeed(view: "" | "private" = "") {
  return useInfiniteQuery({
    queryKey: keys.feed(view),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => {
      const path = view === "private" ? "/v1/feed/private" : "/v1/feed";
      const query = new URLSearchParams({ limit: "20" });
      if (pageParam) query.set("cursor", pageParam);
      return api<Page>(`${path}?${query}`);
    },
    getNextPageParam: (last) => last.nextCursor,
  });
}

export const useMoment = (id: string) =>
  useQuery({ queryKey: keys.moment(id), queryFn: () => api<{ moment: Moment }>(`/v1/moments/${id}`) });

export const useCircle = () =>
  useQuery({
    queryKey: keys.circle,
    queryFn: () =>
      api<{
        members: (Person & { memberNo: number; city: string | null; lastSeenAt: string | null })[];
        requests: { id: string; createdAt: string; requester: Person & { memberNo: number } }[];
        groups: { id: string; name: string; count: number }[];
        cap: number;
        left: number;
      }>("/v1/circle"),
  });

export const useSuggestions = () =>
  useQuery({
    queryKey: keys.suggestions,
    queryFn: () => api<{ people: (Person & { mutual: number })[] }>("/v1/circle/suggestions"),
  });

export type Note = {
  id: string;
  kind: "REACTION" | "COMMENT" | "TAG" | "FRIEND" | "MESSAGE" | "GIFT";
  at: string;
  text: string;
  href: string;
  person: { id: string; name: string; avatarMediaId: string | null };
  emoji?: string | null;
  reaction?: string;
  thumb?: string | null;
};

export const useNotes = () =>
  useQuery({ queryKey: keys.notes, queryFn: () => api<{ notes: Note[] }>("/v1/notifications") });

export const useNoteCount = () =>
  useQuery({
    queryKey: keys.noteCount,
    queryFn: () => api<{ unseen: number }>("/v1/notifications/count"),
    refetchInterval: 60_000,
  });

export type StoreItem = {
  id: string;
  kind: "FRAME" | "BACKGROUND" | "THEME" | "CHARM";
  name: string;
  priceHalalas: number;
  spec: string;
  mediaId: string | null;
  plusOnly: boolean;
  earnedAfterDays: number | null;
  limited: boolean;
  categoryId: string | null;
  palette: string | null;
};

export const useStore = () =>
  useQuery({
    queryKey: keys.store,
    queryFn: () =>
      api<{
        categories: { id: string; name: string; slug: string }[];
        items: StoreItem[];
        owned: string[];
        rows: { fresh: StoreItem[]; themes: StoreItem[]; limited: StoreItem[] };
        credit: number;
        isPlus: boolean;
        daysHere: number;
        equipped: { frame: string | null; theme: string | null; charm: string | null };
      }>("/v1/store"),
  });

export const useProfile = (id: string) =>
  useQuery({ queryKey: keys.user(id), queryFn: () => api<{ person: Record<string, unknown> }>(`/v1/users/${id}`) });

/**
 * التفاعل: يُكتب في الشاشة قبل أن يصل الخادم.
 *
 * ضغطةٌ تنتظر ردّ الشبكة تبدو معطّلة على شبكةٍ بطيئة. والخطأ يُرجع
 * الحالة كما كانت — لا يُترك وجهٌ ظاهرٌ لم يُسجَّل.
 */
export function useReact(momentId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { kind: string; emoji?: string }) =>
      api<{ reacted: boolean }>(`/v1/moments/${momentId}/react`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: ["feed"] });
      void client.invalidateQueries({ queryKey: keys.moment(momentId) });
    },
  });
}

export function useComment(momentId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      api(`/v1/moments/${momentId}/comments`, { method: "POST", body: JSON.stringify({ body }) }),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: keys.moment(momentId) });
      void client.invalidateQueries({ queryKey: ["feed"] });
    },
  });
}

export type StoryRing = {
  userId: string;
  name: string;
  avatarMediaId: string | null;
  frame: { spec: string } | null;
  fresh: boolean;
  count: number;
};

export const useRings = () =>
  useQuery({ queryKey: ["stories"], queryFn: () => api<{ rings: StoryRing[] }>("/v1/stories") });
