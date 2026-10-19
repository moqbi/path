import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { storiesOf, viewersOf } from "@/lib/stories";
import type { StoryText } from "@/components/story-texts";
import type { StorySticker } from "@/components/story-stickers";
import { StoryViewer } from "./viewer";

/** مشاهدة قصص شخص: شاشة كاملة، شريحة تلو أخرى. */
export default async function StoriesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) redirect("/login");

  const stories = await storiesOf(user.id, id);
  if (stories.length === 0) notFound();
  const mine = id === user.id;
  // من شاهدها يُقرأ لصاحبها وحده.
  const viewers = mine ? await viewersOf(user.id, stories.map((story) => story.id)) : null;

  return (
    <StoryViewer
      mine={mine}
      author={{
        id: stories[0].author.id,
        name: stories[0].author.name,
        avatarMediaId: stories[0].author.avatarMediaId,
      }}
      stories={stories.map((story) => ({
        id: story.id,
        mediaId: story.mediaId,
        at: story.createdAt.toISOString(),
        seen: story._count.views,
        viewers: viewers?.get(story.id) ?? [],
        video: story.media.mime.startsWith("video/"),
        seconds: story.seconds,
        filter: story.filter,
        texts: Array.isArray(story.texts) ? (story.texts as StoryText[]) : null,
        stickers: Array.isArray(story.stickers) ? (story.stickers as StorySticker[]) : null,
        audioMediaId: story.audioMediaId,
        audioSeconds: story.audioSeconds,
        trackId: story.trackId,
        trackSeconds: story.trackSeconds,
        videoMuted: story.videoMuted,
        frame: frameOf(story.frame),
        myReaction: story.myReaction,
      }))}
    />
  );
}

/** تقريبُ صورة القصّة وإزاحتُها (القاعدة ٢٩٦) — ما لا يُقرأ منها يُترك. */
function frameOf(value: unknown): { z: number; x: number; y: number; a?: number } | null {
  if (!value || typeof value !== "object") return null;
  const { z, x, y, a } = value as Record<string, unknown>;
  if (typeof z !== "number" || typeof x !== "number" || typeof y !== "number") return null;
  // `a` نسبةُ الصورة (القاعدة ٣٠٢) — قصصٌ قبلها بلا نسبة.
  return typeof a === "number" && a > 0 ? { z, x, y, a } : { z, x, y };
}
