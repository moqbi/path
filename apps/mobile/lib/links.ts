/** أوّلُ رابطٍ في نصّ — المعاينةُ لواحد (القاعدة ٣٦٦)، ونسختُها في الخادم `lib/link-preview.ts`. */
export function firstUrl(text: string | null | undefined): string | null {
  if (!text) return null;
  const hit = text.match(/https?:\/\/[^\s<>"'«»]+/i);
  if (!hit) return null;
  return hit[0].replace(/[).,!?؛،:]+$/u, "");
}
