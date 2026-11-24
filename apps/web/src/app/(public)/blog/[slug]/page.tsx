import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AthrMark } from "@/components/brand";
import { BlogBody } from "@/components/blog-body";
import { BlogCardView } from "@/components/blog-card";
import { blogDate, blogPost, similarPosts } from "@/lib/blog";
import { readBlocks, readingMinutes } from "@/lib/blog-blocks";
import { ar } from "@/lib/format";

function readingLabel(minutes: number): string {
  if (minutes <= 1) return "قراءة دقيقة";
  if (minutes === 2) return "قراءة دقيقتين";
  return `قراءة ${ar(minutes)} ${minutes <= 10 ? "دقائق" : "دقيقة"}`;
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await blogPost(decodeURIComponent(slug));
  if (!post) return { title: "المدونة · آثار مومنتس" };
  const image = post.coverMediaId ? [`/api/site-media/${post.coverMediaId}`] : undefined;
  return {
    title: `${post.title} · مدونة آثار مومنتس`,
    description: post.excerpt || undefined,
    openGraph: { title: post.title, description: post.excerpt || undefined, type: "article", images: image },
    twitter: { card: image ? "summary_large_image" : "summary", title: post.title, description: post.excerpt || undefined },
  };
}

/** المقال (القاعدة ٤٩٠): رأسٌ داكنٌ بالتصنيف والعنوان، فالغلاف، فالمتن، ثمّ «مقالات مشابهة». */
export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await blogPost(decodeURIComponent(slug));
  if (!post) notFound();
  const blocks = readBlocks(post.blocks);
  const similar = await similarPosts(post).catch(() => []);

  return (
    <article>
      <header className="page-hero blog-hero">
        <div className="mx-auto flex max-w-2xl flex-col items-center">
          <Link href="/blog" className="blog-back">
            <AthrMark size={22} /> المدونة
          </Link>
          {post.category ? <span className="blog-hero-cat">{post.category}</span> : null}
          <h1 dir="auto">{post.title}</h1>
          {post.excerpt ? <p className="blog-hero-lead" dir="auto">{post.excerpt}</p> : null}
          <p className="blog-hero-meta">
            {/* فاصلةٌ لا «·» بين عددين: الصفرُ العربيّ نقطة (القاعدة ٢٣٥). */}
            {[post.author?.name, blogDate(post.publishedAt), readingLabel(readingMinutes(blocks))]
              .filter(Boolean)
              .join("، ")}
          </p>
        </div>
      </header>

      <div className="blog-article">
        {post.coverMediaId ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="blog-cover" src={`/api/site-media/${post.coverMediaId}`} alt="" />
        ) : null}
        <div className="blog-sheet">
          <BlogBody blocks={blocks} />
        </div>
      </div>

      {similar.length ? (
        <section className="blog-wrap">
          <h2 className="blog-similar-title">مقالات مشابهة</h2>
          <div className="blog-grid blog-grid-3">
            {similar.map((one) => (
              <BlogCardView key={one.id} post={one} />
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
}
