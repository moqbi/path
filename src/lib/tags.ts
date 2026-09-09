import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db";

export type TagView = { name: string; bg: string; fg: string };

/**
 * الوسم الممنوح تلقائياً لمشتركي أثر+.
 * يُقرأ ولا يُكتب في صفّ كل مشترك: الاشتراك ينتهي من نفسه، ولو كتبناه
 * لبقي الوسم معلّقاً على حساب انتهى اشتراكه حتى تمرّ مهمة تنظيف.
 * `cache` يجعله استعلاماً واحداً مهما تكرّر في الصفحة.
 */
export const plusTag = cache(
  async (): Promise<TagView | null> =>
    prisma.tag.findFirst({
      where: { autoForPlus: true },
      select: { name: true, bg: true, fg: true },
    }),
);

/** وسم الحساب: الممنوح له، وإلا وسم المشتركين إن كان مشتركاً. */
export function tagOf(
  user: { tag?: TagView | null; isPlus?: boolean },
  auto: TagView | null,
): TagView | null {
  return user.tag ?? (user.isPlus ? auto : null);
}
