import Link from "next/link";
import { AthrMark } from "@/components/brand";
import { blogDate, type BlogCard } from "@/lib/blog";

/** بطاقةُ المقال: صورةٌ فوقها التصنيف، ثمّ العنوانُ والملخّصُ والتاريخ. والبطاقةُ كلُّها الرابط. */
export function BlogCardView({ post, lead = false }: { post: BlogCard; lead?: boolean }) {
  return (
    <Link href={`/blog/${encodeURIComponent(post.slug)}`} className={`blog-card ${lead ? "blog-card-lead" : ""}`}>
      <div className="blog-card-media">
        {post.coverMediaId ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/site-media/${post.coverMediaId}`} alt="" loading="lazy" />
        ) : (
          <span className="blog-card-blank" aria-hidden>
            <AthrMark size={lead ? 64 : 44} />
          </span>
        )}
        {post.category ? <span className="blog-card-cat">{post.category}</span> : null}
      </div>
      <div className="blog-card-text">
        <h3 dir="auto">{post.title}</h3>
        {post.excerpt ? <p dir="auto">{post.excerpt}</p> : null}
        <span className="blog-card-date">{blogDate(post.publishedAt)}</span>
      </div>
    </Link>
  );
}
