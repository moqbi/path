import { useEffect } from "react";
import { Platform } from "react-native";
import { useRouter } from "expo-router";
import { useShareIntent } from "expo-share-intent";

/**
 * ما يُشارَك إلى آثار من تطبيقٍ آخر (القاعدة ٣٠٦): صورةٌ من الاستديو، أو رابطُ
 * يوتيوب، أو نصّ — يفتح شاشةَ النشر جاهزةً به.
 *
 * والوحدةُ اختياريّة في الحزمة نفسها (`requireOptionalNativeModule`): بناءٌ بلاها
 * لا يرى شيئاً ولا يسقط (القاعدة ١٢٤). وما شُورك يُقرأ مرّةً ويُمحى كلقطة
 * الكاميرا (`lib/capture.ts`) — لو بقي لعاد إلى الشاشة بعد نشره.
 */
export type Shared =
  | { kind: "PHOTO"; picture: { uri: string; mime: string; width: number; height: number } }
  | { kind: "MUSIC"; url: string }
  | { kind: "THOUGHT"; text: string };

let pending: Shared | null = null;

export function takeShared(): Shared | null {
  const shared = pending;
  pending = null;
  return shared;
}

/** ما يقرؤه الخادمُ أغنيةً (`isSupportedMusicUrl` في `lib/music-link.ts`). */
const MUSIC_HOST = /(^|\.)(youtube\.com|youtu\.be|spotify\.com|soundcloud\.com)$/i;

function musicUrl(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return (url.protocol === "https:" || url.protocol === "http:") && MUSIC_HOST.test(url.hostname) ? raw : null;
  } catch {
    return null;
  }
}

type Intent = ReturnType<typeof useShareIntent>["shareIntent"];

function read(intent: Intent): Shared | null {
  const image = intent.files?.find((file) => file.mimeType?.startsWith("image/"));
  if (image) {
    return {
      kind: "PHOTO",
      picture: { uri: image.path, mime: image.mimeType, width: image.width ?? 0, height: image.height ?? 0 },
    };
  }
  const music = musicUrl(intent.webUrl);
  if (music) return { kind: "MUSIC", url: music };
  const text = (intent.text ?? intent.webUrl ?? "").trim();
  return text ? { kind: "THOUGHT", text } : null;
}

/**
 * يُنادى في الجذر: ما يصل يُحفظ حتى يكون صاحبُه داخلاً، ثمّ تُفتح شاشةُ النشر.
 * ومن شارك وهو خارجٌ يدخل أوّلاً ثمّ تُفتح له.
 */
export function useShareIn(signedIn: boolean): void {
  const router = useRouter();
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent({
    disabled: Platform.OS === "web",
    resetOnBackground: true,
  });

  useEffect(() => {
    if (!hasShareIntent || !signedIn) return;
    const shared = read(shareIntent);
    resetShareIntent();
    if (!shared) return;
    pending = shared;
    router.push({ pathname: "/compose", params: { kind: shared.kind } });
  }, [hasShareIntent, shareIntent, signedIn, resetShareIntent, router]);
}
