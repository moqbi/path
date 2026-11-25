import { prisma } from "@/lib/db";

/** ما تحمله بطاقةُ المقال — في قائمة المدونة و«مقالات مشابهة». */
export const CARD = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  category: true,
  coverMediaId: true,
  publishedAt: true,
  author: {
    select: { name: true, isPlus: true, plusUntil: true, tag: { select: { name: true, bg: true, fg: true } } },
  },
} as const;

export type BlogCard = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  coverMediaId: string | null;
  publishedAt: Date | null;
  author: BlogAuthor | null;
};

export type BlogAuthor = {
  name: string;
  isPlus: boolean;
  plusUntil: Date | null;
  tag: { name: string; bg: string; fg: string } | null;
};

/** مشتركٌ الآن: `isPlus` يبقى حتى الكنس، و`plusUntil` يقول الحقيقة (القاعدة ١٤٩). */
export function authorPlus(author: BlogAuthor | null): boolean {
  return Boolean(author?.isPlus && (!author.plusUntil || author.plusUntil > new Date()));
}

const LIVE = { published: true } as const;

/** المنشورُ وحده، بأحدثه. والقراءةُ محروسةٌ كنصوص الموقع (القاعدة ١١٠): بناءٌ بلا قاعدةٍ لا يسقط. */
export async function blogPosts(): Promise<BlogCard[]> {
  return prisma.blogPost
    .findMany({ where: LIVE, orderBy: { publishedAt: "desc" }, select: CARD, take: 200 })
    .catch(() => []);
}

export async function blogPost(slug: string) {
  return prisma.blogPost
    .findFirst({
      where: { slug, ...LIVE },
      select: { ...CARD, blocks: true, updatedAt: true },
    })
    .catch(() => null);
}

/** «مقالات مشابهة»: من التصنيف نفسه أوّلاً، ثمّ الأحدث، ثلاثةٌ بلا المقال نفسه. */
export async function similarPosts(post: { id: string; category: string }, take = 3): Promise<BlogCard[]> {
  const same = post.category
    ? await prisma.blogPost.findMany({
        where: { ...LIVE, category: post.category, id: { not: post.id } },
        orderBy: { publishedAt: "desc" },
        select: CARD,
        take,
      })
    : [];
  if (same.length >= take) return same;
  const rest = await prisma.blogPost.findMany({
    where: { ...LIVE, id: { notIn: [post.id, ...same.map((one) => one.id)] } },
    orderBy: { publishedAt: "desc" },
    select: CARD,
    take: take - same.length,
  });
  return [...same, ...rest];
}

export function blogDate(date: Date | null): string {
  if (!date) return "";
  return date.toLocaleDateString("ar-SA-u-ca-gregory", { day: "numeric", month: "long", year: "numeric" });
}
