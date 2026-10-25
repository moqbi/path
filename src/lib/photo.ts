/**
 * نسبةُ إطار صورة اللحظة في البطاقة والمحرّر معاً — كالجوّال (`PHOTO_RATIO`
 * في `components/photo-frame.tsx`). ملفٌّ وحده لا في `photo.tsx`: ثابتٌ من
 * ملفّ `"use client"` يصل مكوّنَ الخادم مرجعاً لا رقماً.
 */
export const PHOTO_RATIO = 5 / 4;

/** صورُ لحظة الصور: خمسٌ على الأكثر — نسخةُ `MOMENT_PHOTOS_MAX` في `packages/shared` (القاعدة ٣٤٣). */
export const MOMENT_PHOTOS_MAX = 5;
