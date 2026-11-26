import type { QueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { api, baseUrl, currentAccess } from "./api";
import { warmSkia } from "../components/filtered";

/**
 * القصّةُ تُجلب قبل أن تُفتح.
 *
 * كانت الشاشة تُفتح سوداءَ بدوّارةٍ ثانيتين: تسأل الخادمَ عن قصص صاحبها ثمّ
 * تجلب الصورة، والاثنان بعد الضغطة. الآن الشريطُ يجلب قائمةَ من فيها جديدٌ
 * حين يُرسم، والضغطةُ نفسها (`onPressIn`) تجلب ما لم يُجلب — فتُفتح القصّةُ
 * وبياناتُها في الذاكرة وصورتُها الأولى في الخبيئة.
 */
type Slide = { mediaId: string; filter: string | null; media: { mime: string }; viewed?: boolean };

const STALE = 60_000;

export function storiesQuery(userId: string) {
  return {
    queryKey: ["stories", userId] as const,
    queryFn: () => api<{ stories: Slide[] }>(`/v1/stories/user/${userId}`),
    staleTime: STALE,
  };
}

export async function prefetchStories(client: QueryClient, userId: string) {
  try {
    const data = await client.fetchQuery(storiesQuery(userId));
    // من أوّل ما لم يُشاهَد — منه يبدأ العارض — واثنتان تكفيان.
    const from = Math.max(0, data.stories.findIndex((slide) => slide.viewed === false));
    for (const slide of data.stories.slice(from, from + 2)) warmMedia(slide);
  } catch {
    /* الفتحُ يجلب بنفسه */
  }
}

/** الخبيئةُ بالمعرّف كما يقرؤها `MediaImage` (القاعدة ١٣٣)، والمفلترةُ بـSkia. */
function warmMedia(slide: Slide) {
  if (slide.media.mime.startsWith("video/")) return;
  if (slide.filter) {
    warmSkia(slide.mediaId);
    return;
  }
  const token = currentAccess();
  if (!token) return;
  void Image.loadAsync({
    uri: `${baseUrl}/v1/media/${slide.mediaId}`,
    headers: { authorization: `Bearer ${token}` },
    cacheKey: slide.mediaId,
  }).catch(() => undefined);
}
