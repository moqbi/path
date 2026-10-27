"use server";

import { currentUser } from "@/lib/auth";
import { apiAs } from "@/lib/api-bridge";
import { canTryStickers } from "@/lib/stickers";

/**
 * معاينةُ الرابط في الويب (القاعدة ٣٦٦) — من الخادم نفسه (`apiAs` ← `/v1/links/preview`)
 * لا نسخةٌ هنا: حارسُ العناوين الخاصّة واحدٌ يُصان في مكانٍ واحد. وللمالك وممنوحي
 * اللوحة كلّها مقابلَ نسخة التطوير. والفشلُ `null`: الرابطُ في النصّ كما هو.
 */
export type LinkPreviewData = {
  url: string;
  site: string;
  title: string | null;
  description: string | null;
  image: string | null;
};

export async function linkPreviewOf(url: string): Promise<LinkPreviewData | null> {
  const user = await currentUser();
  if (!user || !canTryStickers(user)) return null;
  try {
    const res = await apiAs<{ preview: LinkPreviewData | null }>(
      user.id,
      `/v1/links/preview?url=${encodeURIComponent(url.slice(0, 2048))}`,
    );
    return res.preview;
  } catch {
    return null;
  }
}
