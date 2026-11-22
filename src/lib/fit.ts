/**
 * ضبطُ الإطار والتشارم على الصورة (القاعدة ٤٧٥) — `StoreItem.fit` بصيغة «x,y,s».
 * نسخةُ `packages/shared/src/fit.ts` حرفاً بحرف (مشروعُ الجذر لا يرى الحزم).
 *
 * الإطار: x وy إزاحةُ رسمه نسبةً من قطر الصورة (−٤٠..٤٠)، وs مقاسُه ٪ فوق ما يحسبه
 * الفراغ (`frameZoom`). التشارم: x وy نسبةٌ من مقاسها هي، وs مقاسُها ٪.
 */
export type Fit = { x: number; y: number; s: number };

export const FIT_NONE: Fit = { x: 0, y: 0, s: 100 };
export const FIT_LIMITS = { offset: 60, minScale: 40, maxScale: 250 } as const;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function parseFit(raw: string | null | undefined): Fit {
  if (!raw) return FIT_NONE;
  const [x, y, s] = raw.split(",").map(Number);
  if (![x, y, s].every(Number.isFinite)) return FIT_NONE;
  return {
    x: clamp(x, -FIT_LIMITS.offset, FIT_LIMITS.offset),
    y: clamp(y, -FIT_LIMITS.offset, FIT_LIMITS.offset),
    s: clamp(s, FIT_LIMITS.minScale, FIT_LIMITS.maxScale),
  };
}

export function formatFit(fit: Fit): string | null {
  const clean = parseFit(`${Math.round(fit.x)},${Math.round(fit.y)},${Math.round(fit.s)}`);
  return clean.x === 0 && clean.y === 0 && clean.s === 100 ? null : `${clean.x},${clean.y},${clean.s}`;
}
