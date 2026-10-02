/**
 * وسمُ «داعم» لمشتركي آثار+ — نسخةُ `SUPPORTER_TAG` في `packages/shared`.
 *
 * هذا المشروع يُبنى بمعزلٍ عن حزم pnpm فلا يراها (كـ`src/lib/base.ts`)،
 * فالقيمة تُنسخ هنا حرفاً بحرف. وإن تغيّرت تغيّرتا معاً.
 */
export const SUPPORTER_TAG = { name: "داعم", bg: "#F6B93B", fg: "#FFFFFF" } as const;
