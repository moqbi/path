/**
 * نسبةُ إطار صورة اللحظة في البطاقة والمحرّر معاً — كالجوّال (`PHOTO_RATIO`
 * في `components/photo-frame.tsx`). ملفٌّ وحده لا في `photo.tsx`: ثابتٌ من
 * ملفّ `"use client"` يصل مكوّنَ الخادم مرجعاً لا رقماً.
 */
export const PHOTO_RATIO = 5 / 4;

/**
 * نسبةُ إطار لحظة آثار+ (القاعدة ٤٧٤) — نسخةُ `fullRatio` في `packages/shared` حرفاً بحرف:
 * بين ٣:٤ قائمةً و٢:١ عرضاً، و`null` حين لا تُعرف الأبعاد فيبقى إطارُ البطاقة.
 */
export function fullRatio(width: number | null | undefined, height: number | null | undefined): number | null {
  if (!width || !height) return null;
  return Math.min(2, Math.max(3 / 4, width / height));
}

/** إطارُ صورة اللحظة: نسبةُ ملفّها للحظة آثار+، وإلّا نسبةُ البطاقة. */
export function momentRatio(moment: { fullFrame?: boolean; media?: { width: number | null; height: number | null } | null }): number {
  return (moment.fullFrame ? fullRatio(moment.media?.width, moment.media?.height) : null) ?? PHOTO_RATIO;
}

/** صورُ لحظة الصور: خمسٌ على الأكثر — نسخةُ `MOMENT_PHOTOS_MAX` في `packages/shared` (القاعدة ٣٤٣). */
export const MOMENT_PHOTOS_MAX = 5;
